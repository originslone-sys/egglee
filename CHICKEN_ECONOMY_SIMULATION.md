# Simulação Econômica — Plataforma de Fazenda de Galinhas

## 1) Objetivo

Validar se a economia proposta (ração como principal sink, marketplace P2P e evolução ovo → pintinho → galinha adulta) pode se manter sustentável no MVP, com parâmetros simples de administrar em hospedagem cPanel/Hostinger.

## 2) Premissas do Modelo (MVP)

### 2.1 Moeda e unidades
- Moeda interna: `COIN`.
- Janela de cálculo: diária, com consolidação mensal para análise.
- Ovos são ativos do usuário e podem ser:
  - vendidos para o sistema (preço piso), ou
  - listados no marketplace (preço livre).

### 2.2 Ativos iniciais e onboarding
- Usuário novo recebe:
  - `1` galinha grátis (espécie `Comum` com baixa produtividade);
  - `5` unidades de ração grátis;
  - `0` COIN de saldo monetário.

### 2.3 Espécies no MVP
| Espécie | Preço compra (COIN) | Ovos/dia | Consumo ração/dia | Vida útil (dias) |
|---|---:|---:|---:|---:|
| Comum | 120 | 1.0 | 0.8 | 365 |
| Caipira Melhorada | 300 | 2.3 | 1.4 | 420 |
| Poedeira Premium | 700 | 5.5 | 3.5 | 540 |

### 2.4 Preços base da economia
- Preço de compra da ração no sistema: `12 COIN` por unidade.
- Preço piso de venda de ovo para o sistema: `10 COIN` por ovo.
- Taxa do marketplace (sobre o vendedor): `6%`.
- Taxa de saque (quando habilitado): `3%`.

### 2.5 Evolução de ovos
- Ovo fértil evolui para pintinho após `72h` (com taxa de sucesso configurável).
- Pintinho evolui para adulto após `12 dias`.
- Sorteio de espécie adulta no nascimento:
  - Comum: `70%`
  - Caipira Melhorada: `25%`
  - Poedeira Premium: `5%`
- Cada etapa de evolução exige consumo acumulado de ração:
  - Ovo → pintinho: `0.7` ração
  - Pintinho → adulto: `2.0` ração

## 3) Fórmulas da Simulação

### 3.1 Produção bruta diária
`ovos_brutos_dia = soma(quantidade_galinhas_especie * ovos_dia_especie)`

### 3.2 Custo de ração diário
`custo_racao_dia = soma(quantidade_galinhas_especie * consumo_dia_especie) * preco_racao`

### 3.3 Receita diária (venda direta ao sistema)
`receita_ovos_dia = ovos_vendidos_dia * preco_ovo_sistema`

### 3.4 Margem operacional diária
`margem_dia = receita_ovos_dia - custo_racao_dia`

### 3.5 Receita da plataforma por usuário ativo/dia
`receita_plataforma_dia = (racao_comprada_dia * preco_racao) + taxas_marketplace + taxas_saque`

> Nota: no MVP, a sustentabilidade depende principalmente do volume de ração comprada e da taxa de marketplace.

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
  - `8.7 * 12 = 104.4 COIN/dia`
- Receita com venda direta de ovos ao sistema:
  - `13.1 * 10 = 131.0 COIN/dia`
- Margem operacional:
  - `131.0 - 104.4 = +26.6 COIN/dia`

### 4.3 Interpretação
- O usuário tem lucro moderado, mantendo incentivo de jogar.
- Como a margem não é extrema, ele precisa gerenciar reinvestimento e ração.
- A economia não fica excessivamente inflacionária se houver taxa de marketplace e custos de evolução.

## 5) Cenários de Sustentabilidade

### 5.1 Cenário A (saudável)
- Preço ração = 12
- Preço ovo sistema = 10
- Taxa marketplace = 6%
- Resultado: crescimento controlado, boa retenção, inflação baixa/moderada.

### 5.2 Cenário B (inflacionário)
- Preço ração = 10
- Preço ovo sistema = 11
- Taxa marketplace = 2%
- Resultado: moeda entra rápido demais no sistema; risco de pressão em saques e perda de controle de preços P2P.

### 5.3 Cenário C (punitivo)
- Preço ração = 14
- Preço ovo sistema = 9
- Taxa marketplace = 8%
- Resultado: engajamento cai; jogador casual sente baixa progressão e abandona cedo.

## 6) Regras de Controle Recomendadas (Admin)

1. **Limites de ajuste por janela**
   - Alterar preço de ração e ovo no máximo `±5%` por semana.
2. **Piso e teto de listagem no marketplace**
   - Evita manipulação e lavagem de saldo entre contas.
3. **Cooldown de saque**
   - Exemplo: saque permitido após `7 dias` de atividade e volume mínimo de produção real.
4. **Taxa dinâmica opcional no marketplace**
   - Se inflação subir, taxa pode ir de `6%` para `7%` temporariamente.
5. **Mortalidade/encerramento de ciclo obrigatório**
   - Galinhas expiram na vida útil para forçar renovação de ativos e novo consumo.

## 7) KPIs para Monitoramento de Economia

- Razão de consumo de ração por ovo produzido.
- Total diário de COIN emitida (venda de ovos) vs COIN drenada (ração + taxas).
- Índice de inflação de preços no marketplace (7 e 30 dias).
- Tempo médio até primeiro saque.
- % de usuários que reinvestem em até 72h.

## 8) Recomendação de Go-Live (MVP)

Começar com o **Cenário A** por 30 dias e observar:
- Se emissão líquida diária de COIN > 15%, subir ração em 3% e/ou taxa marketplace em 1 ponto percentual.
- Se retenção D7 < 20%, reduzir custo efetivo de evolução (ração ovo→adulto) em até 10%.

## 9) Próximos Passos de Implementação

1. Criar tabela de parâmetros econômicos versionados (`economy_configs`).
2. Implementar simulador diário em job agendado (cron cPanel).
3. Registrar ledger imutável para emissão/drenagem de COIN.
4. Construir dashboard admin com alertas de inflação e liquidez.
5. Rodar teste fechado com coorte limitada antes de liberar saques amplamente.
