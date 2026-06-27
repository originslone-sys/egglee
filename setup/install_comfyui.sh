#!/bin/bash
# Run this ONCE on a RunPod pod with your Network Volume mounted at /workspace.
# This puts the ComfyUI source code + custom nodes on the volume.
# Python dependencies (torch etc.) are provided by the Docker image, NOT here.
set -e

WORKSPACE="${WORKSPACE:-/workspace}"
COMFYUI_DIR="$WORKSPACE/ComfyUI"

echo "=== Installing ComfyUI ==="
if [ ! -d "$COMFYUI_DIR" ]; then
    git clone https://github.com/comfyanonymous/ComfyUI.git "$COMFYUI_DIR"
fi

mkdir -p "$COMFYUI_DIR/models/checkpoints" "$COMFYUI_DIR/models/loras" \
         "$COMFYUI_DIR/models/vae" "$COMFYUI_DIR/models/upscale_models" \
         "$COMFYUI_DIR/models/clip" "$COMFYUI_DIR/models/clip_vision" \
         "$COMFYUI_DIR/models/ipadapter" "$COMFYUI_DIR/models/diffusion_models" \
         "$COMFYUI_DIR/input" "$COMFYUI_DIR/output"

echo "=== Installing Custom Nodes (code only) ==="
cd "$COMFYUI_DIR/custom_nodes"

install_node() {
    local name=$1
    local repo=$2
    if [ ! -d "$name" ]; then
        git clone "$repo" "$name"
        echo "  ✅ $name"
    else
        echo "  ⏭️  $name already exists"
    fi
}

install_node "ComfyUI-Manager"          "https://github.com/ltdrdata/ComfyUI-Manager.git"
install_node "ComfyUI-WanVideoWrapper"  "https://github.com/kijai/ComfyUI-WanVideoWrapper.git"
install_node "ComfyUI-VideoHelperSuite" "https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite.git"
install_node "ComfyUI_IPAdapter_plus"   "https://github.com/cubiq/ComfyUI_IPAdapter_plus.git"

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
echo "   Python deps come from the Docker image — nothing else to install here."
echo "   Next step: run setup/download_models.sh"
