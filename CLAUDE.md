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
Fundação de tudo. Conecta Meta Ads, Google Ads, Hotmart, Kiwify, Stripe e Shopify via API. Os dados são normalizados via **Northie Schema** em objetos padronizados: transações, clientes, campanhas, métricas de ads. O banco de dados cresce com o uso e é o ativo central da plataforma.

### Produto 1 — Northie Growth
**Produto central.** Execução automática de ações de growth baseadas em cruzamento de dados de múltiplas fontes. O diferencial é o contexto — não a automação. Cada ação exige cruzamento de pelo menos duas fontes distintas para fazer sentido.

Princípio de execução: a IA identifica correlações, formula recomendação com contexto completo, apresenta para o founder confirmar. O founder aprova — a Northie executa. Nunca o contrário.

Ações: reativação de clientes de alto LTV, pausa de campanha baseada em LTV histórico (não só ROAS), Audience Sync inteligente por qualidade financeira, realocação de budget por LTV por canal, upsell automático baseado em comportamento de cohort.

### Produto 2 — Northie Card
Cartão corporativo com limite baseado no faturamento real do negócio. Capital sem garantia física, sem equity, sem burocracia. O limite é calculado pelos dados reais da Northie — histórico de faturamento, LTV médio, churn, saúde do caixa.

Split na fonte: pagamento capturado automaticamente como percentual fixo da receita diretamente nas integrações (Stripe, Hotmart, Kiwify) antes de chegar na conta do founder. Elimina risco de inadimplência.

Capital Score: visível desde o primeiro dia, atualizado mensalmente. Founder que não está elegível entra na lista de espera com um clique.

Opera via parceiro financeiro regulado (QI Tech ou Celcoin). A Northie faz o underwriting e fica com o spread + MDR das transações.

### Produto 3 — Northie Raise
Data room auditado e contínuo. Não é ferramenta para encontrar investidor — é ferramenta para não perder o investidor que você já encontrou. Resolve a due diligence, não o acesso.

Métricas conectadas às fontes reais: faturamento do Stripe, CAC do Meta Ads, LTV da base de clientes, cohort de retenção. Dados impossíveis de manipular. Northie Score calculado automaticamente. Link de acesso com permissões configuráveis. Exportação de relatório PDF.

### Produto 4 — Northie Valuation
O founder acompanha quanto o negócio vale hoje — calculado com base nos dados reais, atualizado todo mês. Múltiplo de receita, ARR, LTV/CAC com benchmark de negócios similares dentro da própria plataforma Northie (não relatório genérico de mercado).

### Feature Transversal — Relatórios Automáticos
Presente em todos os produtos. Founder configura relatórios automáticos (semanal, mensal, trimestral) em PDF visual, CSV ou apresentação. Gerados e enviados automaticamente sem ação manual.

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
  - `Poppins`: Interface geral e títulos
  - `Geist Mono`: Dados, números, tabelas e saídas de IA
- **Cores**: Base `#FCF8F8`, Texto/Ícones `#1E1E1E`

---

## Arquitetura Backend

### Ingestão Híbrida
- **OAuth-First**: Meta Ads, Google Ads, Stripe. Backend gerencia ciclo de vida dos tokens silenciosamente.
- **Webhooks**: Hotmart, Kiwify — captura vendas, reembolsos e assinaturas em tempo real.
- **Cron Jobs**: Polling periódico para métricas de Ads e backfill de histórico.

### Northie Schema
Todos os dados brutos são normalizados em objetos padronizados antes de qualquer processamento. A IA sempre lida com a mesma estrutura independente da fonte original.

### Northie Pixel
Script leve que gera ID único de visitante, captura UTMs/GCLID/FBCLID e injeta nos metadados do checkout para atribuição determinística.

### Safety Net
Cron job diário que compara dados locais com APIs das plataformas, detecta gaps de webhook e executa backfill automático. Garante integridade do LTV.

### Rate Limiting
- Meta/Google: Sliding window com cache
- Hotmart/Kiwify: Webhook-first com fila de prioridade máxima
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
- **`raise_rooms`**: Data rooms criados, permissões, links de acesso, histórico de visualizações
- **`valuation_snapshots`**: Snapshots mensais de valuation calculado com metodologia e benchmark

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
| Valuation | Múltiplo de receita + ARR + LTV/CAC com benchmark interno | Mensal |
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
    Raise/          # Northie Raise — data room, métricas auditadas
    Valuation/      # Northie Valuation — valor do negócio
    Dashboard/      # Visão Geral (complemento)
    Clientes/       # Base de clientes com unit economics (complemento)
    Canais/         # Performance de canais (complemento)
    Vendas/         # Transações consolidadas (complemento)
    AppStore/       # Gerenciamento de integrações
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
    ai/             # Orquestrador Claude, function calling
    integrations/   # Meta, Google, Hotmart, Kiwify, Stripe
    normalization/  # Northie Schema
    growth/         # Motor de correlações e execução
    capital/        # Underwriting, Capital Score
    raise/          # Data room, Northie Score
    valuation/      # Cálculo de valuation, benchmark
  lib/
    supabase.ts
  utils/
    encryption.ts   # PII e tokens OAuth
    pixel-snippet.ts
  jobs/
    token-refresh.ts
    daily-reconciliation.ts   # Safety Net
    metrics-calculator.ts     # Cálculos diários
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

5. **Financeiro como consequência** — o produto resolve crescimento. Capital, Raise e Valuation são consequências naturais de ter dados que ninguém mais tem — não features de uma fintech.

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

### Fase A — Francisco solo (banco de dados)
Banco estável antes de qualquer desenvolvimento paralelo. Victor em modo estudo.

| Branch | Tarefa |
|--------|--------|
| `feat/db-schema-review` | Revisar schema existente — consistência de tipos, naming e foreign keys |
| `feat/db-card` | Migration: `capital_score_history` + `card_applications` |
| `feat/db-raise` | Migration: `raise_rooms` + permissões de acesso |
| `feat/db-valuation` | Migration: `valuation_snapshots` |
| `feat/db-rls` | RLS policies completas em todas as tabelas |
| `feat/db-docs` | Documentar schema final |

**Critério de saída:** banco estável, documentado, sem migrations pendentes.

### Fase B — Paralelo (começa quando Fase A termina)

**Francisco**

| Branch | Tarefa |
|--------|--------|
| `feat/stripe-integration` | Stripe — OAuth + sync de transações |
| `feat/shopify-integration` | Shopify — OAuth + sync de pedidos |
| `feat/growth-page` | Tela Growth — recomendações + fluxo de confirmação |
| `feat/card-page` | Tela Card — Capital Score visual + lista de espera |
| `feat/raise-page` | Tela Raise — data room + métricas ao vivo |
| `feat/valuation-page` | Tela Valuation — valor do negócio + histórico |

**Victor**

| Branch | Tarefa |
|--------|--------|
| `feat/meta-integration` | Meta Ads — garantir funcionalidade completa + testes |
| `feat/google-ads-integration` | Google Ads — OAuth + sync de métricas |
| `feat/hotmart-integration` | Hotmart — revisar webhook + normalização completa |