# 🛟 Runbook de recuperação — reinstalar tudo num volume novo (RunPod)

> Use este documento se o **Network Volume do RunPod for apagado** (ex.: por falta de
> pagamento) e você precisar recriar todo o ambiente de geração do zero.
> Data: 2026-07-03. Branch de referência: `claude/inspiring-ramanujan-j5qm8z`.

---

## ⚠️ 1. ANTES DE PERDER O VOLUME — FAÇA BACKUP DISTO (INSUBSTITUÍVEL)

Quase tudo é re-baixável, **MENOS os modelos que VOCÊ treinou**. Eles existem **só no
volume** e **não estão no GitHub nem em lugar nenhum público**:

- **`egglee_character.safetensors`** — o LoRA da personagem (identidade). É o coração do
  projeto. Fica em `/workspace/ComfyUI/models/loras/`.
- **Qualquer outro LoRA treinado por você** na mesma pasta `models/loras/`.

👉 **Baixe esses arquivos para o seu PC / Google Drive AGORA**, antes do volume sumir.
Sem eles, todas as gerações da personagem ficam impossíveis e não há como recriar sem
re-treinar do zero (precisaria do dataset original).

Como baixar antes de perder (numa Pod com o volume montado):
```bash
# opção 1: painel web do ComfyUI (start_comfyui.sh) → baixar pelo navegador
# opção 2: via runpodctl / scp / rclone para o seu storage pessoal
ls -la /workspace/ComfyUI/models/loras/
```

### O que NÃO se perde com o volume (está seguro em outro lugar)
- **Código** (webapp, handler, workflows, setup) → GitHub.
- **Imagem Docker do worker** → GHCR (`ghcr.io/originslone-sys/egglee:latest`).
- **Mídias geradas** (fotos/vídeos) → Cloudflare **R2** (bucket, não o volume).
- **Banco de dados** (usuários, jobs, pagamentos, settings) → **Postgres** (Railway).
- **Webapp** → **Railway** (roda independente do RunPod).

⇒ Perder o volume derruba **só a geração** (ComfyUI + modelos). O site continua no ar;
gerar imagem/vídeo local volta a funcionar assim que o volume for recriado.

---

## 2. Arquitetura — onde cada coisa vive

| Camada | Onde | Recuperável? |
|---|---|---|
| Webapp Flask (site/painel) | Railway | Sim (redeploy do GitHub) |
| Banco Postgres | Railway | Sim (persiste no Railway) |
| Mídias geradas | Cloudflare R2 | Sim (persiste no R2) |
| Worker (ComfyUI + Python torch) | Imagem Docker no GHCR | Sim (rebuild) |
| **ComfyUI source + custom nodes** | **Network Volume** | Sim (script) |
| **Modelos base/LoRAs públicos** | **Network Volume** | Sim (script) |
| **LoRA da personagem (treinado)** | **Network Volume** | ❌ **só backup manual** |

O worker serverless monta o volume em **`/runpod-volume`** (ver `handler.py`:
`WORKSPACE`). Em Pod interativa o volume monta em **`/workspace`**.

---

## 3. Passo a passo — recriar num volume NOVO

Depois de criar um novo Network Volume no RunPod e subir uma **GPU Pod** com ele montado
em `/workspace` (com HTTP port 8188 exposta se quiser a interface):

### 3.1 Instalar ComfyUI + custom nodes (código)
```bash
export WORKSPACE=/workspace
wget -qO /tmp/i.sh https://raw.githubusercontent.com/originslone-sys/egglee/claude/inspiring-ramanujan-j5qm8z/setup/install_comfyui.sh
bash /tmp/i.sh
```
Isso clona o ComfyUI e os custom nodes e cria a estrutura de pastas de modelos.

### 3.2 Baixar todos os modelos públicos
```bash
export CIVITAI_TOKEN=<seu_token_civitai>
wget -qO /tmp/m.sh https://raw.githubusercontent.com/originslone-sys/egglee/claude/inspiring-ramanujan-j5qm8z/setup/download_models.sh
bash /tmp/m.sh
```
(≈ 10 GB do Wan + SDXL + LoRAs + IPAdapter + detectores. Idempotente: pula o que já existe.)

