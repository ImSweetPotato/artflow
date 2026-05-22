import json
import os
import re
import shutil
import time
import uuid
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable

import httpx

from skills.base import BaseSkill


COMFYUI_BASE_URL = os.getenv("COMFYUI_BASE_URL", "http://cf.funnyland.io:8188").rstrip("/")
WORKFLOW_DIR = Path("workflows/comfyui/pet-traveler")
DEFAULT_WORKFLOW_PATH = WORKFLOW_DIR / "flux_图文生图_原图局部修改.json"
OUTPUT_BASE = Path("outputs/comfyui_pet_traveler")
OUTPUT_BASE.mkdir(parents=True, exist_ok=True)


class ComfyUiPetTravelerSkill(BaseSkill):
    @classmethod
    def skill_id(cls) -> str:
        return "comfyui_pet_traveler"

    @classmethod
    def display_name(cls) -> str:
        return "萌宠旅人"

    @classmethod
    def description(cls) -> str:
        return "调用 ComfyUI Flux Kontext 工作流，支持参考图局部修改与提示词翻译编码"

    @classmethod
    def input_schema(cls) -> dict:
        return {
            "type": "object",
            "properties": {
                "task_name": {"type": "string", "title": "任务名称"},
                "image_path": {"type": "string", "title": "参考图路径"},
                "prompt": {"type": "string", "title": "提示词"},
                "output_count": {"type": "integer", "title": "生成数量", "default": 1, "minimum": 1, "maximum": 4},
                "seed": {"type": "integer", "title": "Seed", "default": -1},
                "steps": {"type": "integer", "title": "采样步数", "default": 20, "minimum": 1, "maximum": 80},
                "cfg": {"type": "number", "title": "CFG", "default": 1, "minimum": 0, "maximum": 20},
                "denoise": {"type": "number", "title": "重绘强度", "default": 1, "minimum": 0, "maximum": 1},
                "guidance": {"type": "number", "title": "Flux 引导", "default": 2.5, "minimum": 0, "maximum": 20},
                "sampler_name": {"type": "string", "title": "采样器", "default": "euler"},
                "scheduler": {"type": "string", "title": "调度器", "default": "simple"},
                "from_translate": {"type": "string", "title": "源语言", "default": "chinese (simplified)"},
                "to_translate": {"type": "string", "title": "目标语言", "default": "english"},
                "translation_service": {"type": "string", "title": "翻译服务", "default": "GoogleTranslator"},
                "stitch_direction": {"type": "string", "title": "拼接方向", "default": "right"},
                "match_image_size": {"type": "boolean", "title": "匹配图片尺寸", "default": True},
                "spacing_width": {"type": "integer", "title": "拼接间距", "default": 0, "minimum": 0, "maximum": 256},
                "spacing_color": {"type": "string", "title": "间距颜色", "default": "white"},
            },
            "required": ["task_name", "image_path", "prompt"],
        }

    def execute(
        self,
        params: dict,
        on_progress: Callable[[int, str], None],
        runtime_context: dict | None = None,
    ) -> dict:
        task_name = str(params.get("task_name") or "").strip()
        image_path = str(params.get("image_path") or "").strip()
        prompt = str(params.get("prompt") or "").strip()
        output_count = max(1, min(4, int(params.get("output_count") or 1)))

        if not task_name:
            raise ValueError("缺少 task_name")
        if not image_path:
            raise ValueError("缺少 image_path")
        if not prompt:
            raise ValueError("缺少 prompt")
        workflow_path = self._workflow_path()
        if not workflow_path.exists():
            raise FileNotFoundError(f"未找到 ComfyUI workflow: {workflow_path}")

        safe = re.sub(r'[\\/:*?"<>|]+', "_", task_name).strip("._") or "task"
        output_dir = OUTPUT_BASE / safe
        output_dir.mkdir(parents=True, exist_ok=True)

        workflow = json.loads(workflow_path.read_text(encoding="utf-8"))
        uploaded_name = self._upload_image(image_path, on_progress)

        saved: list[str] = []
        run_log: list[dict] = []
        base_seed = int(params.get("seed") if params.get("seed") is not None else -1)

        for index in range(output_count):
            seed = base_seed
            if seed < 0:
                seed = int(time.time() * 1000) % 9007199254740991
            elif index > 0:
                seed += index

            prompt_graph = self._build_prompt(workflow, params, prompt, uploaded_name, seed)
            pct = 15 + int(index / output_count * 75)
            on_progress(pct, f"提交 ComfyUI 工作流 {index + 1}/{output_count}...")

            prompt_id = self._queue_prompt(prompt_graph)
            on_progress(pct + 3, f"ComfyUI 执行中：{prompt_id}")
            image_refs = self._wait_for_outputs(prompt_id, on_progress)
            if not image_refs:
                raise RuntimeError("ComfyUI 执行完成，但未返回输出图片")

            for img_idx, ref in enumerate(image_refs):
                data = self._download_output(ref)
                out_path = output_dir / f"{index + 1:03d}_{img_idx + 1:02d}.png"
                out_path.write_bytes(data)
                saved.append(str(out_path))

            run_log.append({"prompt_id": prompt_id, "seed": seed, "outputs": image_refs})

        shutil.copyfile(workflow_path, output_dir / "workflow.json")
        (output_dir / "run.json").write_text(json.dumps({
            "skill": self.skill_id(),
            "task_name": task_name,
            "prompt": prompt,
            "image_path": image_path,
            "comfyui_base_url": COMFYUI_BASE_URL,
            "workflow_path": str(workflow_path),
            "params": self._serializable_params(params),
            "runs": run_log,
            "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "output_files": [Path(f).name for f in saved],
        }, ensure_ascii=False, indent=2), encoding="utf-8")

        on_progress(100, "ComfyUI 生成完成")
        return {
            "output_dir": str(output_dir),
            "output_files": saved,
            "comfyui_runs": run_log,
        }

    def _build_prompt(self, workflow: dict, params: dict, prompt: str, image_name: str, seed: int) -> dict:
        graph = deepcopy(workflow)

        graph["190"]["inputs"]["image"] = image_name

        text_inputs = graph["199"]["inputs"]
        text_inputs["text"] = prompt
        text_inputs["from_translate"] = str(params.get("from_translate") or "chinese (simplified)")
        text_inputs["to_translate"] = str(params.get("to_translate") or "english")
        text_inputs["service"] = str(params.get("translation_service") or "GoogleTranslator")

        sampler_inputs = graph["31"]["inputs"]
        sampler_inputs["seed"] = seed
        sampler_inputs["steps"] = int(params.get("steps") or 20)
        sampler_inputs["cfg"] = float(params.get("cfg") if params.get("cfg") is not None else 1)
        sampler_inputs["denoise"] = float(params.get("denoise") if params.get("denoise") is not None else 1)
        sampler_inputs["sampler_name"] = str(params.get("sampler_name") or "euler")
        sampler_inputs["scheduler"] = str(params.get("scheduler") or "simple")

        graph["35"]["inputs"]["guidance"] = float(params.get("guidance") if params.get("guidance") is not None else 2.5)

        stitch_inputs = graph["146"]["inputs"]
        stitch_inputs["direction"] = str(params.get("stitch_direction") or "right")
        stitch_inputs["match_image_size"] = bool(params.get("match_image_size", True))
        stitch_inputs["spacing_width"] = int(params.get("spacing_width") or 0)
        stitch_inputs["spacing_color"] = str(params.get("spacing_color") or "white")

        graph["136"]["inputs"]["filename_prefix"] = f"artflow/pet_traveler_{uuid.uuid4().hex[:10]}"
        return graph

    def _upload_image(self, image_path: str, on_progress: Callable[[int, str], None]) -> str:
        path = Path(image_path)
        if not path.exists():
            raise FileNotFoundError(f"参考图不存在: {image_path}")
        on_progress(8, "上传参考图到 ComfyUI...")
        with path.open("rb") as f:
            files = {"image": (path.name, f, self._mime(path))}
            data = {"overwrite": "true", "type": "input"}
            resp = httpx.post(f"{COMFYUI_BASE_URL}/upload/image", files=files, data=data, timeout=120)
        resp.raise_for_status()
        payload = resp.json()
        return str(payload.get("name") or path.name)

    def _queue_prompt(self, prompt_graph: dict) -> str:
        client_id = f"artflow-{uuid.uuid4()}"
        resp = httpx.post(
            f"{COMFYUI_BASE_URL}/prompt",
            json={"prompt": prompt_graph, "client_id": client_id},
            timeout=60,
        )
        if not resp.is_success:
            raise RuntimeError(f"ComfyUI 提交失败: HTTP {resp.status_code} {resp.text[:500]}")
        prompt_id = resp.json().get("prompt_id")
        if not prompt_id:
            raise RuntimeError(f"ComfyUI 未返回 prompt_id: {resp.text[:500]}")
        return str(prompt_id)

    def _wait_for_outputs(self, prompt_id: str, on_progress: Callable[[int, str], None]) -> list[dict]:
        started = time.time()
        while time.time() - started < 900:
            resp = httpx.get(f"{COMFYUI_BASE_URL}/history/{prompt_id}", timeout=60)
            resp.raise_for_status()
            history = resp.json().get(prompt_id)
            if history:
                status = ((history.get("status") or {}).get("status_str") or "").lower()
                if status and status not in {"success", "running", "pending"}:
                    messages = history.get("status", {}).get("messages") or []
                    raise RuntimeError(f"ComfyUI 执行失败: {status} {messages}")

                refs: list[dict] = []
                outputs = history.get("outputs") or {}
                output_nodes = [outputs["136"]] if "136" in outputs else list(outputs.values())
                for node_output in output_nodes:
                    for item in node_output.get("images") or []:
                        refs.append({
                            "filename": item.get("filename"),
                            "subfolder": item.get("subfolder", ""),
                            "type": item.get("type", "output"),
                        })
                if refs:
                    return refs

            elapsed = int(time.time() - started)
            pct = min(95, 20 + elapsed // 6)
            on_progress(pct, f"等待 ComfyUI 输出... {elapsed}s")
            time.sleep(3)
        raise TimeoutError("ComfyUI 执行超时，超过 15 分钟未返回结果")

    def _download_output(self, ref: dict) -> bytes:
        resp = httpx.get(f"{COMFYUI_BASE_URL}/view", params={
            "filename": ref.get("filename"),
            "subfolder": ref.get("subfolder") or "",
            "type": ref.get("type") or "output",
        }, timeout=120)
        resp.raise_for_status()
        return resp.content

    def _mime(self, path: Path) -> str:
        return {
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".webp": "image/webp",
        }.get(path.suffix.lower(), "image/png")

    def _workflow_path(self) -> Path:
        workflow_json = WORKFLOW_DIR / "workflow.json"
        if workflow_json.exists():
            return workflow_json
        if DEFAULT_WORKFLOW_PATH.exists():
            return DEFAULT_WORKFLOW_PATH
        matches = sorted(WORKFLOW_DIR.glob("*.json"))
        return matches[0] if matches else workflow_json

    def _serializable_params(self, params: dict) -> dict:
        return {k: v for k, v in params.items() if isinstance(v, (str, int, float, bool, list, dict, type(None)))}
