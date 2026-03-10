# Blueprint de Produto — Plataforma Modular de Fazenda de Mineração (Virtual)

## 1) Visão do Produto

Criar uma plataforma digital de alta qualidade (AAA+) onde o usuário constrói e expande, em ambiente virtual, uma fazenda de mineração de Bitcoin por meio da compra e evolução de artefatos visuais e funcionais. O objetivo é combinar experiência imersiva, simulação econômica consistente e progressão de longo prazo, com painéis dedicados para cliente e administração.

## 2) Objetivos de Negócio

- Construir um produto escalável com alta retenção (gamificação + progressão contínua).
- Operar uma economia virtual equilibrada e auditável.
- Disponibilizar recursos administrativos robustos para governança, antifraude e crescimento de receita.
- Permitir evolução em fases (MVP → expansão) sem refatorações estruturais profundas.

## 3) Princípios Norteadores (AAA+)

1. **Consistência de simulação:** regras claras e previsíveis.
2. **Transparência para o usuário:** métricas compreensíveis e feedback em tempo real.
3. **Experiência premium:** UX fluida, visual limpo, navegação rápida.
4. **Escalabilidade modular:** domínios desacoplados e versionáveis.
5. **Segurança por padrão:** auditoria, RBAC, prevenção de exploração econômica.
6. **Operabilidade:** observabilidade e controles administrativos completos.

## 4) Personas Principais

### 4.1 Cliente Iniciante
- Quer aprender e crescer aos poucos.
- Precisa de onboarding guiado e recomendações de upgrade.

### 4.2 Cliente Estratégico
- Busca otimizar ROI virtual, eficiência energética e escala.
- Valoriza dashboards avançados, comparativos e automações.

### 4.3 Operador/Admin
- Mantém economia saudável e detecta abusos.
- Configura catálogo, eventos, limites, campanhas e regras.

## 5) Escopo Funcional por Módulo

## 5.1 Autenticação, Conta e Perfil
- Cadastro/login.
- Recuperação de conta.
- Perfil, preferências e trilha de progresso.
- Gestão de sessão e segurança.

## 5.2 Onboarding e Tutorial
- Jornada inicial guiada (primeira fazenda).
- Missões de aprendizado.
- Explicação de métricas-chave (hashrate, consumo, eficiência, lucro simulado).

## 5.3 Inventário e Artefatos
- Catálogo de itens (máquinas, infraestrutura, energia, cooling, upgrades).
- Slots, pré-requisitos e compatibilidades.
- Raridade, tiers e evolução de itens.

## 5.4 Motor de Simulação
- Cálculo de hashrate total por fazenda.
- Consumo e custo energético por período.
- Uptime, degradação e manutenção.
- Modelo de dificuldade/recompensa virtual.
- Projeção e apuração de resultado por janela temporal.

## 5.5 Economia Virtual
- Moeda interna, preços e reajustes.
- Regras anti-inflação e balanceamento.
- Fontes e sumidouros de moeda (faucets/sinks).
- Limites operacionais por nível e progressão.

## 5.6 Loja e Marketplace
- Compra de artefatos (catálogo primário).
- Ofertas rotativas/eventos sazonais.
- (Fase futura) marketplace entre usuários com taxas e limites.

## 5.7 Missões, Conquistas e Progressão
- Missões diárias/semanais.
- Trilhas de milestones.
- Recompensas controladas para retenção sem quebrar economia.

## 5.8 Painel Cliente
- Visão visual da fazenda.
- Indicadores operacionais em tempo real.
- Alertas de risco (sobrecarga, queda de eficiência, manutenção pendente).
- Sugestões de otimização e próximos upgrades.

## 5.9 Painel Admin
- Gestão de usuários e permissões.
- Gestão de catálogo (itens, preços, parâmetros).
- Configuração de eventos e campanhas.
- Antiabuso/fraude e trilhas de auditoria.
- Relatórios de economia, retenção e monetização.

## 5.10 Notificações e Suporte
- Notificações in-app e por e-mail.
- Centro de mensagens.
- Fluxo de suporte com histórico e classificação de prioridade.

## 6) Regras de Simulação (Modelo Conceitual)

Cada artefato deve conter no mínimo:
- custo de aquisição;
- hashrate base;
- consumo de energia;
- eficiência (J/TH ou equivalente no jogo);
- taxa de falha/degradação;
- custo de manutenção;
- requisitos de instalação (nível/infraestrutura).

