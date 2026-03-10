# Simulação Econômica — Plataforma de Fazenda de Galinhas

## 1) Objetivo

Validar se a economia proposta (ração como principal sink, marketplace P2P e evolução ovo → pintinho → galinha adulta) pode se manter sustentável no MVP, com parâmetros simples de administrar em hospedagem cPanel/Hostinger.

## 2) Premissas do Modelo (MVP)

### 2.1 Moeda e unidades
- Moeda oficial: `USDT`.
- Rede oficial de depósito/saque: `BEP20`.
- Precisão monetária: `2 casas decimais`.
- Janela de cálculo: diária, com consolidação mensal para análise.

### 2.2 Ativos iniciais e onboarding
- Usuário novo recebe:
  - `1` galinha grátis (espécie `Comum` com baixa produtividade);
  - `5` unidades de ração grátis;
  - `0.00 USDT` de saldo monetário.

### 2.3 Espécies no MVP (vida útil reduzida em 50%)
| Espécie | Preço compra (USDT) | Ovos/dia | Consumo ração/dia | Vida útil (dias) |
|---|---:|---:|---:|---:|
| Comum | 1.20 | 1.0 | 0.8 | 183 |
| Caipira Melhorada | 3.00 | 2.3 | 1.4 | 210 |
| Poedeira Premium | 7.00 | 5.5 | 3.5 | 270 |

### 2.4 Preços base da economia
- Preço de compra da ração no sistema: `0.12 USDT` por unidade.
- Preço de venda de ovo para o sistema: **fixo**, definido pelo admin (sem limite de periodicidade).
- Taxa de saque: `3%` (configurável no painel admin).
- Taxa do marketplace P2P: **escalonada por volume** (configurável no painel admin).

### 2.5 Evolução de ovos
- Probabilidades: **fixas**.
- Ovo fértil evolui para pintinho após `72h`.
- Pintinho evolui para adulto após `12 dias`.
- Sorteio de espécie adulta no nascimento:
  - Comum: `70%`
  - Caipira Melhorada: `25%`
  - Poedeira Premium: `5%`
- Cada etapa de evolução exige consumo acumulado de ração:
  - Ovo → pintinho: `0.7` ração
  - Pintinho → adulto: `2.0` ração

### 2.6 Regra de alimentação, produção e morte
- Se ficar sem ração, a galinha **para de gerar ovos imediatamente**.
- Se continuar sem ração por `72h`, a galinha morre.
- Ao voltar a ter ração disponível para consumo (antes das 72h), volta a gerar ovos normalmente, sem modo de recuperação parcial.
- Tempo sem ração deve ser rastreado por galinha (`starvation_started_at`).

## 3) Fórmulas da Simulação

### 3.1 Produção bruta diária
`ovos_brutos_dia = soma(quantidade_galinhas_especie * ovos_dia_especie)`

### 3.2 Custo de ração diário
`custo_racao_dia = soma(quantidade_galinhas_especie * consumo_dia_especie) * preco_racao`

### 3.3 Receita diária (venda direta ao sistema)
`receita_ovos_dia = ovos_vendidos_dia * preco_ovo_sistema`

### 3.4 Margem operacional diária
`margem_dia = receita_ovos_dia - custo_racao_dia`

## 4) Simulação Base (Cenário Equilibrado)

### 4.1 Perfil médio por usuário ativo
- 3 galinhas Comum
- 2 galinhas Caipira Melhorada
- 1 galinha Poedeira Premium

### 4.2 Resultado diário do usuário (média)
- Produção de ovos:
  - `3*1.0 + 2*2.3 + 1*5.5 = 13.1 ovos/dia`
- Consumo de ração:
  - `3*0.8 + 2*1.4 + 1*3.5 = 8.7 ração/dia`
- Custo com ração:
  - `8.7 * 0.12 = 1.044 USDT/dia`
- Receita com venda direta de ovos ao sistema (exemplo com `0.10 USDT`):
  - `13.1 * 0.10 = 1.31 USDT/dia`
- Margem operacional:
  - `1.31 - 1.044 = +0.266 USDT/dia`

