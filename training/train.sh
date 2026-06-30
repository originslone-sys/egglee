#!/bin/bash
# Treina o LoRA da personagem a partir do dataset.zip (fotos reais ou geradas).
# Calcula automaticamente as repetições para manter ~2800 passos totais,
# independente da quantidade de fotos (evita overfitting com muitas imagens).
#
# Antes de rodar:
#   1. Faça upload de dataset.zip para a pod em:  $WORKSPACE/egglee-train/dataset.zip
#      (use o file manager da RunPod / Jupyter)
#   2. export WORKSPACE=/workspace
#   3. wget -qO /tmp/t.sh https://raw.githubusercontent.com/originslone-sys/egglee/claude/inspiring-ramanujan-j5qm8z/training/train.sh && bash /tmp/t.sh
set -e

WORKSPACE="${WORKSPACE:-/workspace}"
TRAIN_DIR="$WORKSPACE/egglee-train"
TRIGGER="eg1woman"
EPOCHS=10
TARGET_PER_EPOCH=240   # passos/época alvo (~2400 total; menos overtraining que o v1)
CKPT="$WORKSPACE/ComfyUI/models/checkpoints/sdxl_checkpoint.safetensors"
OUT="$WORKSPACE/ComfyUI/models/loras"

mkdir -p "$OUT"

# Backup do LoRA atual antes de sobrescrever
if [ -f "$OUT/egglee_character.safetensors" ] && [ ! -f "$OUT/egglee_character_v1.safetensors" ]; then
    cp "$OUT/egglee_character.safetensors" "$OUT/egglee_character_v1.safetensors"
    echo "Backup do LoRA atual salvo como egglee_character_v1.safetensors"
fi

echo "=== Preparando dataset ==="
rm -rf "$TRAIN_DIR/img" "$TRAIN_DIR/_stage"
mkdir -p "$TRAIN_DIR/_stage"

# Prefere a pasta 'captioned/' (legendas revisadas no caption.py + editor).
# Se não existir, cai no dataset.zip com legenda padrão (compatível com o v1).
CAP_DIR="$TRAIN_DIR/captioned"
if [ -d "$CAP_DIR" ] && [ "$(find "$CAP_DIR" -maxdepth 1 -iname '*.txt' | wc -l)" -ge 4 ]; then
    echo "  Usando legendas revisadas de captioned/"
    SRC="$CAP_DIR"; HAVE_CAPTIONS=1
else
    if [ ! -f "$TRAIN_DIR/dataset.zip" ]; then
        echo "❌ Nem captioned/ nem dataset.zip encontrados. Rode caption.py ou suba o zip."
        exit 1
    fi
    echo "  ⚠️ Sem legendas revisadas — usando dataset.zip + legenda padrão."
    unzip -o -q "$TRAIN_DIR/dataset.zip" -d "$TRAIN_DIR/_stage"
    SRC="$TRAIN_DIR/_stage"; HAVE_CAPTIONS=0
fi

count=$(find "$SRC" -type f \( -iname '*.png' -o -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.webp' \) | wc -l)
if [ "$count" -lt 8 ]; then
    echo "❌ Poucas imagens ($count)."
    exit 1
fi

REPEATS=$(( (TARGET_PER_EPOCH + count / 2) / count ))
[ "$REPEATS" -lt 1 ] && REPEATS=1
TOTAL_STEPS=$(( count * REPEATS * EPOCHS ))
DATA_DIR="$TRAIN_DIR/img/${REPEATS}_${TRIGGER}"
mkdir -p "$DATA_DIR"

# Move imagem + .txt (se houver) mantendo o par; senão escreve legenda padrão.
while IFS= read -r f; do
    base="${f%.*}"
    cp "$f" "$DATA_DIR/"
    fname="$(basename "$f")"
    if [ "$HAVE_CAPTIONS" = "1" ] && [ -f "$base.txt" ]; then
        cp "$base.txt" "$DATA_DIR/${fname%.*}.txt"
    else
        echo "$TRIGGER, woman" > "$DATA_DIR/${fname%.*}.txt"
    fi
done < <(find "$SRC" -type f \( -iname '*.png' -o -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.webp' \))

echo "  $count fotos | $REPEATS repetições | $EPOCHS épocas → ~$TOTAL_STEPS passos | legendas: $([ "$HAVE_CAPTIONS" = 1 ] && echo revisadas || echo padrão)"

echo "=== Treinando LoRA (SDXL) ==="
cd "$WORKSPACE/sd-scripts"
accelerate launch --num_cpu_threads_per_process 4 sdxl_train_network.py \
    --pretrained_model_name_or_path "$CKPT" \
    --train_data_dir "$TRAIN_DIR/img" \
    --resolution "1024,1024" \
    --enable_bucket --min_bucket_reso 640 --max_bucket_reso 1536 \
    --output_dir "$OUT" \
    --output_name egglee_character \
    --save_model_as safetensors \
    --network_module networks.lora \
    --network_dim 32 --network_alpha 16 \
    --caption_extension .txt --shuffle_caption --keep_tokens 1 \
    --learning_rate 1e-4 --unet_lr 1e-4 --text_encoder_lr 5e-5 \
    --lr_scheduler cosine --lr_warmup_steps 0 \
    --train_batch_size 1 --max_train_epochs "$EPOCHS" \
    --mixed_precision bf16 --save_precision bf16 \
    --optimizer_type AdamW8bit \
    --sdpa --cache_latents --gradient_checkpointing \
    --seed 42 --save_every_n_epochs 5

echo ""
echo "✅ LoRA salvo em: $OUT/egglee_character.safetensors (~$TOTAL_STEPS passos)"
echo "   Reinicie o worker (Min Workers 0→1) e teste no painel."
