# CLAUDE.md

Este arquivo fornece orientações completas para o Claude Code ao trabalhar no repositório da Northie. Contém produto, filosofia, arquitetura, design e convenções de código. SEMPRE mantenha esse arquivo atualizado com novos contextos sobre o produtos, novas features e possíveis pivots que o projeto vai sofrer, é indispensável a atualização dele. Atualize sempre também os arquivos "northie-backend-architecture" - "northie-produto" quando julgar necessário e tiver mudanças que devem ser registradas neles, seja de pivot ou arquitetura.

## Agentes disponíveis

Os agentes estão em `.claude/agents/`. Use-os automaticamente conforme o contexto da tarefa:

| Agente | Acionar quando |
|--------|---------------|
| `backend-architect` | Desenhar APIs, serviços, fluxos de integração, estrutura do `server/` |
| `frontend-architect` | Estrutura de componentes, páginas, design system, UX |
| `system-architect` | Decisões de arquitetura macro que afetam múltiplas camadas |
| `tech-stack-researcher` | Escolher tecnologia antes de implementar — comparar opções, recomendar abordagem |
| `deep-research-agent` | Pesquisa aprofundada, exploração de código desconhecido, investigação de bugs complexos |
| `requirements-analyst` | Transformar uma ideia vaga em spec concreta antes de codar |
| `security-engineer` | Auditoria de segurança, revisar fluxos OAuth, encriptação, RLS policies |
| `performance-engineer` | Otimização de queries, bottlenecks de API, performance de renderização |
| `refactoring-expert` | Melhorar qualidade de código existente, reduzir débito técnico |
| `technical-writer` | Gerar documentação, atualizar READMEs, escrever specs |
| `learning-guide` | Explicar conceitos, onboarding de novo contexto, ensinar padrões do projeto |

### Estratégia de uso de subagentes

**Sempre usar subagentes (Task tool) quando:**
- A tarefa envolve reescrever ou modificar 2+ arquivos de página/componente simultaneamente
- A pesquisa/exploração pode ser delegada sem travar a conversa principal
- Trabalho é claramente independente entre arquivos (ex: 3 páginas diferentes)

**Usar subagentes em paralelo:** Lançar múltiplos agents no mesmo turno (único bloco de tool calls) sempre que as tarefas não dependem umas das outras. Isso reduz o tempo total e economiza a janela de contexto principal.

**Exemplo de uso correto:**
```
// BAD: Claude faz tudo na conversa principal
Lê Card.tsx → reescreve → lê Growth.tsx → reescreve

// GOOD: Claude delega em paralelo
Task(Card) + Task(Growth) → todos rodam simultaneamente
```

---

## O que é a Northie

A Northie é a infraestrutura financeira para founders de negócios digitais que constroem para escalar.

**Tese central:** democratizamos a alavancagem de receita para founders digitais brasileiros. O financeiro é a consequência — não o produto.

**Filosofia de produto:** dado sem humanidade é métrica enviesada. A Northie não entrega números — entrega o que aqueles números significam para aquele negócio específico, naquele momento específico, com o histórico que só aquele founder construiu. Isso é humanizar dados através de contexto.

**O que não somos:** não somos um dashboard de analytics, não somos uma fintech de crédito tradicional, não somos uma plataforma de growth marketing genérica.

**Para quem é:** founders de SaaS, e-commerce com mentalidade de escala, startups e marcas DTC que pensam no negócio como um ativo a ser construído — não como uma operação a ser gerida.

---

## Produtos

### Base — Integrações e Banco de Dados Unificado
Fundação de tudo. Conecta Meta Ads, Google Ads, Hotmart, Stripe e Shopify via API. Os dados são normalizados via **Northie Schema** em objetos padronizados: transações, clientes, campanhas, métricas de ads. O banco de dados cresce com o uso e é o ativo central da plataforma.

### Produto 1 — Northie Growth
**Produto central.** Execução automática de ações de growth baseadas em cruzamento de dados de múltiplas fontes. O diferencial é o contexto — não a automação. Cada ação exige cruzamento de pelo menos duas fontes distintas para fazer sentido.

