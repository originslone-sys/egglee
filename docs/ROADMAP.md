# Egglee — Roadmap & Registro de Decisões

> Documento vivo. Registra as decisões tomadas, o que já está pronto e o que
> pretendemos construir. Serve pra alinhar antes de investir tempo/dinheiro.
> Última atualização: 2026-07-02.

---

## 1. Visão do produto

Estúdio de criação de conteúdo com IA para uma **influenciadora virtual / modelo de IA**:
- **Geração de imagens** ultrarrealistas de um personagem consistente.
- **Geração de vídeo** (I2V) com movimento humano sutil e realista.
- **Persona com chat** público (estilo mensageiro) como funil pros fãs.
- **Painel admin** ("agência") pra gerenciar tudo.

**Limite de conteúdo (inegociável):** consensual, estilo Instagram/sensual —
**sem nudez explícita**. A persona é flertante, mas desvia o explícito pro CTA.

---

## 2. Estado atual (o que já está pronto)

- **Worker RunPod Serverless (ComfyUI)** — geração de imagem SDXL, upscale,
  FaceDetailer, stack dinâmico de LoRA (Power Lora Loader), gerenciador de
  modelos (baixar/listar/excluir checkpoints e LoRAs), seletor de checkpoint.
- **LoRA do personagem** treinado (v2 com auto-captions, só fotos não-explícitas).
- **Vídeo** — dois caminhos: API (OpenRouter/Kling/Seedance) e self-host Wan 2.2.
  Trava fixa de segurança/qualidade ("ler a imagem + só movimento humano
  realista", anti-morphing) aplicada nos dois.
- **Painel admin** ("Dark Premium") — Dashboard, Gerar, Biblioteca, Persona,
  Modelos, Leads. Responsivo. Thumbnails otimizados (posters JPEG no R2).
- **Chat público** (`/chat`) — persona via **DeepSeek**, histórico local,
  galeria, banner CTA, slot de ads (em iframe isolado).
- **Landing premium** (`/premium`) — lista de espera (e-mail + WhatsApp),
  vitrine de demonstração selecionável pelo admin, sem preço/limites.
- **Painel de leads** (`/leads`) — lista, busca, stats, links wa.me/mailto,
  export CSV, seleção da vitrine.
- **Infra** — Flask no Railway, Postgres (metadados/settings/leads),
  Cloudflare R2 (mídia). Domínio `egglee.com`.

---

## 3. Decisão comercial: virar SaaS multi-tenant (Formato B)

**Objetivo:** cada cliente tem sua própria biblioteca, gerador e persona/página.

### Decisões tomadas
- **Formato B (personagens sintéticos):** o cliente **não** treina LoRA de
  pessoa real. Treino de LoRA fica **só no painel admin**.
- **Disponibilidade de LoRA (decisão 2026-07-02):** no painel admin há um
  **toggle "disponível pro cliente"** por LoRA. LoRA marcado fica disponível
  pra **TODOS** os clientes (pool compartilhado — NÃO é atribuição por usuário).
  - Consequência: personagens/estilos são **compartilhados** entre clientes
    (sem exclusividade por cliente). O LoRA pessoal do dono (egglee_character)
    só aparece pro cliente se for **marcado** — por padrão fica privado.
- **img2img/upload de imagem:** permanece como ferramenta do painel do cliente.
  Responsabilidade de uso transferida via **Termos de Uso claros**.
- **Sem moderação manual de prompt** (decisão do cliente-dono, coberta por ToU).

### Requisitos inegociáveis (pra não quebrar juridicamente / manter pagamento)
> ToU cobre a maioria dos casos, **mas não** cobre CSAM e NCII (deepfake íntimo).
> Processadores de pagamento (Stripe/Visa/MC) e hosts derrubam a conta
> independente de ToU. Portanto, o **mínimo automático** abaixo é obrigatório:
- **Gate automático** na saída: classificador de **idade aparente** + detecção
  de **CSAM** (via API). ~1 chamada por geração, roda sozinho. Não é time humano.
- **Verificação 18+** no cadastro (exigência de processador).
- **Canal de denúncia/takedown** (exigência de host/lei).
- **Processador de pagamento adequado** a conteúdo sensual (avaliar CCBill/
  Segpay se Stripe recusar).
- **Exclusão de dados (LGPD/GDPR):** apagar conta → purgar R2 + banco.

### Trabalho técnico do multi-tenant
> **FASE 1 — CONCLUÍDA (2026-07-02):** contas + auth + papéis.
> - Tabela `users` (email único, hash de senha via werkzeug, role, status, plan).
> - Login por e-mail+senha, cadastro (`/signup`), logout, sessão.
> - Papéis **admin × cliente**; `admin_required` nas rotas do painel.
> - Bootstrap do admin (dono) via `ADMIN_EMAIL`/`ADMIN_PASSWORD` (ou `APP_PASSWORD`
>   legado — login com e-mail em branco + senha antiga ainda funciona).
> - **Isolamento ainda NÃO existe** → clientes logados caem em `/conta`
>   (placeholder), sem acessar o painel/dados. Isso é a Fase 2.
> - Admin gerencia contas em `/usuarios` (criar/ativar/desativar/papel/senha).

1. **Contas de usuário:** tabela `users` (signup, hash de senha, e-mail, reset). ✅
2. **Isolamento de dados:** `user_id` em **toda** tabela + filtro em toda query. ✅
   > **FASE 2 — CONCLUÍDA (2026-07-02):**
   > - `user_id` em `media`, `folders`, `prompt_presets`; tabela `user_settings`
   >   (persona/página/galeria/vitrine por usuário) + índices por `user_id`.
   > - **Toda** query de biblioteca/pastas/presets/persona filtra pelo dono;
   >   serving de mídia (`/api/media`, `/api/thumb`) verifica propriedade.
   > - Front público (`/chat`, `/premium`) serve a persona do **dono** (`owner_uid`).
   > - **Backfill idempotente:** dados existentes viram do admin; settings globais
   >   dele (persona/página/galeria/vitrine) migram pro `user_settings`.
   > - Settings de infra (civitai_token, caches, checkpoint ativo, watermark)
   >   seguem **globais** (do dono/admin) de propósito.
2b. **App do cliente (estúdio)** — versão restrita.
   > **FASE 3A — CONCLUÍDA (2026-07-02):** casca do estúdio.
   > - `slug` por usuário; chat público do cliente em **`/u/<slug>`** (persona/
   >   galeria isoladas). `/chat` segue sendo do dono (admin).
   > - Cliente acessa **`/studio`**, **`/library`** e **`/persona`** próprios;
   >   nav por papel; botões admin-only e de **geração escondidos** (é 3B).
   > - `_role_gate` libera só o estúdio; geração/treino/modelos/leads/premium
   >   continuam `admin_required`.
   > **FASE 3B — CONCLUÍDA (2026-07-02):** gerador do cliente.
   > - Painel Modelos: toggle **🌐 disponível pro cliente** por LoRA/checkpoint
   >   (settings globais `client_loras`/`client_checkpoints`).
   > - Worker parametrizado: `apply_lora_stack(..., character_lora)` — admin força
   >   `egglee_character`; **cliente não herda nada** do dono (rebuild feito).
   > - `/studio/gerar`: gerador do cliente (txt2img/img2img/vídeo 5B) só com os
   >   modelos liberados; salva na biblioteca dele.
   > - `/api/generate` **valida no servidor** (checkpoint/LoRAs ∈ pool liberado;
   >   workflow permitido) — bloqueio real, não cosmético.
   > - **FALTA (Fase 4+):** cotas/créditos, fila com prioridade, teto de custo.
3. **Storage:** R2 com prefixo por tenant (`u/<id>/...`) + controle de acesso.
4. **Fila robusta + cotas** (Fase 4).
   > **FASE 4 — CONCLUÍDA (2026-07-02):** fila persistente + cotas por plano.
   > - Modelo (decidido com o dono, NÃO é crédito clássico):
   >   - **Free:** 5 gerações de imagem + 3 de vídeo — teto **vitalício** (trial).
   >   - **Pro:** **ilimitado**, mas **máx. 10 requisições na fila** ao mesmo tempo.
   >   - **Admin:** gera direto (sem fila) → **fura a fila** dos clientes.
   > - Tabela `jobs` + **dispatcher em background** (thread): despacha por
   >   prioridade sob um `DISPATCH_LIMIT` (clientes segurados → admin passa na
   >   frente), acompanha no RunPod e salva o resultado na biblioteca do dono.
   > - `/api/jobs` (cria+valida cotas/concorrência), `/api/client/quota`.
   > - **Gerar não-bloqueante** + área **/studio/fila** (Requisições:
   >   pendentes/processando/concluídas/falhas, auto-refresh, cancelar da fila).
   > - Admin define plano free/pro por usuário em `/usuarios`.
   > - Regras em `PLAN_RULES` (ajustáveis). Admin permanece no fluxo direto atual.
5. **Billing:** assinatura (Stripe/processador) ligada ao plano.
7. **Chat por tenant:** subdomínio/slug (`fulana.egglee.com`), rate-limit,
   proteção contra prompt-injection do visitante.

> **Decisão de escopo:** a página **`/premium` (lista de espera + vitrine) e os
> `/leads` são SÓ do admin** — NÃO são por-tenant. Rotas de gestão são
> `admin_required`; a vitrine é fixada no `owner_uid`. Na Fase 3, o **`/chat`
> vira por-tenant**, mas o `/premium` continua exclusivo do admin.

---

## 4. Fila de processamento (prioridade técnica do SaaS)

Princípio: **desacoplar** o pedido do processamento. O request só **enfileira**.

- **Persistir job no Postgres** (`jobs`: id, user_id, status, payload, tentativas,
  timestamps). A fila é o banco → sobrevive a restart.
- **Status:** `queued → processing → done/failed`, com poll no front.
- **RunPod já enfileira nativamente;** nossa camada garante retry com backoff,
  timeout e "não falhar, só aguardar a vez".
- **Concorrência por usuário** (ex.: máx. 2 jobs simultâneos) → um cliente não
  entope a fila dos outros.
- **Idempotência** (chave única por job) → retry não duplica.
- **Dead-letter** → job que falhou N vezes vai pra "falhou" com motivo.
- **Só entra se tiver crédito.**

---

## 5. Decisão de vídeo (modelo e custo)

### Problema
O worker roda **Wan 2.2 I2V-A14B (Q8, 2 experts)** — 14B params, precisa de
**40–48 GB VRAM** em 480p. Na RTX A4500 (20 GB) ele **offloada pra RAM** →
**10–20+ min por clipe de 5s** (comportamento documentado), e estourou o
timeout de 1200s. **Não é bug: é modelo pesado demais pra placa.**

### Fatos (dados reais — ver Fontes)
- **A14B GGUF com offload:** 10–20+ min/clipe em VRAM baixa (documentado).
- **Wan 2.2 TI2V-5B:** 5s **720p em <9 min** numa 4090; **480p ~4 min** (oficial).
  Cabe em GPU de consumo, sem offload. Qualidade "levemente inferior ao 14B,
  porém mais rápido e menos VRAM".

### Opções
| Opção | Qualidade | Velocidade | Esforço |
|---|---|---|---|
| A14B hoje (A4500) | alta (mas 480p) | ❌ 20min+/timeout | — |
| **Wan 5B self-host** | boa; ótima pra I2V sutil; **720p nativo** | ✅ single-digit min (est.) | rebuild + baixar modelo |
| **API (Kling/Seedance)** | aceitável | ✅ segs–min | já pronto |
| Q4 do A14B (paliativo) | quase igual | só melhora com GPU 24GB | baixar quant |

### Direção recomendada
- **Curto prazo / SaaS:** **API** como caminho principal de vídeo (escala sem
  gerenciar GPU; custo previsível).
- **Self-host (se quiser independência):** migrar pro **Wan 5B** (não o A14B).
- **Mais workers NÃO acelera** um vídeo (é paralelismo entre jobs). **Active
  workers = pagar GPU parada** → manter em 0.

> **DECIDIDO (2026-07-02): migrar self-host pro Wan 2.2 TI2V-5B.** Implementado
> no código (workflow + handler + params). **Pendente:** baixar o modelo no
> volume e rodar teste real cronometrado. Detalhes técnicos abaixo.

### Migração pro Wan 5B — o que mudou no código
- `workflows/video_i2v.json` reescrito: **modelo único** `wan2.2_ti2v_5B_fp16`
  (UNETLoader), **1 KSampler** (sem split MoE), node `Wan22ImageToVideoLatent`,
  **VAE novo** `wan2.2_vae.safetensors`, mesmo text encoder `umt5_xxl_fp8`.
- `app.py`: vídeo agora **720p nativo @ 24fps**, 121 frames/5s, 30 passos
  single-pass, dims múltiplas de 32. Removido `split_step`.
- `setup/download_models.sh`: baixa o 5B + VAE 2.2 do repo Comfy-Org repackaged.
- **Ação manual necessária:** baixar os arquivos no **network volume** (o
  rebuild da imagem NÃO baixa modelos). Sem isso, o worker dá "model not found".
- **Ajustes finos possíveis após teste:** `steps` (30→20 p/ velocidade),
  `shift` (8.0; menor = menos movimento), resolução (720p↔480p).

---

## 6. Provedor de GPU — RunPod é a melhor escolha?

**Resumo:** para o nosso perfil (ComfyUI custom, container próprio, modelos em
network volume, tráfego irregular/bursty, sensível a custo), **sim — o RunPod
é uma das melhores relações custo/benefício e faz sentido continuar.** O ponto
fraco real que sentimos é **disponibilidade de GPU (throttling)** numa região só.

### Por quê RunPod encaixa
- **Escala a zero** (não paga ocioso) — essencial com tráfego irregular.
- **Container próprio + network volume** — precisamos disso pro ComfyUI custom.
- **Per-segundo/ms barato** (4090 ~$0.20–0.69/h conforme cloud).

### Alternativas (e por que NÃO trocar agora)
- **Modal** — ótima DX e escala, mas **mais caro** sob carga sustentada.
- **Fal.ai** — excelente pra mídia e cold start rápido, porém mais orientado a
  modelos hospedados; premium.
- **Replicate** — o mais fácil, mas **markup por geração**; bom pra API, caro.
- **Vast.ai / Lambda** — GPU crua **mais barata**, mas **sem scale-to-zero**
  (paga ocioso) → ruim pra SaaS bursty no início.

### Recomendações práticas
- Manter RunPod; **habilitar mais tipos de GPU/regiões** pra reduzir throttling.
- **Tirar o vídeo pesado da conta** (via API ou Wan 5B) diminui muito a
  dependência de GPU grande.
- Reavaliar só se: throttling persistir muito, ou o volume ficar previsível o
  bastante pra reserva (aí Vast/Lambda podem baratear).

---

## 7. Configuração do endpoint RunPod (GPU) — economia

**Como funciona a cobrança:** paga-se **por segundo só da GPU que rodou** o job;
escala a zero quando ocioso. Você só paga pela config **disponível no momento**.

**Regra de ouro:** `custo do job = preço/segundo × tempo`. Uma GPU 5x mais cara
que roda 2x mais rápido **sai mais cara no total**. **Velocidade ≠ economia.**

### Erros a evitar (aprendido na prática)
- **Não** colocar a GPU **mais cara como prioridade 1.** Isso força **todo** job
  (inclusive geração de imagem, que roda numa 16GB por ~$0.00016/s) numa GPU de
  ~$0.00240/s → até ~15x mais caro sem ganho (SDXL usa ~10GB, não satura a placa).
- **Não** desabilitar as GPUs pequenas se o endpoint também faz imagem.

### Configuração recomendada
- **Ordem de prioridade: do mais barato → mais caro.** A GPU barata-que-funciona
  como 1ª; as grandes como **fallback** só quando a barata está indisponível.
  (Mesma disponibilidade contra throttling, custo muito menor.)
- **Habilitar vários tipos de GPU** ajuda contra throttling (mais oferta no pool).
- `max workers`: 1–2 (2 só melhora **vazão** com fila, não a velocidade de 1 job).
- `active workers`: **0** (senão paga GPU parada 24/7).

### Referência de custo (números reais do painel + estimativa de tempo)
| GPU | Preço/s | Vídeo 5s (est.) | Custo do job |
|---|---|---|---|
| 16GB | $0.00016 | (ideal p/ imagem) | ~centavos |
| 32GB PRO | $0.00044 | ~4 min | ~$0.11 |
| 180GB B200 | $0.00240 | ~2 min | ~$0.29 |

> A 180GB é mais rápida, mas o mesmo vídeo sai **~3x mais caro**.

### O conserto de fundo
A razão de sermos empurrados pra GPU cara é o **A14B de vídeo** (pesado, exige
placa grande). Resolvendo o vídeo (**Wan 5B** ou **API**), **tudo cabe em
16–24GB** e o endpoint inteiro volta a rodar em GPU barata — melhor economia.
Enquanto o A14B seguir self-host, considerar **endpoint separado** pra vídeo
(GPU maior) e manter o de imagem em GPU pequena.

### Auto scaling (quando ligar worker novo)
Define **como o RunPod decide escalar** (é a fila nativa dele):
- **Queue delay** (por tempo de espera): liga worker quando um job fica X
  segundos esperando na fila. Ex.: `4 sec` = espera 4s sem processar → sobe 1.
- **Request count** (por quantidade): liga worker baseado no **número** de
  pedidos acumulados na fila, não no tempo.

Trade-off do valor (no Queue delay):
- **Menor (1–2s)** → escala **rápido/agressivo**; bom se o **cold start é curto**;
  custa mais (liga worker mais fácil).
- **Maior (8–15s)** → escala **devagar/econômico**; bom se o **cold start é
  longo** (não adianta ligar rápido, o worker demora a subir mesmo).

**Nosso caso:** cold start é **longo** (sobe ComfyUI + carrega modelos/LoRAs
grandes do volume). Então **4–8s está bom**; ser agressivo só gasta mais sem
ganho. Com 1 usuário isso quase não importa (raramente há fila); passa a
importar de verdade **no SaaS**, com vários gerando ao mesmo tempo — aí esse
botão equilibra **rapidez de resposta × custo**.

---

## 8. Decisões em aberto (aguardando o dono)

- [x] Vídeo: **migrar pro Wan 5B** — DECIDIDO e implementado (2026-07-02).
      Falta baixar o modelo no volume + teste real.
- [ ] Iniciar o **multi-tenant** (contas + isolamento + fila) — só depois de
      validar demanda pela lista de espera.
- [ ] Definir **planos/limites** (cotas) — quando for precificar.
- [ ] Escolher **processador de pagamento** (testar Stripe; plano B especializado).
- [ ] Ajustar prioridade de GPU do endpoint RunPod (barato→caro) — ver seção 7.

---

## Fontes (dados de vídeo e GPU)
- Wan 2.2 TI2V-5B — Hugging Face: https://huggingface.co/Wan-AI/Wan2.2-TI2V-5B
- Wan 2.2 — GitHub: https://github.com/Wan-Video/Wan2.2
- Wan VRAM guide (5B/14B): https://willitrunai.com/blog/wan-2-2-vram-requirements
- Spheron — GPU setup Wan 2.2: https://www.spheron.network/blog/deploy-wan-2-1-ai-video-generation-gpu-setup/
- RunPod pricing: https://www.runpod.io/pricing
- Serverless GPU comparison 2026: https://www.runpod.io/articles/guides/top-serverless-gpu-clouds
- GPU price comparison (Lambda/RunPod/Vast): https://altstreet.investments/tools/gpu/gpu-price-comparison
