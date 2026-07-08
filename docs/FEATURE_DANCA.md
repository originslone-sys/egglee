# Feature: "Dancinha do TikTok" na animação de vídeo (painel ADMIN)

> Status: **IMPLEMENTADO (MVP com Canny) — FALTA 1 RENDER DE VALIDAÇÃO no pod.**
> Data da análise: 2026-07-03. Implementação: 2026-07-08. Modelo: **Wan 2.2 Fun-Control 5B**.

## ✅ O que já foi implementado (2026-07-08)
- **Modo "Dança (TikTok)"** no gerador admin (`index.html`): sobe imagem de referência
  (a modelo) + vídeo-guia da dança. Só admin.
- **Fluxo do vídeo-guia:** navegador → base64 → `app.py::_upload_control_video` sobe no
  **R2** → URL presigned no payload (evita limite do RunPod). Worker baixa por ela.
- **`handler.py::prepare_control_video`:** baixa o guia, `ffmpeg` corta os **primeiros 5s**,
  ajusta fps e casa dimensões (cover+crop) → salva no input do ComfyUI.
- **`workflows/video_dance.json`:** Fun-Control 5B + `VHS_LoadVideo` → **Canny** →
  `WanFunControlToVideo` → KSampler → mp4. Roda pelo caminho de vídeo single-pass (5s).
- **`setup/download_models.sh`:** baixa `wan2.2_fun_control_5B_bf16.safetensors` (mesmo
  repo; reaproveita VAE + text encoder que já temos).

## ⚠️ FALTA para ativar (checklist de ativação)
1. **Baixar o modelo no volume:** rodar `setup/download_models.sh` num pod (só o
   Fun-Control é novo, ~alguns GB).
2. **Rebuild do worker:** o push já dispara o GitHub Actions (handler + workflow entram na
   imagem). Confirmar que o endpoint pegou a `:latest`.
3. **1 render de teste** com uma foto + um clipe de dança curto → ver se a coreografia
   transfere. **Não pude testar o grafo do ComfyUI daqui** (nós `WanFunControlToVideo`/
   `Canny`/`VHS_LoadVideo` dependem da versão instalada) — é o passo que valida.
4. Se o Canny decepcionar → **upgrade pra DWPose** (troca só o nó de preprocess no
   `video_dance.json` + instalar `comfyui_controlnet_aux` e seus modelos de pose).

## Objetivo
Um **toggle no gerador admin** (ativar/desativar) que, quando ligado, faz a modelo da
imagem de origem **executar uma dança** na animação de vídeo. Precisa ser **muito bom** e
entregar resultado satisfatório — não um "balançado" morno.

Escopo inicial: **só painel admin**. Depois, se maduro, avaliar liberar pro cliente.

## Como a geração de vídeo funciona hoje (base pra implementar)
Dois caminhos, **ambos só com prompt de texto** (sem controle de pose):
- **API** → `webapp/video.py` (OpenRouter). Entra em `app.py::video_generate` (~L871).
  Sem campo de negativo; a trava vai junto no prompt.
- **Local** → Wan 2.2 TI2V-5B via ComfyUI (`workflows/video_i2v.json`, `handler.py`).
  Entra em `app.py` no ramo local (~L580). Placeholders: positive/negative/input_image/
  width/height/length/seed/steps/frame_rate.

Trava fixa atual em `webapp/app.py` (~L58): `VIDEO_MOTION_LOCK` + `VIDEO_MOTION_NEG`.
Hoje ela pede **movimento SUTIL** (respiração, leve balanço) — o **oposto** de dança.
Config local: 720p, 24fps, 121 frames (~5s), KSampler euler/simple, cfg 5, shift 8.
Custo medido: **~4 min por clipe de 5s** na RTX A4500 (20 GB).

## A verdade técnica (por que a rota importa)
- **Texto puro (i2v)** é bom em movimento *ambiente*. Uma **coreografia específica** de
  TikTok (braços/pernas pelo espaço em 5s) via texto é **pouco confiável**: tende a virar
  "dança genérica" com risco de distorção de membros. Pesquisa confirma degradação de
  naturalidade/consistência 3D sob movimento grande.
- **Dança de verdade = pose-driven**: Wan 2.2 Animate / VACE / Fun-Control pega a foto +
  um **vídeo de referência de dança** e copia a coreografia exata, preservando identidade.
  É o caso de uso padrão da comunidade pra "foto → TikTok dancer".

Fontes:
- https://huggingface.co/Wan-AI/Wan2.2-TI2V-5B
- https://docs.comfy.org/tutorials/video/wan/wan2-2-animate
- https://www.runcomfy.com/comfyui-workflows/wan-2-2-vace-in-comfyui-pose-driven-motion-video-workflow
- https://civitai.com/models/1912627/wan22-5b-fun-control-fast-video-controlnet
- https://www.veed.io/learn/wan-2-2-prompting-guide

## As duas rotas

### Rota A — Toggle de prompt de dança (rápida)
- Só webapp + ajuste de parâmetros. Funciona em **API e local**.
- Injeta um **prompt de dança engenheirado** (identidade travada, mas permitindo movimento
  amplo), um **negativo específico** anti-distorção, e um **perfil de parâmetros** pró-
  movimento. Oferecer 2-3 "estilos" de dança.
- ⚠️ Resultado esperado: "a modelo dança genericamente", **não** coreografia reconhecível.
  Taxa de acerto média. Serve de stopgap / clipe de vibe.