Princípio de execução: a IA identifica correlações, formula recomendação com contexto completo, apresenta para o founder confirmar. O founder aprova — a Northie executa. Nunca o contrário.

Ações: reativação de clientes de alto LTV, pausa de campanha baseada em LTV histórico (não só ROAS), Audience Sync inteligente por qualidade financeira, realocação de budget por LTV por canal, upsell automático baseado em comportamento de cohort.

### Produto 2 — Northie Card
Cartão corporativo com limite baseado no faturamento real do negócio. Capital sem garantia física, sem equity, sem burocracia. O limite é calculado pelos dados reais da Northie — histórico de faturamento, LTV médio, churn, saúde do caixa.

Split na fonte: pagamento capturado automaticamente como percentual fixo da receita diretamente nas integrações (Stripe, Hotmart) antes de chegar na conta do founder. Elimina risco de inadimplência.

Capital Score: visível desde o primeiro dia, atualizado mensalmente. Founder que não está elegível entra na lista de espera com um clique.

Opera via parceiro financeiro regulado (QI Tech ou Celcoin). A Northie faz o underwriting e fica com o spread + MDR das transações.

### Feature Transversal — Relatórios Automáticos
Presente em todos os produtos. Founder configura relatórios automáticos (semanal, mensal, trimestral) em PDF visual, CSV ou apresentação. Gerados e enviados automaticamente sem ação manual.

### Canais de Execução Nativos
O Growth Engine executa ações via dois canais nativos — nunca sem aprovação explícita do founder:
- **WhatsApp** (Meta Business API) — reativação, upsell, alertas. Canal prioritário no Brasil.
- **Email** (Resend) — sequências de nurturing e reativação com rastreamento nativo.

### Pipeline Nativo (founders com ciclo consultivo)
Para negócios com venda por reunião (SaaS high ticket, B2B): pipeline leve nativo integrado ao Northie Pixel. Sem integração com CRM externo — a Northie captura o lead no próprio formulário e conecta ao histórico financeiro. Estágios: Lead → Reunião agendada → Reunião realizada → Fechado/Perdido.

### Enriquecimento Contextual da Transação
Toda transação capturada (Stripe, Hotmart, Shopify) pode ser enriquecida com o contexto que aconteceu antes dela:
- **Google Calendar** — sabe se houve reuniões antes do fechamento e quando
- **Google Meet + transcrição IA** — analisa objeções, perfil do lead, ciclo de decisão. O resultado é uma transação com história qualitativa — a IA sabe que aquele cliente fechou após objeção de preço em 12 dias, e pode correlacionar isso com retenção futura.

### Contexto do Negócio — IA treinada pelo founder
O founder alimenta a IA com contexto que os dados nunca capturam sozinhos:
- Perfil do negócio, ICP, ciclo de vendas, sazonalidades
- Instruções personalizadas e prioridades do momento
- Arquivos (pitch deck, tabela de preços, pesquisas de cliente)
Esse contexto calibra todas as análises e recomendações. Acumula com o tempo e é exclusivo daquele founder — não existe em nenhuma outra plataforma.

### Complemento — Dashboards
Visão Geral, Clientes, Canais e Vendas. Existem para manter o founder engajado e os dados fluindo. Não são o motivo pelo qual o founder assina a Northie.

---

## Comandos Úteis

```bash
npm run dev       # Inicia servidor de dev em http://localhost:5173
npm run build     # Type-check + build de produção
npm run preview   # Preview do build de produção
git push          # Dispara build automático na Vercel (branch main)
```

---

## Stack Tecnológica

