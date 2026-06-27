import runpod
import json
import time
import requests
import subprocess
import base64
import uuid
import copy
import random
import os
from pathlib import Path

COMFYUI_URL = "http://127.0.0.1:8188"
WORKSPACE = Path(os.environ.get("WORKSPACE", "/runpod-volume"))
COMFYUI_DIR = WORKSPACE / "ComfyUI"
OUTPUT_DIR = COMFYUI_DIR / "output"
INPUT_DIR = COMFYUI_DIR / "input"
# Image-baked workflows/characters take precedence so they always match the
# repo (the volume may hold stale copies from an earlier setup run).
WORKFLOW_DIRS = [Path("/workflows"), WORKSPACE / "workflows"]
CHARACTERS_DIRS = [Path("/characters"), WORKSPACE / "characters"]

DEFAULT_NEGATIVE = (
    "plastic skin, airbrushed, smooth skin, cgi, 3d render, doll, caricature, "
    "oversaturated, overexposed, dramatic makeup, heavy makeup, worst quality, "
    "low quality, blurry, deformed, ugly, bad anatomy, bad hands, extra fingers, "
    "missing fingers, watermark, signature, text"
)


def wait_for_comfyui(timeout=300):
    start = time.time()
    while time.time() - start < timeout:
        try:
            r = requests.get(f"{COMFYUI_URL}/system_stats", timeout=5)
            if r.status_code == 200:
                print("ComfyUI ready")
                return
        except Exception:
            pass
        time.sleep(2)
    raise RuntimeError("ComfyUI failed to start within timeout")


def queue_prompt(workflow: dict, client_id: str) -> str:
    r = requests.post(
        f"{COMFYUI_URL}/prompt",
        json={"prompt": workflow, "client_id": client_id},
    )
    r.raise_for_status()
    return r.json()["prompt_id"]


def wait_for_completion(prompt_id: str, timeout: int = 600) -> dict:
    start = time.time()
    while time.time() - start < timeout:
        r = requests.get(f"{COMFYUI_URL}/history/{prompt_id}")
        if r.status_code == 200:
            history = r.json()
            if prompt_id in history:
                return history[prompt_id]
        time.sleep(2)
    raise TimeoutError(f"Job {prompt_id} timed out after {timeout}s")


def collect_outputs(job_history: dict) -> list:
    outputs = []
    for node_output in job_history.get("outputs", {}).values():
        for img in node_output.get("images", []):
            subdir = img.get("subfolder", "")
            path = OUTPUT_DIR / subdir / img["filename"] if subdir else OUTPUT_DIR / img["filename"]
            if path.exists():
                data = base64.b64encode(path.read_bytes()).decode()
                outputs.append({"type": "image", "filename": img["filename"], "data": data})

        for vid in node_output.get("videos", []):
            subdir = vid.get("subfolder", "")
            path = OUTPUT_DIR / subdir / vid["filename"] if subdir else OUTPUT_DIR / vid["filename"]
            if path.exists():
                data = base64.b64encode(path.read_bytes()).decode()
                outputs.append({"type": "video", "filename": vid["filename"], "data": data})

    return outputs


def inject_inputs(workflow: dict, inputs: dict) -> dict:
    wf = copy.deepcopy(workflow)
    for node in wf.values():
        node_inputs = node.get("inputs", {})
        for key, value in list(node_inputs.items()):
            if isinstance(value, str) and value.startswith("{{") and value.endswith("}}"):
                param = value[2:-2].strip()
                if param in inputs:
                    node_inputs[key] = inputs[param]
    return wf


def load_workflow(name: str) -> dict:
    for d in WORKFLOW_DIRS:
        path = d / f"{name}.json"
        if path.exists():
            return json.loads(path.read_text())
    raise FileNotFoundError(f"Workflow '{name}' not found")


def load_character(name: str) -> dict:
    for d in CHARACTERS_DIRS:
        path = d / f"{name}.json"
        if path.exists():
            return json.loads(path.read_text())
    raise FileNotFoundError(f"Character '{name}' not found")


def apply_character(inputs: dict, character: dict) -> dict:
    base_positive = character.get("positive_prompt", "")
    base_negative = character.get("negative_prompt", "")
    scene_positive = inputs.get("positive_prompt", "")
    scene_negative = inputs.get("negative_prompt", "")

    if base_positive and scene_positive:
        inputs["positive_prompt"] = f"{base_positive}, {scene_positive}"
    elif base_positive:
        inputs["positive_prompt"] = base_positive

    if base_negative and scene_negative:
        inputs["negative_prompt"] = f"{base_negative}, {scene_negative}"
    elif base_negative:
        inputs["negative_prompt"] = base_negative

    return inputs


def save_input_image(b64_data: str) -> str:
    INPUT_DIR.mkdir(parents=True, exist_ok=True)
    img_bytes = base64.b64decode(b64_data)
    filename = f"input_{uuid.uuid4().hex[:8]}.png"
    (INPUT_DIR / filename).write_bytes(img_bytes)
    return filename


def handler(job):
    job_input = job["input"]

    try:
        if "workflow" in job_input:
            workflow = job_input["workflow"]
        elif "workflow_name" in job_input:
            workflow = load_workflow(job_input["workflow_name"])
        else:
            return {"error": "Provide 'workflow' (full JSON) or 'workflow_name'"}

        inputs = dict(job_input.get("inputs", {}))

        # Apply character profile if specified
        if "character" in job_input:
            character = load_character(job_input["character"])
            inputs = apply_character(inputs, character)

        # Garante um negativo padrão (os workflows usam {{negative_prompt}})
        if not inputs.get("negative_prompt"):
            inputs["negative_prompt"] = DEFAULT_NEGATIVE

        # Quantidade de imagens (os workflows usam {{batch_size}})
        try:
            inputs["batch_size"] = max(1, min(8, int(inputs.get("batch_size", 1))))
        except (TypeError, ValueError):
            inputs["batch_size"] = 1

        # Handle seed: -1 or missing → random
        if inputs.get("seed", -1) == -1:
            inputs["seed"] = random.randint(0, 2**32 - 1)

        # Handle any base64 input image (e.g. input_image_b64, face_image_b64)
        # → save to ComfyUI input dir and expose the filename under the base key.
        for key in [k for k in list(inputs) if k.endswith("_b64")]:
            inputs[key[:-4]] = save_input_image(inputs.pop(key))

        if inputs:
            workflow = inject_inputs(workflow, inputs)

        client_id = str(uuid.uuid4())
        prompt_id = queue_prompt(workflow, client_id)
        print(f"Queued: {prompt_id}")

        timeout = job_input.get("timeout", 600)
        history = wait_for_completion(prompt_id, timeout)

        status = history.get("status", {})
        if status.get("status_str") == "error":
            return {"error": "Execution failed", "messages": status.get("messages", [])}

        return {
            "status": "success",
            "prompt_id": prompt_id,
            "outputs": collect_outputs(history),
        }

    except Exception as e:
        return {"error": str(e)}


# ── Startup ───────────────────────────────────────────────────────────────────

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
INPUT_DIR.mkdir(parents=True, exist_ok=True)
(WORKSPACE / "characters").mkdir(parents=True, exist_ok=True)

print("Starting ComfyUI...")
subprocess.Popen(
    [
        "python", "main.py",
        "--listen", "0.0.0.0",
        "--port", "8188",
        "--disable-auto-launch",
        "--output-directory", str(OUTPUT_DIR),
    ],
    cwd=str(COMFYUI_DIR),
)
wait_for_comfyui()
print("Worker ready.")

runpod.serverless.start({"handler": handler})
