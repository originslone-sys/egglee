# Treino do LoRA da personagem

Trava a identidade da personagem (mesma pessoa em toda geração), indo além do
que o FaceID consegue. Pipeline: **dataset (painel) → treino (pod) → LoRA → workflows**.

## 1. Gerar o dataset (no painel Railway)

1. Em **🎓 Dataset de treino**, suba a **foto âncora** (rosto nítido, de frente).
2. Escolha a quantidade (36 é um bom número).
3. Clique **Gerar dataset (.zip)** e aguarde — ele gera as imagens variadas com
   FaceID e baixa `dataset.zip` no seu computador.
4. (Opcional) Abra o zip e remova manualmente as imagens em que o rosto ficou
   diferente — quanto mais consistente o dataset, melhor o LoRA.

## 2. Treinar (numa Pod RunPod com GPU 24GB+)

1. Deploy de uma GPU Pod (RTX 4090/A5000+), com o Network Volume em `/workspace`.
2. No file manager / Jupyter da pod, faça upload de `dataset.zip` para:
   `/workspace/egglee-train/dataset.zip`
3. No terminal da pod:

```bash
export WORKSPACE=/workspace
wget -qO /tmp/s.sh https://raw.githubusercontent.com/originslone-sys/egglee/claude/inspiring-ramanujan-j5qm8z/training/setup_kohya.sh && bash /tmp/s.sh
wget -qO /tmp/t.sh https://raw.githubusercontent.com/originslone-sys/egglee/claude/inspiring-ramanujan-j5qm8z/training/train.sh && bash /tmp/t.sh
```

O treino leva ~20-40 min. No fim, o LoRA fica em:
`/workspace/ComfyUI/models/loras/egglee_character.safetensors`

4. **Delete a pod** (o LoRA persiste no volume).

## 3. Usar o LoRA

Me avise quando o treino terminar — eu adiciono o LoRA aos workflows com a
palavra-gatilho (`eg1woman`) e reduzo/removo o FaceID, deixando a identidade travada.

## Parâmetros (train.sh)

- `network_dim 32 / alpha 16` — capacidade do LoRA (bom p/ rosto)
- `10 repeats × 10 épocas` — ajuste se ficar fraco (subir) ou "queimado" (descer)
- `learning_rate 1e-4` — padrão seguro
- trigger word: `eg1woman`
