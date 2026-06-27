#!/bin/bash
# Coleta as N imagens FaceID mais recentes do output do ComfyUI (no volume)
# e prepara a pasta de treino — alternativa ao dataset.zip do painel.
#
# Uso (na pod, com o volume montado):
#   export WORKSPACE=/workspace
#   wget -qO /tmp/c.sh https://raw.githubusercontent.com/originslone-sys/egglee/claude/inspiring-ramanujan-j5qm8z/training/collect_from_output.sh && bash /tmp/c.sh 36
set -e

WORKSPACE="${WORKSPACE:-/workspace}"
N="${1:-36}"
OUTPUT="$WORKSPACE/ComfyUI/output"
TRIGGER="eg1woman"
DEST="$WORKSPACE/egglee-train/img/10_${TRIGGER}"

mkdir -p "$DEST"

echo "=== Coletando as $N imagens faceid mais recentes de $OUTPUT ==="
if ! ls "$OUTPUT"/faceid_*.png >/dev/null 2>&1; then
    echo "❌ Nenhum arquivo faceid_*.png em $OUTPUT."
    echo "   Os jobs do dataset podem ter falhado (nenhuma imagem salva)."
    exit 1
fi

ls -t "$OUTPUT"/faceid_*.png | head -n "$N" | while read -r f; do
    cp "$f" "$DEST/"
done

total=$(ls "$DEST"/*.png 2>/dev/null | wc -l)
echo "✅ $total imagens copiadas para:"
echo "   $DEST"
echo ""
echo "Revise a pasta (remova as que o rosto ficou diferente do âncora)."
echo "Depois rode: setup_kohya.sh e train.sh"
