#!/bin/bash
# Instala o kohya-ss/sd-scripts numa Pod RunPod com GPU (24GB+) para treinar o LoRA.
# Rode UMA vez por pod:
#   export WORKSPACE=/workspace
#   wget -qO /tmp/s.sh https://raw.githubusercontent.com/originslone-sys/egglee/claude/inspiring-ramanujan-j5qm8z/training/setup_kohya.sh && bash /tmp/s.sh
set -e

WORKSPACE="${WORKSPACE:-/workspace}"
cd "$WORKSPACE"

apt-get update -y && apt-get install -y --no-install-recommends unzip || true

echo "=== Clonando kohya sd-scripts ==="
if [ ! -d "$WORKSPACE/sd-scripts" ]; then
    git clone https://github.com/kohya-ss/sd-scripts.git "$WORKSPACE/sd-scripts"
fi

cd "$WORKSPACE/sd-scripts"
echo "=== Instalando dependências ==="
pip install -r requirements.txt
pip install accelerate bitsandbytes safetensors

# Configuração padrão do accelerate (1 GPU, sem distribuído)
mkdir -p ~/.cache/huggingface/accelerate
cat > ~/.cache/huggingface/accelerate/default_config.yaml <<'EOF'
compute_environment: LOCAL_MACHINE
distributed_type: 'NO'
mixed_precision: bf16
num_processes: 1
use_cpu: false
EOF

echo ""
echo "✅ kohya pronto. Próximo passo: train.sh"
