import base64
import json
import os
import re
import time
from pathlib import Path
from typing import Callable

import httpx

from skills.base import BaseSkill
from services.image_backend import get_backend, read_image
from services.llm import sanitize_image_prompt_for_safety

API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
API_BASE_URL = os.getenv("API_BASE_URL", "https://api.anthropic.com/v1").rstrip("/")
CHAT_URL = f"{API_BASE_URL}/chat/completions"
CHAT_MODEL = "claude-sonnet-4-6"

OUTPUT_BASE = Path("outputs/sketch2keyvisual")

SIZE_MAP = {
    "16:9": "2560x1440",   # 3686400px ≥ Seedream minimum
    "4:3":  "2400x1800",   # 4320000px
    "1:1":  "2048x2048",   # 4194304px
    "9:16": "1440x2560",   # 3686400px
}
STYLE_PREFIX = {
    "2d": "2D美式卡通Q版风格场景，干净平涂上色，卡通描边，",
    "3d": "3D皮克斯卡通渲染风格场景，高质量体积光，影视级渲染，",
}
CHAR_PROMPT = {
    "2d": (
        "参考图包含角色形象、造型与道具信息。\n"
        "纯白背景，单角色2D立绘，保持外形、比例与道具完全一致。\n"
        "2D美式卡通Q版风格，卡通描边，干净上色，全身完整入镜，四周留白。\n"
        "宣发主视觉质量，姿态可读，情绪明确，轮廓清晰。"
    ),
    "3d": (
        "参考图包含角色形象、造型与道具信息。\n"
        "纯白背景，单角色3D立绘，保持外形、比例与道具完全一致。\n"
        "3D皮克斯卡通渲染风格，高质量渲染，全身完整入镜，四周留白。\n"
        "宣发主视觉质量，姿态可读，情绪明确，轮廓清晰。"
    ),
}