### 3.3 Restaurar o LoRA da personagem (do seu backup)
```bash
# copie o egglee_character.safetensors (e outros LoRAs treinados) de volta:
cp egglee_character.safetensors /workspace/ComfyUI/models/loras/
```

### 3.4 (Se precisar) rebuild da imagem do worker
Normalmente **não precisa** — a imagem no GHCR continua válida. Só é necessário se você
mudou `handler.py`, `Dockerfile` ou `workflows/`. Basta um push na branch
`claude/inspiring-ramanujan-j5qm8z` → o GitHub Actions (`.github/workflows/deploy.yml`)
faz build no GHCR e atualiza o endpoint RunPod automaticamente.

### 3.5 Apontar o endpoint serverless pro novo volume
No RunPod, no endpoint serverless, troque o Network Volume para o novo. Confirme que a
imagem é `ghcr.io/originslone-sys/egglee:latest` e que a env `WORKSPACE=/runpod-volume`
(padrão) bate com o mount.

### 3.6 Testar
Gere uma imagem pelo painel admin (txt2img) e um vídeo (Wan 5B). Se ambos voltarem, o
ambiente está recuperado.

---

## 4. Manifesto de modelos (o que o `download_models.sh` instala)

Todos em `/workspace/ComfyUI/models/<subpasta>/`:

### checkpoints/
- `sdxl_checkpoint.safetensors` — SDXL base.
  CivitAI: `https://civitai.com/api/download/models/1977579?fileId=1875177`
  (⚠️ confirme que é o checkpoint que você escolheu; o nome do arquivo TEM que ser
  `sdxl_checkpoint.safetensors`.)

### vae/
- `vae-ft-mse-840000-ema-pruned.safetensors` — HF `stabilityai/sd-vae-ft-mse-original`
- `wan2.2_vae.safetensors` — HF `Comfy-Org/Wan_2.2_ComfyUI_Repackaged`
  (`split_files/vae/wan2.2_vae.safetensors`)

### loras/
- `detail_tweaker_xl.safetensors` — CivitAI `465640?fileId=384580`
- `skin_detail_xl.safetensors` — CivitAI `2965913?fileId=2845322`
- `mobile_photography.safetensors` — CivitAI `2431035?fileId=2321609`
- `hand_fix_xl.safetensors` — CivitAI `1003317?fileId=909066`
- `ip-adapter-faceid-plusv2_sdxl_lora.safetensors` — HF `h94/IP-Adapter-FaceID`
- **`egglee_character.safetensors`** — 🔴 **SEU backup** (não é baixável)

### diffusion_models/
- `wan2.2_ti2v_5B_fp16.safetensors` — HF `Comfy-Org/Wan_2.2_ComfyUI_Repackaged`
  (`split_files/diffusion_models/...`) — modelo de vídeo (~10 GB)

### text_encoders/
- `umt5_xxl_fp8_e4m3fn_scaled.safetensors` — HF `Comfy-Org/Wan_2.2_ComfyUI_Repackaged`

### clip_vision/
- `CLIP-ViT-H-14.safetensors` — HF `h94/IP-Adapter`
  (`models/image_encoder/model.safetensors`)

### ipadapter/
- `ip-adapter-faceid-plusv2_sdxl.bin` — HF `h94/IP-Adapter-FaceID`

### upscale_models/
- `4x-UltraSharp.pth` — HF `Kim2091/4x-UltraSharp` (fallback `uwg/upscalers`)

### ultralytics/bbox/
- `face_yolov8m.pt` — HF `Bingsu/adetailer`
- `hand_yolov8s.pt` — HF `Bingsu/adetailer`

> ⚠️ **Modelos de vídeo antigos descontinuados** (NÃO baixar): Wan 2.1 14B, Wan 2.2 A14B
> GGUF (`video/setup_wan.sh` é legado). Migramos pro Wan 2.2 TI2V-5B (acima).

---

## 5. Custom nodes do ComfyUI (instalados por `install_comfyui.sh`)
Em `/workspace/ComfyUI/custom_nodes/`:
- ComfyUI-Manager — `ltdrdata/ComfyUI-Manager`
- ComfyUI-WanVideoWrapper — `kijai/ComfyUI-WanVideoWrapper`
- ComfyUI-VideoHelperSuite — `Kosinkadink/ComfyUI-VideoHelperSuite`
- ComfyUI_IPAdapter_plus — `cubiq/ComfyUI_IPAdapter_plus`
- ComfyUI-Impact-Pack — `ltdrdata/ComfyUI-Impact-Pack`
- ComfyUI-Impact-Subpack — `ltdrdata/ComfyUI-Impact-Subpack`
- rgthree-comfy — `rgthree/rgthree-comfy` (deps já vêm na imagem Docker)