- **Core**: React 18 + TypeScript via Vite 6
- **Backend**: Express 5 + Node.js (pasta `server/`)
- **Banco de dados**: Supabase / PostgreSQL com pgvector
- **IA**: Claude Sonnet 4 (queries padrão e contextuais) / Claude Opus 4 (análises profundas, forecasting)
- **Auth**: Supabase Auth
- **HTTP Client**: Axios
- **Animações**: Framer Motion — uso obrigatório em micro-interações e transições
- **Tipografia**:
  - `Poppins` (`--font-sans` e `--font-display`): Fonte única para toda a interface — body, títulos, números, tudo
  - `Geist Mono` (`--font-mono`): Apenas detalhes pequenos — badges, timestamps, metadados, código
  - `Lora` (`--font-serif`): Exclusivo para landing page — nunca na interface do produto
- **Cores**: Background `#F7F7FA`, Superfície `#FFFFFF`, Texto `#37352F`, Primário (brand) `#FF5900` (laranja Northie)
  - Dark mode: Background `#131110`, Superfície `#1D1A17`, Texto `#EDE9E4`

---

## Arquitetura Backend

### Ingestão Híbrida
- **OAuth-First**: Meta Ads, Google Ads, Stripe. Backend gerencia ciclo de vida dos tokens silenciosamente.
- **Webhooks**: Hotmart — captura vendas, reembolsos e assinaturas em tempo real.
- **Cron Jobs**: Polling periódico para métricas de Ads e backfill de histórico.

### Northie Schema
Todos os dados brutos são normalizados em objetos padronizados antes de qualquer processamento. A IA sempre lida com a mesma estrutura independente da fonte original.

### Northie Pixel
Script leve que gera ID único de visitante, captura UTMs/GCLID/FBCLID e injeta nos metadados do checkout para atribuição determinística.

### Safety Net
Cron job diário que compara dados locais com APIs das plataformas, detecta gaps de webhook e executa backfill automático. Garante integridade do LTV.

### Rate Limiting
- Meta/Google: Sliding window com cache
- Hotmart: Webhook-first com fila de prioridade máxima
- Geral: Exponential backoff em todas as filas

### Camada de IA
O backend atua como orquestrador: filtra dados normalizados, entrega contexto limpo para o Claude. O Claude possui ferramentas de execução (`pausar_campanha`, `ajustar_budget`, `criar_audience`). Flow: IA decide → backend valida → chamada API → log e notificação.

---

## Estrutura de Dados (Supabase)

### Tabelas Core
- **`profiles`**: Dados do founder, `business_type` (`saas`, `ecommerce`, `startup`, `dtc`)
- **`integrations`**: Tokens OAuth encriptados, status e metadados por plataforma
- **`platforms_data_raw`**: Buffer de JSONs brutos antes da normalização

### Business Intelligence
- **`transactions`**: `id`, `user_id`, `customer_id`, `platform`, `amount_gross`, `amount_net`, `fee_platform`, `status`, `created_at`, `northie_attribution_id`, `campaign_id`
- **`ad_metrics`**: `id`, `campaign_id`, `platform`, `spend_brl`, `spend_original`, `impressions`, `clicks`, `date`
- **`customers`**: `id`, `email`, `total_ltv`, `acquisition_channel` (`meta_ads`, `google_ads`, `organico`, `email`, `direto`, `afiliado`, `desconhecido`), `acquisition_campaign_id`, `rfm_score`, `churn_probability`, `last_purchase_at`

### Produtos Financeiros
- **`capital_score_history`**: Histórico mensal do Capital Score por founder
- **`card_applications`**: Lista de espera e aplicações para o Northie Card

### Atribuição e IA
- **`visits`**: Log do Northie Pixel (UTMs, Click IDs)
- **`affiliate_links`** / **`affiliate_clicks`**: Sistema de atribuição de campanhas
- **`ai_chat_history`**: Histórico do Ask Northie
- **`embeddings`**: Vetores pgvector para memória semântica de longo prazo

---

## Lógica de Cálculo de Métricas

