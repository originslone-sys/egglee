# Simulação Econômica — Plataforma de Fazenda de Galinhas

## 1) Objetivo

Validar se a economia proposta (ração como principal sink, marketplace P2P e evolução ovo → pintinho → galinha adulta) pode se manter sustentável no MVP, com parâmetros simples de administrar em hospedagem cPanel/Hostinger.

## 2) Premissas do Modelo (MVP)

### 2.1 Moeda e unidades
- Moeda oficial: `USDT`.
- Precisão monetária: `2 casas decimais`.
- Janela de cálculo: diária, com consolidação mensal para análise.
- Ovos são ativos do usuário e podem ser:
  - vendidos para o sistema (preço piso), ou
  - listados no marketplace (preço livre).

### 2.2 Ativos iniciais e onboarding
- Usuário novo recebe:
  - `1` galinha grátis (espécie `Comum` com baixa produtividade);
  - `5` unidades de ração grátis;
  - `0.00 USDT` de saldo monetário.

### 2.3 Espécies no MVP
| Espécie | Preço compra (USDT) | Ovos/dia | Consumo ração/dia | Vida útil (dias) |
|---|---:|---:|---:|---:|
| Comum | 1.20 | 1.0 | 0.8 | 365 |
| Caipira Melhorada | 3.00 | 2.3 | 1.4 | 420 |
| Poedeira Premium | 7.00 | 5.5 | 3.5 | 540 |

### 2.4 Preços base da economia
- Preço de compra da ração no sistema: `0.12 USDT` por unidade.
- Preço piso de venda de ovo para o sistema: `0.10 USDT` por ovo.
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
  - `8.7 * 0.12 = 1.044 USDT/dia`
- Receita com venda direta de ovos ao sistema:
  - `13.1 * 0.10 = 1.31 USDT/dia`
- Margem operacional:
  - `1.31 - 1.044 = +0.266 USDT/dia`

### 4.3 Interpretação
- O usuário tem lucro moderado, mantendo incentivo de jogar.
- Como a margem não é extrema, ele precisa gerenciar reinvestimento e ração.
- A economia não fica excessivamente inflacionária se houver taxa de marketplace e custos de evolução.

## 5) Cenários de Sustentabilidade

### 5.1 Cenário A (saudável)
- Preço ração = `0.12 USDT`
- Preço ovo sistema = `0.10 USDT`
- Taxa marketplace = `6%`
- Resultado: crescimento controlado, boa retenção, inflação baixa/moderada.

### 5.2 Cenário B (inflacionário)
- Preço ração = `0.10 USDT`
- Preço ovo sistema = `0.11 USDT`
- Taxa marketplace = `2%`
- Resultado: moeda entra rápido demais no sistema; risco de pressão em saques e perda de controle de preços P2P.

### 5.3 Cenário C (punitivo)
- Preço ração = `0.14 USDT`
- Preço ovo sistema = `0.09 USDT`
- Taxa marketplace = `8%`
- Resultado: engajamento cai; jogador casual sente baixa progressão e abandona cedo.

## 6) Camada Visual no Painel do Cliente (Retenção)

### 6.1 Proposta
Adicionar uma visão em **mapa 2D simples de fazenda** no painel do cliente para mostrar as galinhas pastando e o estado dos ativos em tempo real (ou quase real).

### 6.2 Objetivos de produto
- Aumentar retenção com feedback visual da progressão.
- Tornar o sistema mais compreensível para usuário iniciante.
- Criar base para eventos futuros (clima, itens cosméticos, expansão de terreno).

### 6.3 Escopo mínimo (MVP visual)
- Mapa 2D com tiles simples (grama, cercas, celeiro).
- Sprites básicos de galinhas por raridade/espécie (não precisa animação complexa).
- Indicadores visuais por galinha:
  - com ração / sem ração;
  - saudável / fim de ciclo de vida próximo.
- Botão de alternância: `Modo Dashboard` ↔ `Modo Fazenda 2D`.

### 6.4 Requisitos técnicos iniciais
- Renderização leve para ambiente compartilhado (sem engine pesada).
- Atualização de estado por polling intervalado (ex.: 15–30 segundos).
- Fallback total para tabela/lista caso dispositivo seja fraco.

## 7) Regras de Controle Recomendadas (Admin)

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

## 8) KPIs para Monitoramento de Economia

- Razão de consumo de ração por ovo produzido.
- Total diário de USDT emitida (venda de ovos) vs USDT drenada (ração + taxas).
- Índice de inflação de preços no marketplace (7 e 30 dias).
- Tempo médio até primeiro saque.
- % de usuários que reinvestem em até 72h.
- % de usuários que usam o modo fazenda 2D ao menos 1x por dia.

## 9) O que ainda precisamos decidir (antes do código)

1. **Fluxo financeiro USDT**
   - Rede de depósito/saque: TRC20, BEP20 ou múltiplas redes?
   - Confirmação mínima de blockchain e política de taxas de rede.
2. **Modelo de saque**
   - Saque manual no início ou automático?
   - Valor mínimo e limite diário por usuário.
3. **Política de preços dinâmicos**
   - Preço do ovo no sistema será fixo ou banda dinâmica por oferta/demanda?
4. **Marketplace P2P**
   - Ordem de compra/venda (book) ou venda direta por anúncio?
   - Taxa única ou escalonada por volume.
5. **Evolução aleatória**
   - Probabilidades fixas ou ajustáveis por evento/temporada.
6. **Mapa 2D**
   - Estilo visual (pixel-art, flat minimalista, cartoon simples).
   - Interações mínimas: apenas visual ou clique para coletar/gerenciar.
7. **Compliance e termos**
   - Regras KYC/AML para saque conforme jurisdição-alvo.
   - Termo explícito de que é simulação com economia virtual.

## 10) Recomendação de Go-Live (MVP)

Começar com o **Cenário A** por 30 dias e observar:
- Se emissão líquida diária de USDT > 15%, subir ração em 3% e/ou taxa marketplace em 1 ponto percentual.
- Se retenção D7 < 20%, reduzir custo efetivo de evolução (ração ovo→adulto) em até 10%.
- Se uso do mapa 2D < 35% dos ativos semanais, simplificar UI e melhorar onboarding visual.

## 11) Próximos Passos de Implementação

1. Criar tabela de parâmetros econômicos versionados (`economy_configs`).
2. Implementar simulador diário em job agendado (cron cPanel).
3. Registrar ledger imutável para emissão/drenagem de USDT.
4. Construir dashboard admin com alertas de inflação, liquidez e adoção do mapa 2D.
5. Modelar `farm_map_state` para posicionamento visual de galinhas no cliente.
6. Rodar teste fechado com coorte limitada antes de liberar saques amplamente.
