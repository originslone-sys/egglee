#!/usr/bin/env python3
"""Auto-legenda do dataset para o treino do LoRA v2.

Princípio: o que é DESCRITO na legenda é "fatorado pra fora" do gatilho.
Descrevemos celular/espelho/pose/roupa/cenário pra eles saírem do `eg1woman`
(que deve carregar só a identidade). Usa o WD14 tagger (bom em tags concretas).

Fluxo:
  1) descompacta o dataset.zip
  2) gera <imagem>.txt com:  eg1woman, <tags descritivas>
Depois: revise em caption_editor.py e treine com train.sh.

Rodar na pod (com GPU):
  export WORKSPACE=/workspace
  pip install -q onnxruntime-gpu huggingface_hub pillow numpy
  python caption.py
"""
import os
import csv
import zipfile
import shutil
import glob

import numpy as np
from PIL import Image
import onnxruntime as ort
from huggingface_hub import hf_hub_download

WORKSPACE = os.environ.get("WORKSPACE", "/workspace")
TRAIN_DIR = f"{WORKSPACE}/egglee-train"
ZIP = f"{TRAIN_DIR}/dataset.zip"
OUT = f"{TRAIN_DIR}/captioned"
TRIGGER = "eg1woman"
THRESH = 0.35
WD14_REPO = "SmilingWolf/wd-v1-4-moat-tagger-v2"

# Tags genéricas/de identidade que NÃO queremos na legenda (deixamos no gatilho).
BLOCK = {
    "1girl", "solo", "realistic", "photorealistic", "blurry", "depth of field",
    "lips", "looking at viewer", "portrait", "female", "woman", "asian",
}

IMG_EXT = (".png", ".jpg", ".jpeg", ".webp")


def unzip_dataset():
    if not os.path.exists(ZIP):
        raise SystemExit(f"❌ {ZIP} não encontrado. Faça o upload do dataset.zip primeiro.")
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    os.makedirs(OUT, exist_ok=True)
    tmp = f"{TRAIN_DIR}/_unzip"
    if os.path.isdir(tmp):
        shutil.rmtree(tmp)
    with zipfile.ZipFile(ZIP) as z:
        z.extractall(tmp)
    # achata: move toda imagem pra OUT/ com nome sequencial
    n = 0
    for f in sorted(glob.glob(f"{tmp}/**/*", recursive=True)):
        if f.lower().endswith(IMG_EXT):
            n += 1
            shutil.move(f, os.path.join(OUT, f"img_{n:03d}{os.path.splitext(f)[1].lower()}"))
    shutil.rmtree(tmp)
    if n < 4:
        raise SystemExit(f"❌ Só {n} imagens encontradas no zip.")
    return n


def load_tagger():
    model_path = hf_hub_download(WD14_REPO, "model.onnx")
    tags_path = hf_hub_download(WD14_REPO, "selected_tags.csv")
    names, cats = [], []
    with open(tags_path, newline="") as f:
        for row in csv.DictReader(f):
            names.append(row["name"])
            cats.append(int(row["category"]))
    providers = ["CUDAExecutionProvider", "CPUExecutionProvider"]
    sess = ort.InferenceSession(model_path, providers=providers)
    inp = sess.get_inputs()[0]
    _, H, W, _ = inp.shape
    return sess, inp.name, int(H), int(W), names, cats


def tag_image(sess, in_name, H, W, names, cats, path):
    img = Image.open(path).convert("RGB").resize((W, H))
    arr = np.asarray(img)[:, :, ::-1].astype(np.float32)  # RGB->BGR
    probs = sess.run(None, {in_name: arr[None, ...]})[0][0]
    tags = []
    for name, cat, p in zip(names, cats, probs):
        if cat == 0 and p >= THRESH:           # 0 = tags gerais
            t = name.replace("_", " ")
            if t not in BLOCK:
                tags.append(t)
    return tags


def main():
    print("=== Descompactando dataset ===")
    n = unzip_dataset()
    print(f"  {n} imagens em {OUT}")
    print("=== Carregando WD14 tagger (baixa na 1ª vez) ===")
    sess, in_name, H, W, names, cats = load_tagger()
    print("=== Legendando ===")
    imgs = sorted(f for f in glob.glob(f"{OUT}/*") if f.lower().endswith(IMG_EXT))
    for i, path in enumerate(imgs, 1):
        tags = tag_image(sess, in_name, H, W, names, cats, path)
        caption = TRIGGER + ", " + ", ".join(tags) if tags else TRIGGER
        with open(os.path.splitext(path)[0] + ".txt", "w") as f:
            f.write(caption)
        print(f"  [{i}/{len(imgs)}] {os.path.basename(path)} -> {caption[:80]}")
    print("\n✅ Legendas geradas. Próximo: python caption_editor.py (revisar no navegador)")


if __name__ == "__main__":
    main()
