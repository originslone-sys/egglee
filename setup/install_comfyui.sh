#!/bin/bash
# Run this ONCE on a RunPod pod with your Network Volume mounted at /workspace.
# Steps: launch any GPU pod → attach the volume → open the terminal → run this script.
set -e

WORKSPACE="${WORKSPACE:-/workspace}"
COMFYUI_DIR="$WORKSPACE/ComfyUI"
VENV_DIR="$WORKSPACE/venv"

echo "=== Installing ComfyUI ==="
if [ ! -d "$COMFYUI_DIR" ]; then
    git clone https://github.com/comfyanonymous/ComfyUI.git "$COMFYUI_DIR"
fi

mkdir -p "$COMFYUI_DIR/models/checkpoints" "$COMFYUI_DIR/models/loras" \
         "$COMFYUI_DIR/models/vae" "$COMFYUI_DIR/models/upscale_models" \
         "$COMFYUI_DIR/models/clip" "$COMFYUI_DIR/models/clip_vision" \
         "$COMFYUI_DIR/models/ipadapter" "$COMFYUI_DIR/models/diffusion_models" \
         "$COMFYUI_DIR/input" "$COMFYUI_DIR/output"

echo "=== Creating Python virtualenv on volume ==="
if [ ! -d "$VENV_DIR" ]; then
    python3 -m venv "$VENV_DIR"
    echo "  ✅ venv created at $VENV_DIR"
else
    echo "  ⏭️  venv already exists"
fi

VENV_PIP="$VENV_DIR/bin/pip"
VENV_PYTHON="$VENV_DIR/bin/python"

echo "=== Installing PyTorch (CUDA 12.1) into venv ==="
if ! "$VENV_PYTHON" -c "import torch; print(torch.__version__)" 2>/dev/null | grep -q "^2"; then
    "$VENV_PIP" install --no-cache-dir \
        torch torchvision torchaudio \
        --index-url https://download.pytorch.org/whl/cu121
    echo "  ✅ PyTorch installed"
else
    echo "  ⏭️  PyTorch already installed"
fi

echo "=== Installing ComfyUI requirements into venv ==="
cd "$COMFYUI_DIR"
"$VENV_PIP" install --no-cache-dir -r requirements.txt

echo "=== Installing Custom Nodes ==="
cd "$COMFYUI_DIR/custom_nodes"

install_node() {
    local name=$1
    local repo=$2
    if [ ! -d "$name" ]; then
        git clone "$repo" "$name"
        [ -f "$name/requirements.txt" ] && "$VENV_PIP" install --no-cache-dir -r "$name/requirements.txt"
        echo "  ✅ $name"
    else
        echo "  ⏭️  $name already exists"
        [ -f "$name/requirements.txt" ] && "$VENV_PIP" install --no-cache-dir -r "$name/requirements.txt" --quiet
    fi
}

install_node "ComfyUI-Manager"          "https://github.com/ltdrdata/ComfyUI-Manager.git"
install_node "ComfyUI-WanVideoWrapper"  "https://github.com/kijai/ComfyUI-WanVideoWrapper.git"
install_node "ComfyUI-VideoHelperSuite" "https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite.git"
install_node "ComfyUI_IPAdapter_plus"   "https://github.com/cubiq/ComfyUI_IPAdapter_plus.git"

"$VENV_PIP" install --no-cache-dir insightface onnxruntime
echo "  ✅ insightface + onnxruntime"

echo ""
echo "=== Copying workflows to volume ==="
mkdir -p "$WORKSPACE/workflows"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
if [ -d "$REPO_ROOT/workflows" ]; then
    cp -r "$REPO_ROOT/workflows/"* "$WORKSPACE/workflows/"
    echo "  ✅ Workflows copied to $WORKSPACE/workflows/"
fi

echo ""
echo "✅ Installation complete!"
echo "   Venv: $VENV_DIR"
echo "   Next step: run setup/download_models.sh"