Dependências Python (torch, insightface, onnxruntime, ultralytics, dill, gguf, e os
requirements de cada node) **vêm da imagem Docker** (`Dockerfile`), não do volume.

---

## 6. Workflows (baked na imagem em `/workflows/`, e copiados p/ o volume)
- `txt2img.json`, `img2img.json`, `upscale.json`, `video_i2v.json` (Wan 5B).
O `handler.py` prioriza `/workflows` (da imagem) sobre `/workspace/workflows` (volume),
então a fonte de verdade é o repositório.

---

## 7. Variáveis de ambiente

### 7.1 Webapp (Railway) — configurar no serviço do site
| Var | Para quê |
|---|---|
| `DATABASE_URL` / `DATABASE_PUBLIC_URL` | Postgres |
| `SECRET_KEY` | sessão Flask |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | admin inicial |
| `APP_PASSWORD` | (legado) |
| `PUBLIC_BASE_URL` | `https://egglee.com` |
| `RUNPOD_API_KEY` / `RUNPOD_ENDPOINT_ID` | chamar o worker serverless |
| `R2_ENDPOINT` / `R2_BUCKET` / `R2_ACCESS_KEY` / `R2_SECRET_KEY` | Cloudflare R2 (mídias) |
| `DEEPSEEK_API_KEY` | chat da persona |
| `OPENROUTER_API_KEY` | vídeo via API |
| `ZETTPAY_BASE_URL` / `ZETTPAY_AUTH_URL` / `ZETTPAY_CLIENT_ID` / `ZETTPAY_CLIENT_SECRET` | PIX (Pro) |
| `DISPATCH_LIMIT` | (opcional) concorrência do dispatcher (padrão 3) |
| `PORT` | porta (Railway injeta) |

### 7.2 Deploy do worker (GitHub → RunPod)
- **Secret** `RUNPOD_API_KEY` — no repositório GitHub (Settings → Secrets).
- **Variable** `RUNPOD_ENDPOINT_ID` — no repositório GitHub (Settings → Variables).
- GHCR usa o `GITHUB_TOKEN` automático. Imagem: `ghcr.io/originslone-sys/egglee:latest`.

### 7.3 Setup dos modelos (na Pod, temporário)
- `CIVITAI_TOKEN` — obrigatório p/ `download_models.sh`.
- `HF_TOKEN` — opcional (só se algum repo HF exigir auth).

---

## 8. Config da personagem (referência)
`characters/model.json` (baked na imagem — no repo, não se perde):
- `positive_prompt`: `eg1woman, woman, fully clothed, candid amateur iphone selfie...`
- `negative_prompt`: anti-deformação + trava de conteúdo (sem nudez/menores).

Stack de LoRA padrão do admin (`handler.py::DEFAULT_LORAS`):
| LoRA | peso |
|---|---|
| `egglee_character.safetensors` | 0.8 |
| `skin_detail_xl.safetensors` | 0.4 |
| `detail_tweaker_xl.safetensors` | 0.3 |
| `mobile_photography.safetensors` | 0.4 |
| `hand_fix_xl.safetensors` | 0.5 |

Config de vídeo (Wan 5B): 720p, 24fps, 121 frames (~5s), KSampler euler/simple, cfg 5,
shift 8. Custo ~4 min/clipe na RTX A4500.

---

## 9. Checklist rápido de recuperação
- [ ] **(antes)** backup de `egglee_character.safetensors` + LoRAs treinados
- [ ] criar novo Network Volume + Pod montando em `/workspace`
- [ ] `install_comfyui.sh`
- [ ] `download_models.sh` (com `CIVITAI_TOKEN`)
- [ ] restaurar `egglee_character.safetensors` do backup
- [ ] endpoint serverless apontando pro novo volume + imagem `:latest`
- [ ] testar txt2img e vídeo Wan 5B pelo painel admin
- [ ] confirmar que R2, Postgres e Railway seguem intactos (não dependem do volume)
