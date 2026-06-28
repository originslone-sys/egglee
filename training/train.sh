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
TARGET_PER_EPOCH=280   # passos por época alvo (≈2800 total em 10 épocas)
CKPT="$WORKSPACE/ComfyUI/models/checkpoints/sdxl_checkpoint.safetensors"
OUT="$WORKSPACE/ComfyUI/models/loras"

mkdir -p "$OUT"

# Backup do LoRA atual antes de sobrescrever
if [ -f "$OUT/egglee_character.safetensors" ] && [ ! -f "$OUT/egglee_character_v1.safetensors" ]; then
    cp "$OUT/egglee_character.safetensors" "$OUT/egglee_character_v1.safetensors"
    echo "Backup do LoRA atual salvo como egglee_character_v1.safetensors"
fi

echo "=== Preparando dataset ==="
# Limpa dataset anterior para não misturar fotos antigas
rm -rf "$TRAIN_DIR/img" "$TRAIN_DIR/_stage"
mkdir -p "$TRAIN_DIR/_stage"

if [ ! -f "$TRAIN_DIR/dataset.zip" ]; then
    echo "❌ $TRAIN_DIR/dataset.zip não encontrado. Faça o upload primeiro."
    exit 1
fi
unzip -o -q "$TRAIN_DIR/dataset.zip" -d "$TRAIN_DIR/_stage"

count=$(find "$TRAIN_DIR/_stage" -type f \( -iname '*.png' -o -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.webp' \) | wc -l)
if [ "$count" -lt 8 ]; then
    echo "❌ Poucas imagens ($count). Confira o dataset.zip."
    exit 1
fi

# Repetições automáticas para manter os passos no ponto certo
REPEATS=$(( (TARGET_PER_EPOCH + count / 2) / count ))
[ "$REPEATS" -lt 1 ] && REPEATS=1
TOTAL_STEPS=$(( count * REPEATS * EPOCHS ))
DATA_DIR="$TRAIN_DIR/img/${REPEATS}_${TRIGGER}"
mkdir -p "$DATA_DIR"

find "$TRAIN_DIR/_stage" -type f \( -iname '*.png' -o -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.webp' \) \
    -exec mv {} "$DATA_DIR"/ \;

echo "  $count fotos | $REPEATS repetições | $EPOCHS épocas → ~$TOTAL_STEPS passos"

echo "=== Gerando captions (trigger: $TRIGGER) ==="
for f in "$DATA_DIR"/*; do
    case "$f" in
        *.png|*.jpg|*.jpeg|*.webp|*.PNG|*.JPG|*.JPEG|*.WEBP)
            echo "$TRIGGER, woman" > "${f%.*}.txt" ;;
    esac
done

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