class Sketch2KeyVisualSkill(BaseSkill):

    @staticmethod
    def _parse_json_list(raw: str) -> list:
        """Parse LLM JSON-array output with multiple fallback strategies."""
        # Strip code fences
        if "```json" in raw:
            raw = raw.split("```json", 1)[1].split("```", 1)[0].strip()
        elif "```" in raw:
            raw = max((p.strip() for p in raw.split("```")), key=len)
        # Ensure we have a JSON array (skip any preamble text)
        if not raw.startswith("["):
            m = re.search(r'\[[\s\S]*\]', raw)
            if m:
                raw = m.group(0)
        # Direct parse
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            pass
        # Fallback: extract individual objects (handles stray quotes in string values)
        objects = re.findall(r'\{[\s\S]*?\}(?=\s*[,\]])', raw)
        result = []
        for obj in objects:
            try:
                result.append(json.loads(obj))
            except json.JSONDecodeError:
                # Last resort: pull keys out manually
                name = re.search(r'"action_name"\s*:\s*"([^"]+)"', obj)
                tpl = re.search(r'"action_template"\s*:\s*"([\s\S]+?)"(?=\s*[,}])', obj)
                theme = re.search(r'"theme_name"\s*:\s*"([^"]+)"', obj)
                bg = re.search(r'"bg_prompt"\s*:\s*"([\s\S]+?)"(?=\s*[,}])', obj)
                if name and tpl:
                    result.append({"action_name": name.group(1), "action_template": tpl.group(1)})
                elif theme and bg:
                    result.append({"theme_name": theme.group(1), "bg_prompt": bg.group(1)})
        if result:
            return result
        raise ValueError(f"无法解析 AI 返回的 JSON: {raw[:300]}")

    @classmethod
    def skill_id(cls) -> str:
        return "sketch2keyvisual"

    @classmethod
    def display_name(cls) -> str:
        return "原画转宣发图"

    @classmethod
    def description(cls) -> str:
        return "五阶段 AI 管线：任务定义 → 角色生成 → 背景生成 → 融合成图 → 交付归档"

    @classmethod
    def input_schema(cls) -> dict:
        return {
            "type": "object",
            "properties": {
                "phase": {
                    "type": "integer", "enum": [2, 3, 4],
                    "description": "执行阶段：2=角色生成，3=背景生成，4=融合成图",
                },
                # phase 2
                "image_path":    {"type": "string"},
                "task_name":     {"type": "string"},
                "template_type": {"type": "string", "enum": ["2d", "3d"], "default": "2d"},
                "output_count":  {"type": "integer", "default": 3},
                # phase 3
                "bg_keywords":   {"type": "string"},
                "aspect_ratio":  {"type": "string", "default": "16:9"},
                # phase 4
                "char_image_path": {"type": "string"},
                "bg_image_path":   {"type": "string"},
                # shared
                "image_backend": {"type": "string", "enum": ["seedream", "gemini", "gpt-image-2"], "default": "seedream"},
            },
            "required": ["phase", "task_name"],
        }

    def execute(
        self,
        params: dict,
        on_progress: Callable[[int, str], None],
        runtime_context: dict | None = None,
    ) -> dict:
        phase = int(params.get("phase", 2))
        if phase == 2:
            return self._phase2(params, on_progress)
        if phase == 3:
            return self._phase3(params, on_progress)
        if phase == 4:
            return self._phase4(params, on_progress)
        raise ValueError(f"未知阶段：{phase}")

    # ── Phase 2：角色生成 ──────────────────────────────────────────────────────

    def _phase2(self, params: dict, on_progress: Callable) -> dict:
        image_path    = params["image_path"].strip()
        task_name     = params["task_name"].strip()
        template_type = params.get("template_type", "2d")
        output_count  = int(params.get("output_count", 3))
        image_backend = params.get("image_backend", "seedream")
        safety_rewrite_prompt = bool(params.get("safety_rewrite_prompt", False))

        output_dir = OUTPUT_BASE / task_name / "phase02"
        output_dir.mkdir(parents=True, exist_ok=True)

        on_progress(10, "AI 分析角色原画，生成动作模板...")
        templates = self._gen_action_templates(image_path, output_count, template_type)

        on_progress(30, f"提交 {image_backend} 批量生成（共 {output_count} 组）...")
        saved = self._run_char_batch(
            image_path, templates, template_type, image_backend, safety_rewrite_prompt, output_dir, on_progress
        )

        return {"output_dir": str(output_dir), "output_files": saved}

    def _gen_action_templates(self, image_path: str, count: int, template_type: str) -> list:
        if not API_KEY:
            raise RuntimeError("未配置 ANTHROPIC_API_KEY")

        ref_bytes, ref_mime = read_image(image_path)
        style_hint = "2D美式卡通Q版" if template_type == "2d" else "3D皮克斯卡通渲染"

        user_prompt = (
            f"你是宣发图动作设计专家。分析参考图中的角色，生成 {count} 个适合宣发主视觉的动作模板。\n\n"
            f"角色风格：{style_hint}\n"
            "每条 action_template 必须包含4段：\n"
            "【镜头机位】仰角/平视/斜侧；【视角夸张】近大远小/广角变形；\n"
            "【动作姿态】具体招式与肢体（严格基于参考图）；【情绪氛围】宣发情绪关键词。\n\n"
            "只使用参考图可见特征，禁止新增未出现的特征。\n\n"
            "严格规则：所有字符串值内不得出现英文双引号或换行符，用顿号替代列举。\n\n"
            "JSON 数组返回（不加代码块标记）：\n"
            '[{"action_name": "2-6字", "action_template": "100-150字中文单行描述"}, ...]\n\n'
            f"生成 {count} 个。"
        )

        resp = httpx.post(
            CHAT_URL,
            headers={"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"},
            json={
                "model": CHAT_MODEL, "max_tokens": 2048,
                "thinking": {"type": "disabled"},
                "messages": [{"role": "user", "content": [
                    {"type": "image_url", "image_url": {"url": f"data:{ref_mime};base64,{base64.b64encode(ref_bytes).decode()}"}},
                    {"type": "text", "text": user_prompt},
                ]}],
            },
            timeout=120,
        )
        resp.raise_for_status()
        raw = resp.json()["choices"][0]["message"]["content"].strip()
        result = self._parse_json_list(raw)
        if not isinstance(result, list) or not result:
            raise ValueError("AI 返回格式错误")
        return result

    def _run_char_batch(self, image_path: str, templates: list, template_type: str,
                        image_backend: str, safety_rewrite_prompt: bool, output_dir: Path, on_progress: Callable) -> list[str]:
        backend = get_backend(image_backend)
        ref_bytes, ref_mime = read_image(image_path)
        main_prompt = CHAR_PROMPT.get(template_type, CHAR_PROMPT["2d"])
        task_name = output_dir.parent.name
        saved, action_log, total = [], [], len(templates)

        for idx, t in enumerate(templates):
            pct = 30 + int(idx / total * 65)
            on_progress(pct, f"生成角色姿态图 {idx + 1}/{total}：{t['action_name']}...")
            full_prompt = f"{main_prompt}\n{t['action_template']}"
            if image_backend == "gpt-image-2" and safety_rewrite_prompt:
                full_prompt = sanitize_image_prompt_for_safety(
                    user_prompt=full_prompt,
                    has_reference=True,
                    target_model="gpt-image-2",
                    refusal_message="manual safety retry requested by user",
                )["sanitized_prompt"].strip()
            img_bytes = backend.generate(
                prompt=full_prompt,
                ref_images=[ref_bytes],
                ref_mimetypes=[ref_mime],
                size="2048x2048",
                aspect_ratio="1:1",
            )
            fname = f"phase02_{idx + 1:03d}_{t['action_name']}.png"
            (output_dir / fname).write_bytes(img_bytes)
            saved.append(str(output_dir / fname))
            action_log.append({"index": idx + 1, "file": fname,
                                "action_name": t["action_name"],
                                "action_template": t["action_template"],
                                "full_prompt": full_prompt})
            if image_backend in ("gemini", "gpt-image-2") and idx < total - 1:
                time.sleep(8)

        from datetime import datetime, timezone
        (output_dir / "phase02_run.json").write_text(json.dumps({
            "phase": 2, "task_name": task_name, "template_type": template_type,
            "image_backend": image_backend, "output_count": total,
            "manual_safety_retry": safety_rewrite_prompt,
            "reference_image": image_path,
            "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "char_prompt_base": main_prompt,
            "actions": action_log,
        }, ensure_ascii=False, indent=2), encoding="utf-8")
        return saved

    # ── Phase 3：背景生成 ──────────────────────────────────────────────────────

    def _phase3(self, params: dict, on_progress: Callable) -> dict:
        task_name     = params["task_name"].strip()
        template_type = params.get("template_type", "2d")
        bg_keywords   = params.get("bg_keywords", "").strip()
        output_count  = int(params.get("output_count", 3))
        aspect_ratio  = params.get("aspect_ratio", "16:9")
        image_backend = params.get("image_backend", "seedream")
        safety_rewrite_prompt = bool(params.get("safety_rewrite_prompt", False))

        output_dir = OUTPUT_BASE / task_name / "phase03"
        output_dir.mkdir(parents=True, exist_ok=True)

        on_progress(10, "AI 生成背景主题方案...")
        bg_prompts = self._gen_bg_prompts(template_type, bg_keywords, output_count)

        on_progress(30, f"提交 {image_backend} 背景生成（共 {output_count} 组）...")
        saved = self._run_bg_batch(
            bg_prompts, template_type, bg_keywords, aspect_ratio, image_backend, safety_rewrite_prompt, output_dir, on_progress
        )

        return {"output_dir": str(output_dir), "output_files": saved}

    def _gen_bg_prompts(self, template_type: str, bg_keywords: str, count: int) -> list[dict]:
        if not API_KEY:
            raise RuntimeError("未配置 ANTHROPIC_API_KEY")

        style_hint = "2D美式卡通Q版" if template_type == "2d" else "3D皮克斯卡通渲染"
        kw_hint = f"参考关键词：{bg_keywords}" if bg_keywords else "关键词：宣发质感，游戏风格"

        user_prompt = (
            f"你是宣发图场景设计专家。生成 {count} 个不同背景场景方案，用于游戏宣发主视觉。\n\n"
            f"风格：{style_hint}\n{kw_hint}\n\n"
            "要求：纯背景场景，不含任何角色/剪影；前景留白供角色站位；动态光效、体积光明显；画面层次丰富。\n\n"
            "JSON 数组返回（不加代码块标记）：\n"
            '[{"theme_name": "2-6字", "bg_prompt": "150-200字场景描述，强调无角色纯背景"}, ...]\n\n'
            f"生成 {count} 个。"
        )
        resp = httpx.post(
            CHAT_URL,
            headers={"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"},
            json={
                "model": CHAT_MODEL, "max_tokens": 2048,
                "thinking": {"type": "disabled"},
                "messages": [{"role": "user", "content": user_prompt}],
            },
            timeout=60,
        )
        resp.raise_for_status()
        raw = resp.json()["choices"][0]["message"]["content"].strip()
        result = self._parse_json_list(raw)
        if not isinstance(result, list) or not result:
            raise ValueError("AI 返回格式错误")
        return result

    def _run_bg_batch(self, bg_prompts: list[dict], template_type: str, bg_keywords: str,
                      aspect_ratio: str, image_backend: str, safety_rewrite_prompt: bool, output_dir: Path, on_progress: Callable) -> list[str]:
        backend = get_backend(image_backend)
        size = SIZE_MAP.get(aspect_ratio, "2048x2048")
        style_prefix = STYLE_PREFIX.get(template_type, STYLE_PREFIX["2d"])
        task_name = output_dir.parent.name
        saved, bg_log, total = [], [], len(bg_prompts)

        for idx, p in enumerate(bg_prompts):
            pct = 30 + int(idx / total * 65)
            on_progress(pct, f"生成背景图 {idx + 1}/{total}：{p['theme_name']}...")
            full_prompt = f"{style_prefix}{p['bg_prompt']}\n纯背景场景，无任何角色、人物或剪影，前景保留空白区域供角色站位。"
            if image_backend == "gpt-image-2" and safety_rewrite_prompt:
                full_prompt = sanitize_image_prompt_for_safety(
                    user_prompt=full_prompt,
                    has_reference=False,
                    target_model="gpt-image-2",
                    refusal_message="manual safety retry requested by user",
                )["sanitized_prompt"].strip()
            img_bytes = backend.generate(
                prompt=full_prompt,
                ref_images=None,
                size=size,
                aspect_ratio=aspect_ratio,
            )
            fname = f"phase03_{idx + 1:03d}_{p['theme_name']}.png"
            (output_dir / fname).write_bytes(img_bytes)
            saved.append(str(output_dir / fname))
            bg_log.append({"index": idx + 1, "file": fname,
                            "theme_name": p["theme_name"],
                            "bg_prompt": p["bg_prompt"],
                            "full_prompt": full_prompt})
            if image_backend in ("gemini", "gpt-image-2") and idx < total - 1:
                time.sleep(8)

        from datetime import datetime, timezone
        (output_dir / "phase03_run.json").write_text(json.dumps({
            "phase": 3, "task_name": task_name, "template_type": template_type,
            "bg_keywords": bg_keywords, "aspect_ratio": aspect_ratio, "image_size": size,
            "image_backend": image_backend, "style_prefix": style_prefix,
            "manual_safety_retry": safety_rewrite_prompt,
            "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "backgrounds": bg_log,
        }, ensure_ascii=False, indent=2), encoding="utf-8")
        return saved

    # ── Phase 4：融合成图 ──────────────────────────────────────────────────────

    def _phase4(self, params: dict, on_progress: Callable) -> dict:
        task_name       = params["task_name"].strip()
        char_image_path = params["char_image_path"].strip()
        bg_image_path   = params["bg_image_path"].strip()
        template_type   = params.get("template_type", "2d")
        output_count    = int(params.get("output_count", 3))
        aspect_ratio    = params.get("aspect_ratio", "16:9")
        image_backend   = params.get("image_backend", "seedream")
        safety_rewrite_prompt = bool(params.get("safety_rewrite_prompt", False))

        output_dir = OUTPUT_BASE / task_name / "phase04"
        output_dir.mkdir(parents=True, exist_ok=True)

        on_progress(15, "AI 分析角色与背景，生成融合方案...")
        fusion_prompt = self._gen_fusion_prompt(char_image_path, bg_image_path, template_type)

        on_progress(35, f"提交 {image_backend} 融合生成（共 {output_count} 张）...")
        saved = self._run_fusion_batch(
            char_image_path, bg_image_path, fusion_prompt,
            template_type, aspect_ratio, output_count, image_backend, safety_rewrite_prompt, output_dir, on_progress,
        )
        return {"output_dir": str(output_dir), "output_files": saved}

    def _gen_fusion_prompt(self, char_path: str, bg_path: str, template_type: str) -> str:
        if not API_KEY:
            raise RuntimeError("未配置 ANTHROPIC_API_KEY")

        char_bytes, char_mime = read_image(char_path)
        bg_bytes, bg_mime = read_image(bg_path)
        style_hint = "2D美式卡通Q版" if template_type == "2d" else "3D皮克斯卡通渲染"

        resp = httpx.post(
            CHAT_URL,
            headers={"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"},
            json={
                "model": CHAT_MODEL, "max_tokens": 1024,
                "thinking": {"type": "disabled"},
                "messages": [{"role": "user", "content": [
                    {"type": "image_url", "image_url": {"url": f"data:{char_mime};base64,{base64.b64encode(char_bytes).decode()}"}},
                    {"type": "image_url", "image_url": {"url": f"data:{bg_mime};base64,{base64.b64encode(bg_bytes).decode()}"}},
                    {"type": "text", "text": (
                        f"你是宣发图合成专家。图1是角色姿态图（纯白底），图2是背景场景图（无角色）。\n"
                        f"风格：{style_hint}。生成200-250字融合合成提示词，描述：\n"
                        "角色位置与比例、光影方向统一、透视一致、前景文案留白区域、整体氛围。\n"
                        "直接输出提示词，不加说明。"
                    )},
                ]}],
            },
            timeout=90,
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"].strip()

    def _run_fusion_batch(self, char_path: str, bg_path: str, fusion_prompt: str,
                          template_type: str, aspect_ratio: str, count: int,
                          image_backend: str, safety_rewrite_prompt: bool, output_dir: Path, on_progress: Callable) -> list[str]:
        backend = get_backend(image_backend)
        char_bytes, char_mime = read_image(char_path)
        bg_bytes, bg_mime = read_image(bg_path)

        size = SIZE_MAP.get(aspect_ratio, "2048x2048")
        style_prefix = "2D美式卡通Q版宣发主视觉，" if template_type == "2d" else "3D皮克斯卡通渲染宣发主视觉，"
        full_prompt = f"{style_prefix}角色与背景融合，{fusion_prompt}"
        task_name = output_dir.parent.name
        saved = []

        for idx in range(count):
            pct = 35 + int(idx / count * 60)
            on_progress(pct, f"融合生成 {idx + 1}/{count}...")
            if image_backend == "gpt-image-2" and safety_rewrite_prompt:
                full_prompt = sanitize_image_prompt_for_safety(
                    user_prompt=full_prompt,
                    has_reference=True,
                    target_model="gpt-image-2",
                    refusal_message="manual safety retry requested by user",
                )["sanitized_prompt"].strip()
            img_bytes = backend.generate(
                prompt=full_prompt,
                ref_images=[char_bytes, bg_bytes],
                ref_mimetypes=[char_mime, bg_mime],
                size=size,
                aspect_ratio=aspect_ratio,
            )
            fname = f"phase04_{idx + 1:03d}_fusion.png"
            (output_dir / fname).write_bytes(img_bytes)
            saved.append(str(output_dir / fname))
            if image_backend in ("gemini", "gpt-image-2") and idx < count - 1:
                time.sleep(8)

        from datetime import datetime, timezone
        (output_dir / "phase04_run.json").write_text(json.dumps({
            "phase": 4, "task_name": task_name, "template_type": template_type,
            "aspect_ratio": aspect_ratio, "image_size": size, "image_backend": image_backend,
            "manual_safety_retry": safety_rewrite_prompt,
            "char_image": char_path, "bg_image": bg_path,
            "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "fusion_prompt": fusion_prompt,
            "full_prompt": full_prompt,
            "output_files": [f"phase04_{i + 1:03d}_fusion.png" for i in range(count)],
        }, ensure_ascii=False, indent=2), encoding="utf-8")
        return saved