| Métrica | Lógica | Frequência |
|---|---|---|
| LTV | Soma de `amount_net` de transações aprovadas por cliente | Tempo real |
| CAC | `spend_brl` / novos clientes adquiridos no período e canal | Diário |
| Margem | LTV − CAC − taxas de plataforma | Tempo real |
| Status Lucrativo | `Lucrativo` se LTV > (CAC + Taxas) | Pós-compra |
| RFM Score | Pontuação 1–5 para Recência, Frequência e Valor | Diário (madrugada) |
| Churn | SaaS: status assinatura. E-com/Perpétuo: 1.5x intervalo médio. Lançamento: desativado | Semanal |
| ROAS | Receita atribuída ao canal / gasto do canal | Diário |
| ROI Criador | Receita campanha / comissões pagas | Semanal |
| Capital Score | Faturamento histórico + LTV médio + churn + saúde do caixa | Mensal |
| Forecast | Base atual × AOV × rebuy rate histórica por cohort | Diário + on-demand |

---

## Componentes e Layout

### Sistema de Chat IA (Ask Northie)
- **Componente**: `src/components/ChatSidebar.tsx`
- **Sidebar (380px)**: Empurra conteúdo via `paddingRight`
- **Workstation (Full-Screen)**: Tela inteira centralizada em 800px para análise profunda
- **Chips contextuais**: Sugestões dinâmicas baseadas na página ativa (`context` prop)
- **Estética**: Blocos de "Intelligence Output", efeito scanline sutil, animação "Thinking" técnica

### Layout Principal (`App.tsx`)
- Sidebar fixa com `marginLeft` dinâmico
- Estado global: `activePage`, `chatOpen`, `isChatFull`
- Transições suaves com `AnimatePresence`

### Ícones (`src/icons.tsx`)
- Centralizados em um arquivo, exportados como componentes React
- Sempre usar `fill="currentColor"` para controle via pai

---

## Estrutura de Pastas

```
src/
  components/
    charts/         # Gráficos reutilizáveis
    layout/         # Sidebar, TopBar, ChatSidebar
    ui/             # KpiCard, DatePicker, elementos reutilizáveis
  pages/
    Growth/         # Northie Growth — correlações e execução
    Card/           # Northie Card — Capital Score, lista de espera
    Dashboard/      # Visão Geral (complemento)
    Clientes/       # Base de clientes com unit economics (complemento)
    Canais/         # Performance de canais (complemento)
    Vendas/         # Transações consolidadas (complemento)
    Conversas/      # Pipeline nativo + reuniões transcritas
    Contexto/       # Contexto do Negócio — founder treina a IA
    Criadores/      # Campanhas de criadores e gestão de comissões
    Relatorios/     # Relatórios automáticos
    AppStore/       # Gerenciamento de integrações
    Configuracoes/  # Configurações do workspace
    Login/          # Autenticação
  lib/
    api.ts          # Axios client
    supabase.ts     # Auth client
  types/            # Tipos TypeScript compartilhados
  icons.tsx
  App.tsx
  main.tsx

server/src/
  controllers/      # Handlers HTTP por domínio
  routes/           # Rotas Express por domínio
  services/
    ai.service.ts              # Orquestrador Claude, function calling
    integration.service.ts     # Meta, Google, Hotmart, Stripe
    normalization.service.ts   # Northie Schema
    growth.service.ts          # Motor de correlações e execução
    growth-intelligence.service.ts  # Análise de inteligência de growth
    capital.service.ts         # Underwriting, Capital Score
  lib/
    supabase.ts
  utils/
    encryption.ts   # PII e tokens OAuth
    pixel-snippet.ts
  jobs/
    token-refresh.job.ts          # Renova OAuth tokens a cada 30min
    ads-sync.job.ts               # Sync Meta/Google Ads a cada 6h
    hotmart-sync.job.ts           # Backfill de vendas Hotmart
    stripe-sync.job.ts            # Sync de transações Stripe
    shopify-sync.job.ts           # Sync de pedidos Shopify
    rfm-calc.job.ts               # RFM, CAC, churn_probability — diário
    alerts.job.ts                 # Detecção de anomalias — a cada 1h
    growth-correlations.job.ts    # Motor de correlações — a cada 24h
    correlation-refresh.job.ts    # Refresh das materialized views
    capital-score.job.ts          # Capital Score — mensal
    reports.job.ts                # Geração de relatórios automáticos
    safety-net.job.ts             # Reconciliação diária — Safety Net
    chat-cleanup.job.ts           # Limpeza de histórico de chat
    meta-lead-attribution.job.ts  # Atribuição de leads Meta
  types/
  index.ts

supabase/
  migrations/       # SQL migrations versionadas
```

