#!/usr/bin/env python3
"""
Gera o dataset de treino LOCALMENTE na Pod (sem serverless, sem 502).
Usa o ComfyUI + modelos do volume e o âncora já salvo em ComfyUI/input/.

Uso (na pod, com o volume montado):
  export WORKSPACE=/workspace
  wget -qO /tmp/gen.py https://raw.githubusercontent.com/originslone-sys/egglee/claude/inspiring-ramanujan-j5qm8z/training/generate_dataset.py
  python3 /tmp/gen.py 36

Pré-requisito: já ter gerado ao menos 1 imagem FaceID no painel com a foto
âncora (assim o âncora fica salvo em ComfyUI/input/). O script usa o input
mais recente como âncora — confirme que é a foto certa.
"""
import os, sys, json, time, glob, random, shutil, subprocess, urllib.request

WORKSPACE = os.environ.get("WORKSPACE", "/workspace")
COMFY = os.path.join(WORKSPACE, "ComfyUI")
URL = "http://127.0.0.1:8188"
RAW = "https://raw.githubusercontent.com/originslone-sys/egglee/claude/inspiring-ramanujan-j5qm8z"
TRIGGER = "eg1woman"
DEST = os.path.join(WORKSPACE, "egglee-train", "img", "10_" + TRIGGER)
PREFIX = "dsimg"
N = int(sys.argv[1]) if len(sys.argv) > 1 else 36
ANCHOR_ARG = sys.argv[2] if len(sys.argv) > 2 else None

PROMPTS = [
    "closeup portrait, looking at camera, neutral expression, soft daylight",
    "closeup portrait, gentle smile, natural window light",
    "face closeup, three quarter view, looking away",
    "face closeup, side profile, soft lighting",
    "closeup, laughing, candid expression",
    "closeup, serious expression, direct gaze",
    "upper body, bedroom mirror selfie, black crop top",
    "upper body, standing by the window, white t-shirt",
    "upper body, outdoors, golden hour sunlight",
    "upper body, cafe background, casual sweater",
    "half body, sitting on bed, oversized hoodie",
    "half body, kitchen background, tank top",
    "portrait, hair tied back, gym outfit",
    "portrait, hair down, evening indoor light",
    "portrait, looking over shoulder, casual top",
    "portrait, soft shadows, plain wall background",
    "upper body, beach background, summer top",
    "upper body, car selfie, daylight",
    "portrait, slight smile, freckles visible, daylight",
    "portrait, looking up, natural light",
    "half body, living room, jeans and t-shirt",
    "upper body, balcony, city background",
    "portrait, overcast soft light, neutral makeup",
    "closeup, eyes detail, catchlight in eyes",
    "upper body, park background, light jacket",
    "portrait, warm indoor lamp light",
    "half body, bedroom, casual loungewear",
    "upper body, studio softbox lighting, plain background",
    "portrait, windblown hair, outdoor daylight",
    "upper body, mirror selfie, sporty outfit",
    "portrait, relaxed expression, morning light",
    "closeup, natural skin texture, soft focus background",
    "upper body, bookshelf background, cardigan",
    "portrait, candid laugh, sunlight",
    "half body, standing, hallway background",
    "upper body, plain studio, confident pose",
]


def http_get(path):
    return urllib.request.urlopen(URL + path, timeout=15).read()


def comfy_up():
    try:
        http_get("/system_stats")
        return True
    except Exception:
        return False


def load_json(local, raw_path):
    if local and os.path.isfile(local):
        return json.load(open(local))
    return json.loads(urllib.request.urlopen(RAW + "/" + raw_path, timeout=20).read())


def main():
    os.makedirs(DEST, exist_ok=True)

    if not comfy_up():
        print("== Instalando dependências do ComfyUI (uma vez, pode demorar) ==")
        subprocess.run([sys.executable, "-m", "pip", "install", "-q", "-r",
                        os.path.join(COMFY, "requirements.txt")])
        subprocess.run([sys.executable, "-m", "pip", "install", "-q",
                        "insightface", "onnxruntime", "ultralytics", "dill"])
        print("== Iniciando ComfyUI ==")
        subprocess.Popen([sys.executable, "main.py", "--listen", "127.0.0.1",
                          "--port", "8188", "--disable-auto-launch"], cwd=COMFY)
        for _ in range(240):
            if comfy_up():
                break
            time.sleep(2)
        else:
            print("ComfyUI não iniciou."); sys.exit(1)
    print("ComfyUI pronto.")

    wf = load_json(os.path.join(WORKSPACE, "workflows", "txt2img_faceid.json"),
                   "workflows/txt2img_faceid.json")
    char = load_json(None, "characters/model.json")

    # Âncora: argumento, ou o input_*.png mais recente
    if ANCHOR_ARG:
        anchor = os.path.basename(ANCHOR_ARG)
    else:
        cands = sorted(glob.glob(os.path.join(COMFY, "input", "input_*.png")),
                       key=os.path.getmtime)
        if not cands:
            print("Nenhum âncora em ComfyUI/input/. Gere 1 imagem FaceID no painel "
                  "com a foto âncora primeiro."); sys.exit(1)
        anchor = os.path.basename(cands[-1])
    print("Âncora:", anchor)

    base_pos = char.get("positive_prompt", "")
    base_neg = char.get("negative_prompt", "")

    made = 0
    for i in range(N):
        scene = PROMPTS[i % len(PROMPTS)]
        pos = f"{base_pos}, {scene}" if base_pos else scene
        sub = {"positive_prompt": pos, "negative_prompt": base_neg,
               "seed": random.randint(0, 2**32 - 1), "batch_size": 1,
               "face_image": anchor}
        g = json.loads(json.dumps(wf))
        for node in g.values():
            ins = node.get("inputs", {})
            for k, v in list(ins.items()):
                if isinstance(v, str) and v.startswith("{{") and v.endswith("}}"):
                    ins[k] = sub.get(v[2:-2].strip(), v)
            if node.get("class_type") == "SaveImage":
                node["inputs"]["filename_prefix"] = PREFIX

        body = json.dumps({"prompt": g}).encode()
        req = urllib.request.Request(URL + "/prompt", data=body,
                                     headers={"Content-Type": "application/json"})
        try:
            pid = json.loads(urllib.request.urlopen(req).read())["prompt_id"]
        except Exception as e:
            print(f"  {i+1}/{N} erro ao enviar: {e}"); continue

        for _ in range(300):
            try:
                h = json.loads(http_get(f"/history/{pid}"))
                if pid in h:
                    break
            except Exception:
                pass
            time.sleep(2)
        made += 1
        print(f"  {made}/{N} ok")

    out = os.path.join(COMFY, "output")
    files = sorted(glob.glob(os.path.join(out, PREFIX + "*.png")),
                   key=os.path.getmtime)[-made:]
    for f in files:
        shutil.copy(f, DEST)
    print(f"\n✅ {len(files)} imagens em {DEST}")
    print("   Revise com review.py e depois rode train.sh")


if __name__ == "__main__":
    main()
