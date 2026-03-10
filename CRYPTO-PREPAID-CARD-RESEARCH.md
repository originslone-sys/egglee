# Pesquisa: Plataforma de Cartão Pré-Pago Crypto

> Pesquisa realizada em Março/2026

## TL;DR

**Sim, é possível criar uma plataforma de cartão pré-pago crypto.** Existem diversas APIs e soluções white-label que simplificam significativamente o processo. A burocracia pode ser **minimizada** usando provedores que já possuem licenças (BIN sponsors), mas requisitos de KYC/AML são obrigatórios.

---

## 1. APIs e Provedores Disponíveis

### Tier 1 — Crypto-Nativos (Especializados em Crypto → Card)

| Provedor | Tipo | Bandeira | Destaques |
|----------|------|----------|-----------|
| **Immersve** | Issuing-as-a-Service | Mastercard | Self-custody, smart contracts on-chain, Principal Member da Mastercard. Parceria com Bitget Wallet na LatAm. API docs: docs.immersve.com |
| **Reap** | BaaS + Card Issuing | Visa | Visa Principal Issuer, white-label, stablecoin-powered. Suporte USDC/USDT. Lança programas em semanas. |
| **Baanx** | Card-as-a-Service | Visa/Mastercard | Self-custody, parceria MetaMask/Ledger/Exodus. Smart contracts para autorização em <5s. |
| **Alchemy Pay** | B2B Card Issuing | Visa/Mastercard | API modular, autorizado pela Visa e Mastercard como third-party provider. Licenças em US, Canadá, Indonésia, Lituânia. Suporte KYC-free (virtual). |
| **MoonPay** | Issuing + Ramps | Mastercard | Parceria Mastercard (Mai/2025). Adquiriu Iron para infraestrutura stablecoin. API-driven, 150M+ locais aceitos. |

### Tier 2 — Infraestrutura de Card Issuing (General Purpose)

| Provedor | Foco | Destaques |
|----------|------|-----------|
| **Marqeta** | Enterprise card issuing | API robusta, JIT Funding, $84B+ processados por trimestre. Usado por Square, DoorDash, Klarna. |
| **Lithic** | Startup-friendly | APIs simples, ~$0.05/cartão, sem taxas mensais. Criadores do Privacy.com. |
| **Highnote** | Mid-market | Único processador moderno com issuing + acquiring unificados em uma API (Jan/2025). |
| **Thredd** | Global processing | Infraestrutura de processamento para programas de cartão. Parceiro da Reap. |

### Tier 3 — Soluções Existentes (Referência)

| Produto | Modelo |
|---------|--------|
| **BitPay Card** | Prepaid card com top-up manual via BitPay wallet. Apenas US. |
| **Crypto.com Card** | Modelo próprio com staking de CRO. |
| **Binance Card** | Conversão automática crypto→fiat no momento do gasto. |

---

## 2. Arquitetura Técnica Típica

```
┌─────────────────────────────────────────────────────────┐
│                    FLUXO DO USUÁRIO                      │
│                                                          │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐           │
│  │  Crypto   │───>│ Conversão│───>│  Cartão  │           │
│  │  Wallet   │    │ Crypto→  │    │  Prepaid │           │
│  │           │    │  Fiat    │    │Visa/MC   │           │
│  └──────────┘    └──────────┘    └──────────┘           │
│       │               │               │                  │
│       ▼               ▼               ▼                  │
│  USDT/USDC/     Exchange API/    Merchant POS /          │
│  BTC/ETH        Liquidity Pool   E-commerce              │
└─────────────────────────────────────────────────────────┘
```

### Dois Modelos Principais:

#### Modelo A — Pre-Load (Tradicional)
1. Usuário deposita crypto na plataforma
2. Crypto é convertida em fiat (USD/EUR/BRL)
3. Fiat é carregada no cartão prepaid
4. Usuário gasta normalmente com o cartão

#### Modelo B — Self-Custody / JIT (Moderno)
1. Usuário mantém crypto na própria wallet (self-custody)
2. No momento da compra, smart contract autoriza a transação
3. Crypto é convertida em fiat em tempo real (Just-In-Time)
4. Fiat é liquidada para a rede Visa/Mastercard
5. Usuário nunca perde custódia até o momento do gasto

> **Modelo B** é o mais inovador e usado por Immersve, Baanx e provedores modernos.

### Stack Técnico Necessário:

```
Backend:
├── API Gateway (autenticação, rate limiting)
├── Card Management Service (emissão, bloqueio, limites)
├── Crypto Wallet Integration (Web3.js, ethers.js)
├── Exchange/Liquidity Service (conversão crypto→fiat)
├── KYC/AML Service (verificação de identidade)
├── Transaction Processing (webhooks do issuer)
└── Ledger/Accounting Service

Frontend:
├── App Mobile (React Native / Flutter)
├── Dashboard Web
└── Widget de Ativação do Cartão

Integrações:
├── Card Issuing API (Immersve, Reap, Alchemy Pay, etc.)
├── KYC Provider (Sumsub, Onfido, Jumio)
├── Blockchain RPCs (Infura, Alchemy, QuickNode)
├── Exchange/DEX (para liquidez)
└── Notificações (push, email, SMS)
```

---

## 3. Requisitos Regulatórios

### Por Região:

#### Europa (EU/UK)
- **EMI License** (Electronic Money Institution) — necessário para emitir dinheiro eletrônico
- Processo: 6-18 meses, custo €50K-500K+
- **Alternativa**: Usar um BIN Sponsor (ex: Reap, Immersve) que já possui licença
- PSD2 compliance obrigatório

