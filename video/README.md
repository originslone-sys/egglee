# Vídeo self-host — Wan 2.2 I2V (14B)

Geração de vídeo Image-to-Video local no RunPod, como alternativa à API
(OpenRouter). Melhor opção self-hostável: **Wan 2.2 I2V A14B** (pesos abertos;
as versões 2.5/2.6 são API-only). Roda em 480p/720p num 4090 (24GB) via GGUF.

## Fase 1 — Setup (uma vez, numa Pod com o Network Volume)

Suba uma Pod GPU (24GB) anexada ao mesmo Network Volume do endpoint e rode:

```bash
export WORKSPACE=/workspace
wget -qO /tmp/wan.sh https://raw.githubusercontent.com/originslone-sys/egglee/claude/inspiring-ramanujan-j5qm8z/video/setup_wan.sh
bash /tmp/wan.sh
```

Baixa para o volume:
- `diffusion_models/` → Wan 2.2 I2V high-noise + low-noise (GGUF Q8 por padrão)
- `text_encoders/` → `umt5_xxl_fp8_e4m3fn_scaled.safetensors`
- `vae/` → `wan_2.1_vae.safetensors`

E instala os custom nodes: ComfyUI-GGUF, VideoHelperSuite, Frame-Interpolation (RIFE).

Quantização: `QUANT=Q6_K bash /tmp/wan.sh` (menor/mais rápido) se faltar VRAM.

## Próximas fases (depois do setup)
- Fase 3: workflow `workflows/video_i2v.json` (480p/720p, frame inicial p/ encadear).
- Fase 4: `handler.py` com encadeamento 10/15s + painel com seletor → rebuild do worker.
