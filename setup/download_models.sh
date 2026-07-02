#!/bin/bash
# Run this ONCE on a RunPod pod with your Network Volume mounted at /workspace.
# Requires: export CIVITAI_TOKEN=your_token
set -eo pipefail

: "${CIVITAI_TOKEN:?Set CIVITAI_TOKEN before running: export CIVITAI_TOKEN=xxxx}"

WORKSPACE="${WORKSPACE:-/workspace}"
MODELS="$WORKSPACE/ComfyUI/models"

# ── Helpers ───────────────────────────────────────────────────────────────────

civitai_download() {
    local dest_dir=$1
    local model_id=$2
    local filename=$3

    local dest="$dest_dir/$filename"
    if [ -f "$dest" ]; then
        echo "  ⏭️  $filename already exists"
        return 0
    fi

    echo "  ⬇️  Fetching download URL for CivitAI model $model_id..."
    local url
    url=$(curl -sf -H "Authorization: Bearer $CIVITAI_TOKEN" \
        "https://civitai.com/api/v1/models/$model_id" | \
        python3 -c "
import sys, json
data = json.load(sys.stdin)
version = data['modelVersions'][0]
files = version['files']
primary = next((f for f in files if f.get('primary')), files[0])
print(primary['downloadUrl'])
")

    if [ -z "$url" ]; then
        echo "  ❌ Could not get download URL for model $model_id"
        return 1
    fi

    wget -q --show-progress --content-disposition \
        --header="Authorization: Bearer $CIVITAI_TOKEN" \
        -O "$dest" "$url"
    echo "  ✅ $filename"
}

civitai_file_download() {
    local dest_dir=$1
    local url=$2
    local filename=$3
    local dest="$dest_dir/$filename"

    if [ -f "$dest" ]; then
        echo "  ⏭️  $filename already exists"
        return 0
    fi

    echo "  ⬇️  Downloading $filename..."
    if ! wget -q --show-progress \
        --header="Authorization: Bearer $CIVITAI_TOKEN" \
        -O "$dest" "$url"; then
        rm -f "$dest"
        echo "  ❌ Failed: $filename"
        return 1
    fi
    echo "  ✅ $filename"
}

hf_download() {
    local dest_dir=$1
    local repo=$2
    local filepath=$3          # path inside the repo (may include subdirs)
    local filename="${4:-$(basename "$filepath")}"
    local dest="$dest_dir/$filename"

    if [ -f "$dest" ]; then
        echo "  ⏭️  $filename already exists"
        return 0
    fi

    echo "  ⬇️  Downloading $filename from HuggingFace..."
    if ! wget -q --show-progress -O "$dest" \
        "https://huggingface.co/$repo/resolve/main/$filepath"; then
        rm -f "$dest"
        echo "  ❌ Failed to download $filename"
        return 1
    fi
    echo "  ✅ $filename"
}

# ── Checkpoint ────────────────────────────────────────────────────────────────

echo ""
echo "=== Checkpoint (SDXL) ==="
# Cole abaixo a URL de download direta do seu checkpoint SDXL escolhido no CivitAI.
# Formato: https://civitai.com/api/download/models/<versionId>?fileId=<fileId>
# (mesma forma das URLs dos LoRAs). O nome do arquivo DEVE ser sdxl_checkpoint.safetensors.
civitai_file_download "$MODELS/checkpoints" \
    "https://civitai.com/api/download/models/1977579?fileId=1875177" \
    "sdxl_checkpoint.safetensors"

# ── VAE ───────────────────────────────────────────────────────────────────────

echo ""
echo "=== VAE ==="
hf_download "$MODELS/vae" \
    "stabilityai/sd-vae-ft-mse-original" \
    "vae-ft-mse-840000-ema-pruned.safetensors"

# ── LoRAs ─────────────────────────────────────────────────────────────────────

echo ""
echo "=== LoRAs ==="

civitai_file_download "$MODELS/loras" \
    "https://civitai.com/api/download/models/465640?fileId=384580" \
    "detail_tweaker_xl.safetensors"

civitai_file_download "$MODELS/loras" \
    "https://civitai.com/api/download/models/2965913?fileId=2845322" \
    "skin_detail_xl.safetensors"

civitai_file_download "$MODELS/loras" \
    "https://civitai.com/api/download/models/2431035?fileId=2321609" \
    "mobile_photography.safetensors"

civitai_file_download "$MODELS/loras" \
    "https://civitai.com/api/download/models/1003317?fileId=909066" \
    "hand_fix_xl.safetensors"

# ── Upscaler ──────────────────────────────────────────────────────────────────

echo ""
echo "=== Upscaler ==="
hf_download "$MODELS/upscale_models" \
    "Kim2091/4x-UltraSharp" \
    "4x-UltraSharp.pth" || \
hf_download "$MODELS/upscale_models" \
    "uwg/upscalers" \
    "ESRGAN/4x-UltraSharp.pth" \
    "4x-UltraSharp.pth"

# NOTA: modelos de vídeo antigos (Wan 2.1 14B e Wan 2.2 A14B) foram
# DESCONTINUADOS — migramos pro Wan 2.2 TI2V-5B (abaixo), leve e rápido.
# Não baixe os antigos; se existirem no volume, podem ser apagados p/ liberar
# espaço (Wan2_1-*, umt5-xxl-enc-bf16, Wan2_1_VAE_bf16, *A14B*Q8*.gguf).

# ── Wan 2.2 TI2V-5B (vídeo — modelo leve, rápido) ─────────────────────────────

echo ""
echo "=== Wan 2.2 TI2V-5B (vídeo self-host — ~10 GB) ==="

# Modelo de difusão 5B (single-file, fp16). Vai em diffusion_models/.
hf_download "$MODELS/diffusion_models" \
    "Comfy-Org/Wan_2.2_ComfyUI_Repackaged" \
    "split_files/diffusion_models/wan2.2_ti2v_5B_fp16.safetensors" \
    "wan2.2_ti2v_5B_fp16.safetensors"

# VAE do Wan 2.2 (NOVO — diferente do 2.1; alta compressão 16x16x4).
hf_download "$MODELS/vae" \
    "Comfy-Org/Wan_2.2_ComfyUI_Repackaged" \
    "split_files/vae/wan2.2_vae.safetensors" \
    "wan2.2_vae.safetensors"

# Text encoder umt5 (mesmo do A14B; idempotente — pula se já existir).
hf_download "$MODELS/text_encoders" \
    "Comfy-Org/Wan_2.2_ComfyUI_Repackaged" \
    "split_files/text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors" \
    "umt5_xxl_fp8_e4m3fn_scaled.safetensors"

# ── IPAdapter FaceID (SDXL) ───────────────────────────────────────────────────

echo ""
echo "=== IPAdapter FaceID SDXL (face consistency) ==="

# CLIP Vision (ViT-H) — usado pelo IPAdapter FaceID Plus V2
hf_download "$MODELS/clip_vision" \
    "h94/IP-Adapter" \
    "models/image_encoder/model.safetensors" \
    "CLIP-ViT-H-14.safetensors"

# IPAdapter FaceID Plus V2 SDXL — modelo principal
hf_download "$MODELS/ipadapter" \
    "h94/IP-Adapter-FaceID" \
    "ip-adapter-faceid-plusv2_sdxl.bin"

# FaceID LoRA SDXL — carregada automaticamente pelo IPAdapterUnifiedLoaderFaceID
hf_download "$MODELS/loras" \
    "h94/IP-Adapter-FaceID" \
    "ip-adapter-faceid-plusv2_sdxl_lora.safetensors"

# ── Detection models (FaceDetailer / Hand Detailer via Impact Pack) ───────────

echo ""
echo "=== Detection models (rosto e mãos) ==="

hf_download "$MODELS/ultralytics/bbox" \
    "Bingsu/adetailer" \
    "face_yolov8m.pt"

hf_download "$MODELS/ultralytics/bbox" \
    "Bingsu/adetailer" \
    "hand_yolov8s.pt"

echo ""
echo "✅ All models downloaded!"
echo "   You can now build and deploy the Docker image."
