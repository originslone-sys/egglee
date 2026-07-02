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
  pessoa real. Treino de LoRA fica **só no painel admin**; o admin decide
  quais LoRAs ficam disponíveis pra quais clientes (unicidade sob controle).
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

### Trabalho técnico do multi-tenant (a fazer)
1. **Contas de usuário:** tabela `users` (signup, hash de senha, e-mail, reset).
2. **Isolamento de dados:** `user_id` em **toda** tabela (`media`, `folders`,
   `prompt_presets`, `settings`/persona, `leads`) + filtro em toda query.
3. **Storage:** R2 com prefixo por tenant (`u/<id>/...`) + controle de acesso.
4. **Fila robusta** (crítico — ver seção 4).
5. **Cotas + billing:** créditos por plano (imagem/vídeo/chat), Stripe, medição.
6. **Teto de custo por usuário** (evita queimar GPU com script/abuso).
7. **Chat por tenant:** subdomínio/slug (`fulana.egglee.com`), rate-limit,
   proteção contra prompt-injection do visitante.

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

> **Pendente de decisão do dono** (não implementar ainda): API como padrão vs
> migrar pro Wan 5B. Analisar exemplos de vídeo do 5B antes.

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

## 7. Decisões em aberto (aguardando o dono)

- [ ] Vídeo: **API como padrão** vs **migrar pro Wan 5B**.
- [ ] Iniciar o **multi-tenant** (contas + isolamento + fila) — só depois de
      validar demanda pela lista de espera.
- [ ] Definir **planos/limites** (cotas) — quando for precificar.
- [ ] Escolher **processador de pagamento** (testar Stripe; plano B especializado).

---

## Fontes (dados de vídeo e GPU)
- Wan 2.2 TI2V-5B — Hugging Face: https://huggingface.co/Wan-AI/Wan2.2-TI2V-5B
- Wan 2.2 — GitHub: https://github.com/Wan-Video/Wan2.2
- Wan VRAM guide (5B/14B): https://willitrunai.com/blog/wan-2-2-vram-requirements
- Spheron — GPU setup Wan 2.2: https://www.spheron.network/blog/deploy-wan-2-1-ai-video-generation-gpu-setup/
- RunPod pricing: https://www.runpod.io/pricing
- Serverless GPU comparison 2026: https://www.runpod.io/articles/guides/top-serverless-gpu-clouds
- GPU price comparison (Lambda/RunPod/Vast): https://altstreet.investments/tools/gpu/gpu-price-comparison
