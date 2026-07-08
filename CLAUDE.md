# Egglee — Instruções do projeto (LER SEMPRE)

## Princípios de trabalho (regra fixa, definida pelo dono)

O dono paga por token e tem limite. Ciclos desperdiçados (rebuild, render, retrabalho)
custam dinheiro real. Portanto:

1. **Assuma SEMPRE que o objetivo é o MELHOR resultado possível.** Nunca entregue uma
   versão "MVP/mais fácil de implementar" que produz resultado ruim e a deixe pro dono
   avaliar como se fosse o entregável. Vá direto no caminho que dá o melhor resultado.

2. **Responda ANTES de codar, sem o dono precisar perguntar:**
   - Essa é mesmo a melhor opção pra esse objetivo?
   - O resultado vai ser bom? (expectativa honesta de qualidade)
   - Existe um caminho melhor? Se existir, **recomende ESSE primeiro.**

3. **Seja honesto sobre qualidade ANTES de gastar** token/GPU/rebuild — não depois.
   Se algo provavelmente vai ficar ruim, diga isso de cara e não siga por ali.

4. **Se um passo intermediário/teste for mesmo necessário**, deixe explícito que é só
   para provar encanamento — não peça pro dono julgar a qualidade dele.

5. **Minimize ciclos.** Pesquise/valide o suficiente pra acertar de primeira em vez de
   iterar às cegas (cada rebuild ~8min + custo de GPU; cada render custa).

## Contexto rápido da stack
- Webapp Flask no **Railway** (deploy ~1min por push). Postgres no Railway. Mídias no
  **Cloudflare R2**. Worker **RunPod Serverless** (ComfyUI) — mudanças em `handler.py`/
  `workflows/`/`Dockerfile` exigem **rebuild** via GitHub Actions (`.github/workflows/
  deploy.yml` → GHCR → atualiza endpoint). Modelos ficam no **Network Volume** do RunPod.
- Docs de decisão em `docs/`: `ROADMAP.md`, `FEATURE_DANCA.md`, `RECUPERACAO_VOLUME.md`.
- Branch de trabalho atual: `claude/inspiring-ramanujan-j5qm8z`.
