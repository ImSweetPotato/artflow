import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from skills.base import BaseSkill
from services.image_backend import get_backend, read_image
from services.llm import improve_image_prompt, sanitize_image_prompt_for_safety

OUTPUT_BASE = Path("outputs/gptimage2")
OUTPUT_BASE.mkdir(parents=True, exist_ok=True)


class GptImage2Skill(BaseSkill):

    @classmethod
    def skill_id(cls) -> str:
        return "gptimage2"

    @classmethod
    def display_name(cls) -> str:
        return "GPT-Image-2 生图"

    @classmethod
    def description(cls) -> str:
        return "直接调用 GPT-Image-2，支持文生图和图生图，异步队列执行，支持手动安全重试"

    @classmethod
    def input_schema(cls) -> dict:
        return {
            "type": "object",
            "properties": {
                "task_name":        {"type": "string",  "title": "任务名称"},
                "prompt":           {"type": "string",  "title": "提示词"},
                "image_path":       {"type": "string",  "title": "参考图路径（单图，兼容旧接口）"},
                "image_paths":      {"type": "array",   "title": "参考图路径列表（多图，优先于 image_path）", "items": {"type": "string"}},
                "output_count":     {"type": "integer", "title": "生成数量", "default": 1, "minimum": 1, "maximum": 4},
                "aspect_ratio":     {"type": "string",  "title": "画面比例", "enum": ["", "auto", "1:1", "3:4", "4:3", "9:16", "16:9"], "default": "auto"},
                "enable_thinking":  {"type": "boolean", "title": "开启思考模式（GPT-5 优化提示词）", "default": False},
                "reasoning_effort": {"type": "string",  "title": "思考强度", "enum": ["low", "medium", "high"], "default": "medium"},
            },
            "required": ["task_name", "prompt"],
        }

    def execute(
        self,
        params: dict,
        on_progress: Callable[[int, str], None],
        runtime_context: dict | None = None,
    ) -> dict:
        task_name        = params.get("task_name", "").strip()
        prompt           = params.get("prompt", "").strip()
        output_count     = max(1, min(4, int(params.get("output_count", 1))))
        aspect_ratio     = params.get("aspect_ratio", "auto")
        enable_thinking  = bool(params.get("enable_thinking", False))
        reasoning_effort = params.get("reasoning_effort", "medium")
        safety_rewrite_prompt = bool(params.get("safety_rewrite_prompt", False))

        # 多图优先，兼容旧单图字段
        raw_paths: list[str] = params.get("image_paths") or []
        if not raw_paths and params.get("image_path"):
            raw_paths = [(params["image_path"] or "").strip()]
        image_paths = [p.strip() for p in raw_paths if p and p.strip()]

        if not task_name:
            raise ValueError("缺少 task_name")
        if not prompt:
            raise ValueError("缺少 prompt")

        safe = re.sub(r'[\\/:*?"<>|]+', "_", task_name).strip("._") or "task"
        output_dir = OUTPUT_BASE / safe
        output_dir.mkdir(parents=True, exist_ok=True)

        # ── 思考阶段（可选）：用 GPT-5 优化 prompt ──
        thinking_meta: dict[str, Any] | None = None
        original_prompt = prompt
        if enable_thinking:
            on_progress(2, "GPT-5 思考优化提示词中...")
            try:
                result = improve_image_prompt(
                    user_prompt=prompt,
                    has_reference=bool(image_paths),
                    target_model="gpt-image-2",
                    reasoning_effort=reasoning_effort,
                )
                prompt = result["optimized_prompt"]
                thinking_meta = {
                    "model":            result["model"],
                    "duration_ms":      result["duration_ms"],
                    "thinking_content": result["thinking_content"],
                    "original_prompt":  result["original_prompt"],
                    "optimized_prompt": result["optimized_prompt"],
                    "reasoning_effort": reasoning_effort,
                }
                dur_s = result["duration_ms"] / 1000
                on_progress(8, f"思考完成（{dur_s:.1f}s），开始生图...")
            except Exception as e:
                # 思考失败不阻断生图，回退到原始 prompt
                print(f"[gptimage2] thinking failed, fallback to original prompt: {e}", file=sys.stderr)
                on_progress(8, f"思考失败，回退原始提示词：{e}")

        manual_safety_retry_meta: dict[str, Any] | None = None
        if safety_rewrite_prompt:
            on_progress(10, "正在按安全模式简化提示词...")
            rewrite = sanitize_image_prompt_for_safety(
                user_prompt=prompt,
                has_reference=bool(image_paths),
                target_model="gpt-image-2",
                refusal_message="manual safety retry requested by user",
            )
            prompt = (rewrite.get("sanitized_prompt") or prompt).strip()
            manual_safety_retry_meta = {
                "enabled": True,
                "reason": rewrite.get("reason"),
                "model": rewrite.get("model"),
                "original_prompt": original_prompt,
                "sanitized_prompt": prompt,
            }

        # ── 读参考图 ──
        ref_images: list[bytes] = []
        ref_mimetypes: list[str] = []
        if image_paths:
            on_progress(10, f"读取 {len(image_paths)} 张参考图...")
            for p in image_paths:
                b, m = read_image(p)
                ref_images.append(b)
                ref_mimetypes.append(m)

        # ── 生图 ──
        backend = get_backend("gpt-image-2", api_key=(runtime_context or {}).get("sofunny_api_key"))
        saved = []

        for i in range(output_count):
            pct = 15 + int(i / output_count * 80)
            mode = "图生图" if ref_images else "文生图"
            on_progress(pct, f"GPT-Image-2 {mode} {i + 1}/{output_count}...")

            img_bytes = backend.generate(
                prompt=prompt,
                ref_images=ref_images if ref_images else None,
                ref_mimetypes=ref_mimetypes if ref_mimetypes else None,
                aspect_ratio=aspect_ratio,
                on_retry=on_progress,
            )
            fname = f"{i + 1:03d}.png"
            (output_dir / fname).write_bytes(img_bytes)
            saved.append(str(output_dir / fname))

        (output_dir / "run.json").write_text(json.dumps({
            "skill": "gptimage2",
            "task_name": task_name,
            "prompt": prompt,
            "original_prompt": original_prompt if enable_thinking else None,
            "image_paths": image_paths,
            "output_count": output_count,
            "aspect_ratio": aspect_ratio,
            "thinking": thinking_meta,
            "manual_safety_retry": manual_safety_retry_meta,
            "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "output_files": [Path(f).name for f in saved],
        }, ensure_ascii=False, indent=2), encoding="utf-8")

        on_progress(100, "生成完成")
        return {
            "output_dir": str(output_dir),
            "output_files": saved,
            "thinking": thinking_meta,
            "manual_safety_retry": manual_safety_retry_meta,
        }