### Rota B — Pose-driven (resultado de verdade)
- A modelo **copia a coreografia** de um vídeo de referência. Identidade preservada.
- **Só no caminho LOCAL** (a API OpenRouter não recebe vídeo-guia de pose).
- **Usar a variante 5B (VACE / Fun-Control), NÃO a 14B.**
  - 14B "Wan Animate completo" = mesmo problema do A14B que já rejeitamos: offload na nossa
    GPU → ~20 min/clipe. ❌ Evitar.
  - VACE/Fun-Control **5B** = mesmo backbone de hoje (~4 min/5s) + extração de pose (DWPose,
    leve) + carregar modelo de controle. Estimativa: **+20-40%** de tempo p/ mesma duração
    (~5-7 min por 5s). ✅ Viável no nosso setup.
- **Custo real escala com a DURAÇÃO** (linear): 15s ≈ 3x de 5s. Manter clipes curtos (~5s)
  mantém o custo perto do atual.
- Insumos extras necessários:
  - modelos no volume (Fun-Control 5B + detector de pose DWPose) → **rebuild do worker (~8min)**
  - **biblioteca de vídeos-guia de dança** (clipes de referência p/ copiar a pose) — DECISÃO PENDENTE

### 🔎 Pesquisa técnica confirmada (2026-07-07) — Wan 2.2 Fun-Control 5B
Ótima notícia: a variante escolhida **reaproveita quase tudo que já temos**. Só há **1 modelo
novo** a baixar.

- **Modelo de controle (ÚNICO novo):** `wan2.2_fun_control_5B_bf16.safetensors`
  → repo **`Comfy-Org/Wan_2.2_ComfyUI_Repackaged`**, pasta `split_files/diffusion_models/`
  → vai em `ComfyUI/models/diffusion_models/` (é o **MESMO repo** de onde já baixamos o
  `wan2.2_ti2v_5B_fp16` — dá pra adicionar no `download_models.sh` com uma linha).
- **VAE:** **o mesmo** `wan2.2_vae.safetensors` que já temos. ✅ (não re-baixar)
- **Text encoder:** **o mesmo** `umt5_xxl_fp8_e4m3fn_scaled.safetensors` que já temos. ✅
- **Custom nodes:** o **Kijai `ComfyUI-WanVideoWrapper`** (que **já instalamos**) traz os
  workflows de exemplo do Fun-Control. Único node novo: **`comfyui_controlnet_aux`**
  (DWPose) p/ extrair a pose do vídeo-guia. (Alternativa sem node extra: usar Canny em vez
  de pose — mais simples, porém menos fiel a dança.)
- **Como alimenta:** entra **1 imagem de referência** (a modelo) + **1 vídeo-guia** de dança.
  O preprocessador (DWPose/Canny) extrai o controle quadro a quadro; o sampler aplica a
  modelo por cima da pose. Tipos suportados: **Pose** (ideal p/ dança), Depth, Canny, MLSD.
- **VRAM/limites:** roda em 10 GB (512px, 3-4s) e **12 GB já faz 720p 5-8s**. Nossa **A4500
  20 GB folga** → 720p 5s tranquilo. Confirma a estimativa: custo ~igual ao vídeo atual.
- **Footprint real da implementação:** 1 modelo (~alguns GB) + 1 custom node (DWPose) +
  1 workflow novo (`video_dance.json`) + branch no `handler.py` p/ receber o vídeo-guia.

Fontes: [Comfy-Org repackaged (diffusion_models)](https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged/tree/main/split_files/diffusion_models),
[arquivo do modelo](https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged/blob/main/split_files/diffusion_models/wan2.2_fun_control_5B_bf16.safetensors),
[Fun-Control workflow (Civitai)](https://civitai.com/models/1912627/wan22-5b-fun-control-fast-video-controlnet),
[VACE pose-driven (RunComfy)](https://www.runcomfy.com/comfyui-workflows/wan-2-2-vace-in-comfyui-pose-driven-motion-video-workflow).

## Decisão / plano combinado
**Sequência recomendada (a confirmar na retomada):**
1. **Rota A agora**: toggle de prompt de dança + perfil de parâmetros + estilos. Testar um
   render real. Baixo risco, entrega algo hoje.
2. Se A não satisfizer (provável p/ dança específica) → **Rota B na versão 5B** como versão
   definitiva.

## Pendências a resolver ao retomar
- [ ] Confirmar a sequência (A→B) ou ir direto pra B-5B.
- [ ] **Origem dos vídeos-guia de dança** (rota B): usuário fornece os clipes, ou montamos
      uma pequena biblioteca curada de poses/danças?
- [ ] Definir duração-alvo do clipe de dança (5s p/ manter custo; ou aceitar mais tempo).
- [ ] Rota A: redigir o `DANCE_MOTION_LOCK` + `DANCE_MOTION_NEG` + perfil de KSampler
      (steps/cfg/shift) e validar com render.
- [x] Rota B: escolhido **Fun-Control 5B** (ver pesquisa 2026-07-07). Falta: montar
      `workflows/video_dance.json`, adicionar 1 linha no `download_models.sh`
      (`wan2.2_fun_control_5B_bf16.safetensors`), instalar node `comfyui_controlnet_aux`
      (DWPose) no `install_comfyui.sh`+`Dockerfile`, branch no `handler.py`, rebuild do worker.
- [ ] Decidir preprocessador: **DWPose** (fiel a dança, +1 node) vs **Canny** (mais simples).

## Arquivos que serão tocados
- `webapp/app.py` — novo toggle (`dance`) nos ramos de vídeo (API ~L871 e local ~L580);
  novas constantes `DANCE_MOTION_LOCK`/`DANCE_MOTION_NEG`.
- `webapp/templates/index.html` (gerador admin) — checkbox "Dança (TikTok)" + estilo.
- (Rota B) `workflows/video_dance.json`, `handler.py`, `Dockerfile`/volume, deploy worker.
