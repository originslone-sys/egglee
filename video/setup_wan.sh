#!/bin/bash
# ──────────────────────────────────────────────────────────────────────────────
# Fase 1 — Baixa o Wan 2.2 I2V (14B, MoE high+low noise) em GGUF + auxiliares
# para o Network Volume, e instala os custom nodes do ComfyUI necessários.
#
# Rode UMA vez, numa Pod RunPod com GPU (24GB) anexada ao MESMO Network Volume:
#   export WORKSPACE=/workspace
#   wget -qO /tmp/wan.sh https://raw.githubusercontent.com/originslone-sys/egglee/claude/inspiring-ramanujan-j5qm8z/video/setup_wan.sh && bash /tmp/wan.sh
#
# Variáveis opcionais:
#   QUANT=Q8_0   -> qualidade alta (padrão, ~15GB por expert). Use Q6_K (~12GB)
#                   ou Q5_K_M (~10GB) se faltar VRAM/disco ou quiser mais rápido.
# ──────────────────────────────────────────────────────────────────────────────
set -e

WORKSPACE="${WORKSPACE:-/workspace}"
COMFY="${COMFY:-$WORKSPACE/ComfyUI}"
QUANT="${QUANT:-Q8_0}"

if [ ! -d "$COMFY" ]; then
    echo "❌ Não achei o ComfyUI em $COMFY."
    echo "   Defina COMFY=/caminho/para/ComfyUI e rode de novo."
    exit 1
fi

MODELS="$COMFY/models"
DIFF="$MODELS/diffusion_models"
TENC="$MODELS/text_encoders"
VAE="$MODELS/vae"
NODES="$COMFY/custom_nodes"
mkdir -p "$DIFF" "$TENC" "$VAE" "$NODES"

echo "=== Instalando huggingface-cli (download rápido) ==="
pip install -q "huggingface_hub[cli]" hf_transfer
export HF_HUB_ENABLE_HF_TRANSFER=1

# ── 1) Experts do Wan 2.2 I2V (GGUF) ──────────────────────────────────────────
# Repo: QuantStack/Wan2.2-I2V-A14B-GGUF  (high-noise + low-noise)
echo ""
echo "=== Baixando Wan 2.2 I2V experts ($QUANT) — isso é o maior download ==="
TMP_GGUF="$(mktemp -d)"
huggingface-cli download QuantStack/Wan2.2-I2V-A14B-GGUF \
    --include "*HighNoise*${QUANT}*.gguf" "*LowNoise*${QUANT}*.gguf" \
    --local-dir "$TMP_GGUF"
# Achata: move qualquer .gguf encontrado para diffusion_models/
find "$TMP_GGUF" -name "*.gguf" -exec mv -v -t "$DIFF" {} +
rm -rf "$TMP_GGUF"

# ── 2) Text encoder + VAE (Comfy-Org repackaged) ──────────────────────────────
echo ""
echo "=== Baixando text encoder (umt5_xxl_fp8) e VAE (wan_2.1) ==="
TMP_AUX="$(mktemp -d)"
huggingface-cli download Comfy-Org/Wan_2.1_ComfyUI_repackaged \
    --include "split_files/text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors" \
              "split_files/vae/wan_2.1_vae.safetensors" \
    --local-dir "$TMP_AUX"
find "$TMP_AUX" -name "umt5_xxl_fp8_e4m3fn_scaled.safetensors" -exec mv -v -t "$TENC" {} +
find "$TMP_AUX" -name "wan_2.1_vae.safetensors" -exec mv -v -t "$VAE" {} +
rm -rf "$TMP_AUX"

# ── 3) Custom nodes ───────────────────────────────────────────────────────────
echo ""
echo "=== Instalando custom nodes do ComfyUI ==="
clone_node () {  # $1=url $2=dir
    if [ ! -d "$NODES/$2" ]; then
        git clone --depth 1 "$1" "$NODES/$2"
    else
        echo "  ($2 já existe, pulando clone)"
    fi
    if [ -f "$NODES/$2/requirements.txt" ]; then
        pip install -q -r "$NODES/$2/requirements.txt" || true
    fi
}
clone_node https://github.com/city96/ComfyUI-GGUF                 ComfyUI-GGUF
clone_node https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite ComfyUI-VideoHelperSuite
clone_node https://github.com/Fannovel16/ComfyUI-Frame-Interpolation ComfyUI-Frame-Interpolation

# ── 4) Verificação ────────────────────────────────────────────────────────────
echo ""
echo "=== Verificando arquivos ==="
ok=1
check () { if [ -n "$(ls -A $1 2>/dev/null | grep -i "$2")" ]; then
             echo "  ✅ $2  ($(du -sh $1/*$2* 2>/dev/null | head -1 | cut -f1))";
           else echo "  ❌ FALTANDO: $2 em $1"; ok=0; fi; }
check "$DIFF" "HighNoise"
check "$DIFF" "LowNoise"
check "$TENC" "umt5_xxl_fp8"
check "$VAE"  "wan_2.1_vae"

echo ""
if [ "$ok" = "1" ]; then
    echo "✅ Fase 1 concluída. Modelos no volume e nodes instalados."
    echo "   Próximo: eu subo o workflow video_i2v.json + handler e fazemos o rebuild."
else
    echo "⚠️  Algum arquivo faltou — me mande a saída acima que eu ajusto os nomes/URLs."
fi
