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
echo "=== Checkpoint ==="
civitai_download "$MODELS/checkpoints" "2533927" "famegrid_zib.safetensors"

# ── VAE ───────────────────────────────────────────────────────────────────────

echo ""
echo "=== VAE ==="
hf_download "$MODELS/vae" \
    "stabilityai/sd-vae-ft-mse-original" \
    "vae-ft-mse-840000-ema-pruned.safetensors"

# ── LoRAs ─────────────────────────────────────────────────────────────────────

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

# ── Wan2.1 Models (~40 GB total) ──────────────────────────────────────────────

echo ""
echo "=== Wan2.1 Video Models (this will take a while) ==="

# FP8 quantized versions via Kijai's HF repo (lower VRAM, same quality)
hf_download "$MODELS/diffusion_models" \
    "Kijai/WanVideo_comfy" \
    "Wan2_1-T2V-14B_fp8_e4m3fn.safetensors"

hf_download "$MODELS/diffusion_models" \
    "Kijai/WanVideo_comfy" \
    "Wan2_1-I2V-14B-480P_fp8_e4m3fn.safetensors"

# Shared text encoder
hf_download "$MODELS/clip" \
    "Kijai/WanVideo_comfy" \
    "umt5-xxl-enc-bf16.safetensors"

# Wan2.1 VAE
hf_download "$MODELS/vae" \
    "Kijai/WanVideo_comfy" \
    "Wan2_1_VAE_bf16.safetensors"

echo ""
echo "✅ All models downloaded!"
echo "   You can now build and deploy the Docker image."