---

## Convenções de Código e Design

- **Design premium**: evitar cores genéricas. Micro-interações (`whileHover`, `whileTap`) em todos os elementos interativos
- **Internacionalização**: números e moedas sempre formatados para `pt-BR`
- **Easings de animação**:
  - Layout: `[0.4, 0, 0.2, 1]`
  - Fades/Entradas: `[0.25, 0.1, 0.25, 1]`
- **Contexto antes de número**: toda métrica exibida deve ter contexto — nunca mostrar número isolado sem comparativo, tendência ou significado
- **Confirmação antes de execução**: qualquer ação automática (Growth, Card split) exige confirmação explícita do founder antes de ser executada
- **Segurança**: dados PII sempre encriptados antes de armazenar, payloads anonimizados antes de enviar para a IA
- **Git/Vercel**: repositório `possato-a/northie`, deploy automático na Vercel via push na `main`

---

## Princípios que Guiam Decisões Técnicas

1. **Contexto é o produto** — dado bruto sem contexto é ruído. Toda feature deve agregar contexto, não apenas mostrar mais dados.

2. **Cruzamento de fontes é o diferencial** — qualquer automação que uma plataforma isolada já consegue fazer não é diferencial. O valor está onde é necessário cruzar pelo menos duas fontes.

3. **Confirmação antes de execução** — a IA recomenda, o founder decide. Nunca executar ação sem aprovação explícita.

4. **Dados acumulados são o moat** — o histórico que cresce mês a mês é o ativo mais valioso. Decisões de arquitetura devem sempre proteger e enriquecer esse histórico.

5. **Financeiro como consequência** — o produto resolve crescimento. Capital é consequência natural de ter dados que ninguém mais tem — não feature de uma fintech.

6. **Contexto qualitativo enriquece o quantitativo** — reuniões transcritas, contexto do negócio alimentado pelo founder e pipeline nativo existem para dar história aos números, não para serem produtos isolados. Uma transação com contexto de reunião é mais valiosa que uma transação sem.

## Colaboração entre founders

Este projeto é desenvolvido por dois founders em branches separadas. O merge para `main` acontece sempre em conjunto, numa call ou sessão presencial.

### Regras de colaboração
- Nunca desenvolver direto na `main`
- Cada founder trabalha na sua branch: `feat/nome-da-feature`
- Commits frequentes com descrições claras do que foi feito
- Push diário para o GitHub mesmo que a feature não esteja pronta
- Merge para `main` sempre feito em dupla, com review em tempo real

### Divisão de domínio
- **Possato**: backend (`server/`), integrações, Supabase migrations
- **Vitor**: frontend (`src/`), componentes, páginas, design system
- Evitar editar o mesmo arquivo ao mesmo tempo

### Fluxo antes do merge conjunto
1. Atualizar a branch com a main: `git rebase origin/main`
2. Resolver conflitos se existirem
3. Abrir PR no GitHub
4. Revisar juntos e mergear

---

## Roadmap — Rodada 1

### Fase A — Banco de dados ✅ CONCLUÍDA
Schema revisado, migrations estáveis, RLS policies completas, motor de correlações ativo com dados reais.

### Fase B — Desenvolvimento paralelo ✅ CONCLUÍDA
Integrações (Stripe, Shopify, Meta, Hotmart), páginas Growth e Card, motor de correlações, Capital Score, Relatórios, Contexto do Negócio e Conversas todos implementados e mergeados na `main`.

### Fase C — Em andamento
- Google Calendar + Google Meet (transcrição IA)
- WhatsApp Business API (execução de reativação)
- Northie Pixel (atribuição determinística)
- Testes e hardening das integrações existentes