### 4.3 Interpretação
- O usuário tem lucro moderado e precisa manter compra de ração para produzir.
- A vida útil menor acelera renovação de ativos e reduz risco de ativos "eternos".

## 5) Painel Cliente — Camada Visual (Retenção)

### 5.1 Mapa da fazenda
- Estilo visual: **pixel-art 2D**.
- Exibição das galinhas em pequeno mundo aberto/simulação de pasto.
- Alternância entre `Modo Dashboard` e `Modo Fazenda 2D`.

### 5.2 Interações mínimas no mapa
- Botão `Coletar todos os ovos`.
- Botão `Dar ração manual`.
- Botão `Ativar ração automática` (se houver saldo/estoque).
- Aviso no painel quando a ração acabar: **"Ração esgotada: sem alimentação as galinhas podem morrer."**

## 6) Painel Admin — Regras Operacionais

1. **Controle de novos usuários**
   - Chave global para bloquear/liberar novos cadastros (`allow_new_registrations`).
2. **Parâmetros econômicos**
   - Preço fixo do ovo no sistema (admin altera quando quiser).
   - Preço da ração.
   - Taxa de saque.
   - Faixas da taxa escalonada do marketplace.
3. **Saque manual**
   - Toda solicitação de saque vai para fila do admin.
   - Prazo operacional padrão: até `72h`.
   - Limite: `1 solicitação de saque por dia` por usuário.
   - Valor mínimo de saque: `0` (sem mínimo, configurável).
4. **Ação rápida de pagamento**
   - Cada solicitação terá botão `Fazer pagamento` para abrir MetaMask com endereço BEP20 e valor pré-preenchidos.
   - Registro obrigatório de log/auditoria da ação (quem pagou, quando, tx hash).
5. **Confirmação BEP20 (padrão)**
   - Crédito de depósito após `12 confirmações` na rede BEP20.

6. **Indisponibilidade sistêmica (proteção e compensação)**
   - Em incidentes de plataforma, nenhum ativo do usuário pode ser prejudicado (sem perda de galinhas, ovos, saldo ou progresso).
   - Compensação padrão por incidente elegível: `10` rações grátis por usuário impactado.

## 6.1 Tabela de Alertas no Painel Admin (ordem de necessidade)

### P1 — Crítico (ação imediata)
1. **Ração esgotada com risco de morte**
   - Disparo: galinhas sem ração há mais de `48h`.
   - Ação sugerida: notificar usuário + destaque vermelho no admin.
2. **Morte por inanição confirmada**
   - Disparo: galinha atingiu `72h` sem ração.
   - Ação sugerida: registrar evento crítico + aviso ao usuário.
3. **Fila de saque estourando SLA**
   - Disparo: solicitação de saque pendente por mais de `72h`.
   - Ação sugerida: destacar pendências e bloquear novas aprovações manuais até regularização.

### P2 — Alto (ação no mesmo dia)
4. **Inflação semanal elevada no P2P**
   - Disparo: índice de inflação 7d acima de `10%`.
   - Ação sugerida: revisar taxa escalonada e preço de ração.
5. **Queda abrupta de alimentação automática**
   - Disparo: queda > `20%` no uso de ração automática em 24h.
   - Ação sugerida: checar bugs de UI/fluxo e saldo médio dos usuários.
6. **Aumento de falha de depósito BEP20**
   - Disparo: taxa de conciliação com erro > `2%` no dia.
   - Ação sugerida: revisar nós/RPC e regras de validação de transação.

### P3 — Médio (monitoramento e ajuste)
7. **Queda de retenção D7**
   - Disparo: D7 abaixo de `20%`.
   - Ação sugerida: calibrar progressão, bônus e UX de onboarding.
8. **Concentração de volume P2P em poucas contas**
   - Disparo: top 5 contas acima de `40%` do volume semanal.
   - Ação sugerida: revisar limites e sinais de manipulação.
9. **Baixa adoção do mapa 2D**
   - Disparo: uso diário < `35%` dos usuários ativos.
   - Ação sugerida: simplificar controles e melhorar chamadas na dashboard.

## 7) Taxa Escalonada P2P (proposta inicial integrada)