#### Estados Unidos
- **Money Transmitter License (MTL)** — necessário em cada estado (~47 estados)
- FinCEN registration como MSB (Money Services Business)
- Processo: 12-24 meses, custo $1M+
- **Alternativa**: Parceria com banco sponsor + card issuer licenciado

#### Brasil
- Regulado pelo Banco Central (BCB)
- Necessário: Instituição de Pagamento (IP) ou parceria com IP existente
- Marco Legal de Criptoativos (Lei 14.478/2022)
- Normativas do BCB sobre arranjos de pagamento

#### Hong Kong / Ásia
- SFC licensing para crypto
- Reap é licenciado em Hong Kong e México

### Requisitos Universais:

| Requisito | Descrição | Complexidade |
|-----------|-----------|-------------|
| **KYC** (Know Your Customer) | Verificação de identidade obrigatória | Média — APIs automatizam |
| **AML** (Anti-Money Laundering) | Monitoramento de transações, screening | Média-Alta |
| **PCI DSS** | Segurança de dados de cartão | Alta — mas issuer cuida |
| **GDPR / LGPD** | Proteção de dados pessoais | Média |
| **Sanctions Screening** | Verificação contra listas de sanções | Baixa — APIs automatizam |

### Usando BIN Sponsor (Caminho Mais Rápido):

> Um **BIN Sponsor** é uma instituição financeira licenciada que "empresta" sua licença para você operar sob a regulação dela.

**Vantagens:**
- Não precisa de licença própria (EMI, MTL)
- Time-to-market: semanas em vez de meses/anos
- Custos iniciais muito menores
- O sponsor cuida da compliance pesada

**Provedores que oferecem BIN Sponsorship:**
- Immersve (Mastercard)
- Reap (Visa)
- Alchemy Pay (Visa/Mastercard)
- Marqeta (via bancos parceiros)
- Lithic (via bancos parceiros)

---

## 4. Soluções White-Label

### Opções Turnkey (Menor Burocracia):

| Provedor | O que entrega | Tempo de Lançamento | Custo Estimado |
|----------|--------------|---------------------|----------------|
| **Alchemy Pay** | Card issuing API, KYC integrado, multi-crypto | ~4-8 semanas | Revenue share + taxas por cartão |
| **Reap** | White-label completo, Visa cards, BIN sponsor | ~4-6 semanas | Taxas por transação |
| **Immersve** | Issuing-as-a-service, Mastercard, self-custody | ~6-12 semanas | Revenue share |
| **Baanx** | Card-as-a-service, self-custody, Web3-native | ~8-12 semanas | Personalizado |

### O que uma solução White-Label tipicamente inclui:

- Emissão de cartões (virtuais e físicos)
- Processamento de transações
- Conversão crypto → fiat
- KYC/AML compliance
- Dashboard de administração
- APIs para integração
- Suporte regulatório (licenças do sponsor)
- App customizável (em alguns casos)

---

## 5. Comparativo: Construir vs. White-Label

| Aspecto | Construir do Zero | White-Label |
|---------|-------------------|-------------|
| **Tempo** | 12-24 meses | 4-12 semanas |
| **Custo Inicial** | $500K - $2M+ | $10K - $100K |
| **Licenças** | Precisa obter próprias | Usa do sponsor |
| **Controle** | Total | Limitado ao que a API oferece |
| **Margem** | Maior (longo prazo) | Menor (revenue share) |
| **Risco** | Alto | Baixo-Médio |
| **Complexidade** | Extremamente alta | Baixa-Média |

---

## 6. Recomendação para Começar

### Caminho mais rápido e viável:

1. **Escolher um provedor white-label** como Alchemy Pay ou Reap
2. **Integrar a API** de card issuing no seu app
3. **Usar KYC de terceiro** (Sumsub, Onfido) ou o KYC integrado do provedor
4. **Lançar com cartão virtual** primeiro (mais rápido que físico)
5. **Escalar** para cartão físico e mais regiões depois

### Para o mercado brasileiro/LatAm:

- **Immersve** é a melhor opção — já opera na América Latina (Argentina, México, Colômbia, Chile, Peru, etc.) via parceria com Bitget Wallet
- **Alchemy Pay** também tem presença global
- **Reap** está expandindo para LatAm via parceria com Thredd

### Custos realistas para MVP:

- API fees do issuer: $5K-$20K setup + per-card fees
- Desenvolvimento do app: $20K-$50K
- KYC provider: $1-$5 por verificação
- Infraestrutura: $500-$2K/mês
- **Total estimado para MVP: $30K-$80K**

---

## 7. Links Úteis

- Immersve API Docs: https://docs.immersve.com
- Reap Card Issuing: https://reap.global/products/card-issuing
- Alchemy Pay Card Solution: https://alchemypay.org/card
- Lithic API: https://docs.lithic.com
- Marqeta API: https://www.marqeta.com/docs
- MoonPay Developer Docs: https://dev.moonpay.com
- Baanx: https://www.baanx.com

---

## Conclusão

**Não é tão burocrático quanto parece**, especialmente se você usar provedores white-label que já possuem as licenças necessárias. O mercado evoluiu muito em 2024-2026, com diversas APIs robustas que permitem lançar um cartão crypto prepaid em semanas. A parte mais complexa não é a tecnologia, mas sim a compliance (KYC/AML) — que os provedores white-label já resolvem para você.
