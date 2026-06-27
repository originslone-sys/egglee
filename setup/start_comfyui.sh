#!/bin/bash
# Sobe a INTERFACE GRÁFICA do ComfyUI numa Pod RunPod (não serverless).
#
# Como usar:
#   1. Deploy de uma GPU Pod com o Network Volume "Gerar IA" montado em /workspace
#   2. Em "Expose HTTP Ports" adicione a porta 8188
#   3. No terminal da pod rode:
#        export WORKSPACE=/workspace
#        wget -qO /tmp/start.sh https://raw.githubusercontent.com/originslone-sys/egglee/claude/inspiring-ramanujan-j5qm8z/setup/start_comfyui.sh && bash /tmp/start.sh
#   4. Clique em "Connect" → porta 8188 (HTTP) para abrir a interface no navegador
set -e

WORKSPACE="${WORKSPACE:-/workspace}"
COMFYUI_DIR="$WORKSPACE/ComfyUI"

cd "$COMFYUI_DIR"

echo "=== Instalando dependências na pod (se necessário) ==="
pip install -q -r requirements.txt
pip install -q insightface onnxruntime
for node in ComfyUI-WanVideoWrapper ComfyUI-VideoHelperSuite ComfyUI_IPAdapter_plus; do
    req="custom_nodes/$node/requirements.txt"
    [ -f "$req" ] && pip install -q -r "$req" || true
done

echo ""
echo "=== Iniciando ComfyUI na porta 8188 ==="
echo "   Abra: Connect → HTTP Service [Port 8188]"
python main.py --listen 0.0.0.0 --port 8188