Taxa aplicada sobre o vendedor, por volume negociado no mês corrente:

- Até `100 USDT/mês`: `8%`
- Acima de `100` até `500 USDT/mês`: `6%`
- Acima de `500` até `1.500 USDT/mês`: `4.5%`
- Acima de `1.500 USDT/mês`: `3.5%`

Diretriz econômica:
- Camadas baixas drenam mais para conter inflação em contas iniciais.
- Camadas altas incentivam liquidez sem zerar sink econômico.
- Admin pode ajustar faixas/taxas sem deploy.

## 8) Autenticação e Termos

- Login do usuário: **MetaMask**.
- Sem KYC no MVP.
- Obrigatório exibir e aceitar termo explícito: **plataforma de simulação com economia virtual**.

## 9) Termos Legais Base (Rascunho para MVP)

1. **Natureza do produto**
   - Plataforma de simulação digital com ativos e regras virtuais, sem promessa de investimento ou rendimento garantido.
2. **Risco operacional**
   - Serviços podem sofrer manutenção, indisponibilidade temporária e ajustes de parâmetros econômicos pelo admin.
3. **Carteira e autenticação**
   - O usuário é responsável pela segurança da própria carteira MetaMask, chaves e dispositivos.
4. **Depósitos e saques**
   - Transações são processadas em BEP20 conforme regras de confirmação e fila operacional de saque manual.
5. **Economia e ajustes**
   - Preços, taxas, probabilidades e limites podem ser alterados para manter sustentabilidade da economia.
6. **Condutas proibidas**
   - Multi-conta abusiva, manipulação de mercado, automação maliciosa e fraude operacional.
7. **Sanções**
   - Suspensão de conta, bloqueio de operações e estorno administrativo em casos de abuso comprovado.
8. **Limitação de responsabilidade**
   - A plataforma não se responsabiliza por perdas decorrentes de erro do usuário, terceiros, falhas externas de rede ou carteira.

## 10) KPIs para Monitoramento de Economia

- Razão de consumo de ração por ovo produzido.
- Total diário de USDT emitida (venda de ovos) vs USDT drenada (ração + taxas).
- Índice de inflação de preços no marketplace (7 e 30 dias).
- Tempo médio até primeiro saque.
- % de usuários que reinvestem em até 72h.
- % de usuários que usam o modo fazenda 2D ao menos 1x por dia.

## 11) Decisões fechadas

1. Rede de depósito/saque: `BEP20`.
2. Saque manual com SLA de até `72h`.
3. 1 solicitação de saque/dia/usuário.
4. Sem valor mínimo de saque no início (configurável).
5. Preço do ovo no sistema fixo (admin define quando quiser alterar).
6. Marketplace P2P com anúncio de venda direta e preço livre.
7. Taxa P2P escalonada por volume (proposta já definida nesta versão).
8. Evolução com probabilidades fixas.
9. Mapa visual em pixel-art com ações de coletar ovos e alimentar.
10. Login MetaMask, sem KYC, com termo explícito de simulação.
11. Vida útil das galinhas reduzida em 50%.
12. Admin pode bloquear novos usuários.
13. Confirmação BEP20 padrão: 12 confirmações.
14. Sem recuperação parcial de galinha; voltando a ter ração, a produção normaliza.
15. Em indisponibilidade sistêmica: proteção total dos ativos + compensação de 10 rações grátis.

## 12) O que ainda precisamos decidir

No momento, **não há decisões críticas pendentes** para iniciar a implementação do MVP.

## 13) Próximos Passos de Implementação

1. Criar tabela de parâmetros econômicos versionados (`economy_configs`).
2. Criar configurações de saque/admin (`withdraw_configs`) e controle de cadastro.
3. Implementar login MetaMask no fluxo de autenticação.
4. Implementar fila de saque manual com ação rápida `Fazer pagamento` + logs.
5. Modelar `farm_map_state` para posicionamento visual de galinhas no cliente.
6. Implementar regras da taxa escalonada P2P por volume mensal.
7. Rodar teste fechado com coorte limitada antes de liberar saques amplamente.
