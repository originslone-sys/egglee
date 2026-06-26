#!/bin/bash
# Run this ONCE on a RunPod pod with your Network Volume mounted at /workspace.
# Steps: launch any GPU pod → attach the volume → open the terminal → run this script.
set -e

WORKSPACE="${WORKSPACE:-/workspace}"
COMFYUI_DIR="$WORKSPACE/ComfyUI"

echo "=== Installing ComfyUI ==="
if [ ! -d "$COMFYUI_DIR" ]; then
    git clone https://github.com/comfyanonymous/ComfyUI.git "$COMFYUI_DIR"
fi

cd "$COMFYUI_DIR"
pip install -r requirements.txt

mkdir -p models/checkpoints models/loras models/vae \
         models/upscale_models models/clip \
         models/diffusion_models input output

echo "=== Installing Custom Nodes ==="
cd custom_nodes

install_node() {
    local name=$1
    local repo=$2
    if [ ! -d "$name" ]; then
        git clone "$repo" "$name"
        [ -f "$name/requirements.txt" ] && pip install -r "$name/requirements.txt"
        echo "  ✅ $name"
    else
        echo "  ⏭️  $name already exists"
    fi
}

install_node "ComfyUI-Manager"          "https://github.com/ltdrdata/ComfyUI-Manager.git"
install_node "ComfyUI-WanVideoWrapper"  "https://github.com/kijai/ComfyUI-WanVideoWrapper.git"
install_node "ComfyUI-VideoHelperSuite" "https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite.git"

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
echo "   Next step: run setup/download_models.sh"
