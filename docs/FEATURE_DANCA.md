# Feature: "Dancinha do TikTok" na animação de vídeo (painel ADMIN)

> Status: **PLANEJADO / não implementado.** Registro de decisão para retomar depois.
> Data da análise: 2026-07-03. Modelo local de vídeo atual: **Wan 2.2 TI2V-5B**.

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
  - modelos no volume (VACE/Fun-Control 5B + detector de pose DWPose) → **rebuild do worker (~8min)**
  - **biblioteca de vídeos-guia de dança** (clipes de referência p/ copiar a pose) — DECISÃO PENDENTE

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
- [ ] Rota B: escolher VACE vs Fun-Control 5B, montar `workflows/video_dance.json`, baixar
      modelos no volume, ajustar `handler.py`, rebuild do worker.

## Arquivos que serão tocados
- `webapp/app.py` — novo toggle (`dance`) nos ramos de vídeo (API ~L871 e local ~L580);
  novas constantes `DANCE_MOTION_LOCK`/`DANCE_MOTION_NEG`.
- `webapp/templates/index.html` (gerador admin) — checkbox "Dança (TikTok)" + estilo.
- (Rota B) `workflows/video_dance.json`, `handler.py`, `Dockerfile`/volume, deploy worker.
