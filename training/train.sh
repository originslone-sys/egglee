#!/bin/bash
# Treina o LoRA da personagem a partir do dataset.zip (gerado no painel).
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
REPEATS=10
DATA_DIR="$TRAIN_DIR/img/${REPEATS}_${TRIGGER}"
CKPT="$WORKSPACE/ComfyUI/models/checkpoints/sdxl_checkpoint.safetensors"
OUT="$WORKSPACE/ComfyUI/models/loras"

mkdir -p "$DATA_DIR" "$OUT"

echo "=== Preparando dataset ==="
if [ -f "$TRAIN_DIR/dataset.zip" ]; then
    rm -rf "$TRAIN_DIR/_imgs"
    unzip -o -q "$TRAIN_DIR/dataset.zip" -d "$TRAIN_DIR/_imgs"
    find "$TRAIN_DIR/_imgs" -type f \( -iname '*.png' -o -iname '*.jpg' -o -iname '*.jpeg' \) \
        -exec mv {} "$DATA_DIR"/ \;
fi

count=$(find "$DATA_DIR" -type f \( -iname '*.png' -o -iname '*.jpg' -o -iname '*.jpeg' \) | wc -l)
if [ "$count" -lt 8 ]; then
    echo "❌ Poucas imagens em $DATA_DIR ($count). Faça upload do dataset.zip primeiro."
    exit 1
fi
echo "  $count imagens encontradas."

echo "=== Gerando captions (trigger: $TRIGGER) ==="
for f in "$DATA_DIR"/*; do
    case "$f" in
        *.png|*.jpg|*.jpeg|*.PNG|*.JPG|*.JPEG)
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
    --train_batch_size 1 --max_train_epochs 10 \
    --mixed_precision bf16 --save_precision bf16 \
    --optimizer_type AdamW8bit \
    --sdpa --cache_latents --gradient_checkpointing \
    --seed 42 --save_every_n_epochs 5

echo ""
echo "✅ LoRA salvo em: $OUT/egglee_character.safetensors"
echo "   Me avise que eu atualizo os workflows para usar ele."