Resultado operacional por período (simplificado):
1. Calcular hashrate efetivo (base × bônus × penalidades).
2. Estimar produção virtual proporcional ao hashrate e dificuldade.
3. Calcular custo energético (consumo × tarifa).
4. Subtrair manutenção e perdas por indisponibilidade.
5. Consolidar lucro/prejuízo virtual.

## 7) Arquitetura de Alto Nível (Sem Implementação)

- **Frontend Cliente:** experiência de construção/gestão da fazenda.
- **Frontend Admin:** governança e operação da plataforma.
- **Backend Modular por Domínio:** auth, inventário, simulação, economia, loja, missões, notificações.
- **Banco transacional:** estado de conta, inventário, ordens, configurações.
- **Camada assíncrona/eventos:** processamento de simulação e jobs periódicos.
- **Camada analítica:** métricas de produto, economia e risco.
- **Observabilidade:** logs estruturados, métricas técnicas e de negócio.

## 8) Segurança, Compliance e Governança

- RBAC detalhado (admin, operações, suporte, financeiro).
- Trilhas de auditoria para ações críticas.
- Monitoramento de padrões anômalos (exploit econômico, automações indevidas).
- Política clara sobre natureza do produto (simulação virtual).
- Termos de uso, privacidade e política de dados desde o início.

## 9) KPIs do Produto

### 9.1 Produto/Engajamento
- DAU/MAU.
- Retenção D1/D7/D30.
- Tempo médio de sessão.
- Taxa de conclusão de onboarding.

### 9.2 Economia
- Geração e consumo de moeda virtual.
- Índice de inflação virtual.
- Distribuição de riqueza entre segmentos.

### 9.3 Monetização
- Conversão para compra.
- ARPPU.
- LTV por coorte.

### 9.4 Operação
- Latência de endpoints críticos.
- Taxa de erro.
- Tempo de resolução de tickets.

## 10) Roadmap Recomendado

## 10.1 Fase 0 — Discovery e Definição (2–4 semanas)
- Definição da economia e parâmetros iniciais.
- Mapeamento completo de entidades e estados.
- Wireframes de cliente/admin.
- Definição de telemetria e KPIs.

## 10.2 Fase 1 — MVP (8–12 semanas)
- Cadastro/login.
- Inventário básico.
- Simulação base.
- Loja primária.
- Dashboard cliente mínimo.
- Admin mínimo para catálogo e usuários.

## 10.3 Fase 2 — Escala e Retenção (6–10 semanas)
- Missões avançadas.
- Eventos sazonais.
- Alertas inteligentes.
- Painel admin com antifraude e relatórios ampliados.

## 10.4 Fase 3 — Diferenciação (contínuo)
- Marketplace P2P (se fizer sentido de negócio).
- Social/clãs/competição.
- App companion.
- Personalização visual avançada.

## 11) Backlog Inicial Priorizado (MoSCoW)

### Must Have
- Conta e autenticação.
- Catálogo de artefatos.
- Motor de simulação base.
- Compra de itens e atualização de inventário.
- Dashboard cliente com KPIs básicos.
- Admin para usuários e catálogo.

### Should Have
- Missões e recompensas.
- Notificações de eventos operacionais.
- Balanceamento dinâmico de parâmetros.
- Auditoria administrativa completa.

### Could Have
- Marketplace entre usuários.
- Rankings e competição.
- Personalização cosmética avançada.

### Won’t Have (inicialmente)
- Funcionalidades que dependam de integração complexa sem validação de mercado.

## 12) Riscos e Mitigações

1. **Economia quebrar cedo** → ambiente de simulação interna + feature flags + ajustes graduais.
2. **Complexidade excessiva no MVP** → escopo fechado e critérios objetivos de pronto.
3. **Exploração de regras** → limites operacionais + detecção de anomalias + auditoria.
4. **Baixa retenção** → onboarding forte + metas de curto prazo + eventos.

## 13) Próximo Passo Imediato

Transformar este blueprint em 4 entregáveis de execução:
1. **PRD v1** (escopo funcional detalhado e critérios de aceitação).
2. **Mapa de dados** (entidades, relações e estados).
3. **Especificação do motor de simulação v1** (fórmulas e parâmetros).
4. **Plano de MVP em sprints** (backlog por sprint, riscos e dependências).
