# Northie: Backend Architecture & Development Guide
> Documento de referência para desenvolvimento contínuo. Reflete o produto v14.
> Última atualização: 16 Março 2026

---

## 0. Contexto do Pivot

O produto original era um analytics tool com IA conversacional em cima. O produto atual é **infraestrutura financeira para founders digitais**, composta por dois produtos interdependentes:

| Produto | O que faz | Dependências técnicas |
|---|---|---|
| **Northie Growth** | Detecta correlações entre fontes e executa ações com aprovação do founder | Todas as integrações + cohort de LTV |
| **Northie Card** | Cartão com limite baseado nos dados reais do negócio | Histórico mínimo de dados + parceiro financeiro (Fase 2) |

O backend existe para servir esses produtos. Não é um fim em si mesmo.

---

## 1. O Que Já Existe (Estado Atual)

### 1.1 Pipeline de Ingestão — Sólido, manter

**OAuth + Token Management**
- Fluxo OAuth completo para Meta Ads, Google Ads e Hotmart
- Token storage encriptado (AES-256-CBC) na tabela `integrations`
- Auto-refresh com mutex para evitar execuções paralelas
- Estado do token: `isNearExpiry()` com buffer configurável por plataforma

**Webhooks**
- Endpoint genérico `POST /api/webhooks/:platform`
- Validação de schema via Zod antes de persistir (rejeita payload malformado com 400)
- Fila em memória com retry exponencial e recovery de itens pendentes no boot
- Handlers normalizadores para: Stripe, Hotmart, Shopify

**Cron Jobs**
- `ads-sync.job.ts`: Sincroniza Meta Ads nos três níveis (campaign/adset/ad) com upsert em batch. Roda a cada 6h.
- `hotmart-sync.job.ts`: Backfill de vendas via client_credentials. Idempotente via `external_id`.
- `rfm-calc.job.ts`: Calcula RFM score, CAC e churn_probability para todos os customers. Roda a cada 24h.
- `alerts.job.ts`: Detecta anomalias (ROAS drop, churn alto, receita zerada, spike orgânico). Roda a cada 1h.
- `token-refresh.job.ts`: Verifica e renova tokens OAuth a cada 30min.

**Northie Pixel**
- `POST /api/pixel/event`: Captura UTMs, GCLID, FBCLID e visitor_id
- Snippet JS gerado pelo `pixel-snippet.ts` para embed nos sites dos clientes
- Atribuição last-click via `visits` table cruzada com `northie_attribution_id` nas transações

**Normalização**
- Schema unificado: todas as plataformas resultam nos mesmos objetos (`transactions`, `customers`)
- Atribuição de campanha e criador via trigger no PostgreSQL (`resolve_creator_attribution`)
- LTV atualizado em tempo real a cada transação aprovada
- Reembolsos e cancelamentos revertem LTV automaticamente

### 1.2 Dashboard API — Sólido, manter

Endpoints existentes em `/api/dashboard/`:
- `GET /stats` — Revenue total, customer count, AOV
- `GET /attribution` — ROAS, CAC, LTV por canal (Meta Ads + Google Ads)
- `GET /growth` — Comparação 30d vs 30d anterior
- `GET /chart` — Série temporal de receita (15 dias)
- `GET /heatmap` — Intensidade de vendas no ano (mapa de calor)
- `GET /retention` — Cohort de retenção por mês de aquisição (30/60/90/180d)
- `GET /top-customers` — Top 10 por LTV
- `GET /channel-trends` — ROAS e CAC diários por plataforma (15 dias)
- `GET /ad-campaigns` — Campanhas agregadas com métricas calculadas
- `GET /ad-campaigns/:campaignId` — Drill-down em adsets e ads

### 1.3 Estrutura de Dados Existente

```
profiles               — workspace do founder
integrations           — tokens OAuth encriptados por plataforma
platforms_data_raw     — buffer de webhooks brutos (audit trail)
transactions           — core financeiro (todas as vendas normalizadas)
customers              — base unificada com LTV, RFM, churn_probability, CAC
campaigns              — campanhas de criadores/afiliados
creators               — perfis de criadores
campaign_creators      — vínculo campanha ↔ criador
commissions            — comissões geradas por venda atribuída
affiliate_links        — links com slug único por criador
visits                 — log do pixel (UTMs, click IDs, visitor_id)
ad_metrics             — spend/impressions/clicks diários por plataforma
ad_campaigns           — métricas nos três níveis (campaign/adset/ad) com granularidade diária
ai_chat_history        — histórico de mensagens do Ask Northie
alerts                 — alertas gerados pelos jobs
sync_logs              — log de execução de cada sync com status e rows
```

---

## 2. Estado de Implementação (atualizado 2026-03-16)

### 2.1 Northie Growth — ✅ IMPLEMENTADO

Tabela `growth_recommendations` (migration `20260304000001`), com 10 tipos de recomendação e 10 detectores rodando a cada hora via `growth-correlations.job.ts`.

**Serviços:**
- `growth.service.ts` — dispatcher + 10 executores (Meta Custom Audience, pausa de campanha, etc.)
- `growth-intelligence.service.ts` — pipeline multi-agente (4 agentes sequenciais)
- `services/agents/` — 4 agentes IA: strategic-advisor, traffic-analyst, conversion-analyst, attribution

**Rotas existentes:**
```
GET  /api/growth/recommendations              — lista pendentes + recentes (7d)
POST /api/growth/recommendations/:id/approve  — aprova → execução async (202)
POST /api/growth/recommendations/:id/dismiss  — "agora não"
POST /api/growth/recommendations/:id/reject   — rejeição definitiva
POST /api/growth/recommendations/:id/cancel   — cancela execução em andamento
GET  /api/growth/recommendations/:id/status   — polling de status + execution_log
GET  /api/growth/metrics                      — snapshot de métricas de correlação
POST /api/growth/diagnostic                   — pipeline multi-agente (rate-limited)
GET  /api/growth/diagnostic/latest            — último diagnóstico cached
```

**10 tipos de recomendação:** `reativacao_alto_ltv`, `pausa_campanha_ltv_baixo`, `audience_sync_champions`, `realocacao_budget`, `upsell_cohort`, `divergencia_roi_canal`, `queda_retencao_cohort`, `canal_alto_ltv_underinvested`, `cac_vs_ltv_deficit`, `em_risco_alto_valor`

### 2.2 Capital Score — ✅ IMPLEMENTADO

Tabela `capital_score_history` (migration `20260303000001`) com 4 dimensões de score (0-25 cada). Tabela `card_applications` para lista de espera.

**Serviço:** `capital.service.ts` — calcula score baseado em revenue consistency, customer quality, acquisition efficiency, platform tenure.

**Rotas existentes:**
```
GET  /api/card/score    — retorna Capital Score atual
POST /api/card/apply    — aplica para o card (entra na lista)
```

### 2.3 Relatórios Automáticos — ✅ IMPLEMENTADO

Tabelas `report_configs` e `report_logs` (migration `20260306000001`). Sistema completo com PDF, XLSX, análise IA e envio por email via Resend.

**Módulo:** `services/reports/` — 12 arquivos incluindo gerador, PDF, XLSX, email, AI analyst, business model analysis.

### 2.4 IA — ✅ IMPLEMENTADO

`ai.service.ts` já usa `claude-sonnet-4-6` como padrão. Growth AI tem 3 function calling tools (`get_recommendation_detail`, `get_segment_preview`, `explain_correlation`). General AI é chat puro (sem tools — intencional).

---

## 3. Evoluções Pendentes

### 3.1 `rfm-calc.job.ts` → adicionar Audience Sync

Após calcular RFM, o job deve exportar automaticamente o segmento "Champions" como Custom Audience no Meta via API.

### 3.2 Canais de execução nativos

- **WhatsApp** (Meta Business API) — reativação, upsell, alertas
- **Email** (Resend) — sequências de nurturing e reativação

### 3.3 Google Calendar + Google Meet

- Integração de calendário para saber se houve reuniões antes do fechamento
- Transcrição IA de Google Meet para enriquecer transações com contexto qualitativo

### 3.4 Northie Pixel — atribuição determinística

O Pixel funciona (`POST /api/pixel/event`) mas ainda não está deployed em sites de clientes. Atribuição atual é heurística temporal.

> **Nota (2026-03-16):** As seções sobre upgrade do ai.service.ts (modelo + function calling), fix do acquisition_channel Hotmart, e alertas de Growth já foram implementadas.

---

## 4. Decisões de Arquitetura

### Princípio central: o backend valida, não executa autonomamente

Toda ação do Growth passa por:
```
Engine detecta correlação → gera growth_action (pending) → founder aprova → executor roda → log
```

O Claude pode chamar `create_growth_action` via function calling, mas nunca chama diretamente a API do Meta ou dispara comunicações. A aprovação do founder é obrigatória.

### Contexto da IA por produto

Cada produto alimenta o contexto do Claude de forma diferente:
- **Growth**: dados de correlação entre fontes
- **Card**: histórico financeiro para underwriting

O `ai.service.ts` deve receber um `product_context` como parâmetro e montar o system prompt adequado.

### Lock-in por histórico

O moat do produto é o histórico acumulado. Cada mês de dados torna as correlações mais precisas. Implicações técnicas:
- Nunca deletar dados normalizados, apenas marcar como `status: 'cancelled'` ou `'refunded'`
- O Capital Score depende de séries temporais — a precisão aumenta com o tempo

---

## 5. Roadmap Técnico por Fase

### Fase 1 — Growth + Card + Relatórios — ✅ CONCLUÍDA

Todos os itens P0, P1 e P2 implementados: growth_recommendations (10 tipos), capital_score_history, card_applications, report_configs, report_logs, ai.service com Sonnet 4 + function calling.

### Fase 2 — Em andamento (Fase C do produto)

| O que construir | Prioridade |
|---|---|
| Canais de execução: WhatsApp Business API + Resend email | P0 |
| Google Calendar + Google Meet (transcrição IA) | P1 |
| Deploy do Northie Pixel em sites de clientes | P1 |
| Audience Sync automático no rfm-calc.job.ts | P2 |
| Testes e hardening das integrações existentes | P2 |

### Fase 3 — Northie Card (requer parceiro financeiro regulado)

Dependências técnicas que precisam estar prontas:
- Capital Score calculado e histórico de pelo menos 3 meses por profile elegível
- Lista de espera qualificada com score mínimo definido
- Integração com QI Tech ou Celcoin para desembolso (novo domínio, fora do escopo atual)
- Split de pagamento configurado nas integrações Hotmart/Stripe

---

## 6. Tabelas Implementadas (referência)

Todas as tabelas abaixo já existem no banco via migrations. Ver `supabase/migrations/` para schemas exatos.

| Tabela | Migration | Descrição |
|--------|-----------|-----------|
| `growth_recommendations` | `20260304000001` | 10 tipos de recomendação, status com RLS |
| `capital_score_history` | `20260303000001` | Score mensal com 4 dimensões (0-25 cada) |
| `card_applications` | `20260303000001` | Lista de espera + aplicações para o Card |
| `report_configs` | `20260306000001` | Configuração de relatórios automáticos |
| `report_logs` | `20260306000001` | Histórico de relatórios gerados |
| `mv_campaign_ltv_performance` | `20260309000001` | View materializada: LTV/ROI por canal |
| `mv_customer_campaign_attribution` | `20260309000001` | View materializada: atribuição |
| `mv_cohort_retention` | `20260309000001` | View materializada: retenção por cohort |
| `campaign_performance_snapshots` | `20260309000002` | Snapshots diários de performance |

> **Nota:** O doc original chamava a tabela de `growth_actions` — nome real é `growth_recommendations`. Idem `capital_scores` → `capital_score_history`, `card_waitlist` → `card_applications`, `report_history` → `report_logs`.

---

## 7. Estrutura de Arquivos Atual

```
server/src/
├── controllers/        (14 arquivos)
│   ├── ai.controller.ts
│   ├── alerts.controller.ts
│   ├── campaign.controller.ts
│   ├── card.controller.ts
│   ├── customers.controller.ts
│   ├── dashboard.controller.ts
│   ├── growth.controller.ts
│   ├── integration.controller.ts
│   ├── pixel.controller.ts
│   ├── profile.controller.ts
│   ├── reports.controller.ts
│   ├── resend-webhook.controller.ts
│   ├── transactions.controller.ts
│   └── webhook.controller.ts
├── jobs/               (14 arquivos)
│   ├── ads-sync.job.ts              — Meta/Google Ads sync (6h)
│   ├── alerts.job.ts                — Anomalias (1h)
│   ├── capital-score.job.ts         — Capital Score (mensal)
│   ├── chat-cleanup.job.ts          — Limpeza chat >30d (diário)
│   ├── correlation-refresh.job.ts   — Refresh materialized views (24h)
│   ├── growth-correlations.job.ts   — Motor de correlações (1h)
│   ├── hotmart-sync.job.ts          — Hotmart backfill (6h)
│   ├── meta-lead-attribution.job.ts — Atribuição retroativa Meta
│   ├── reports.job.ts               — Relatórios automáticos (diário)
│   ├── rfm-calc.job.ts              — RFM/CAC/churn (diário)
│   ├── safety-net.job.ts            — Reconciliação dados (3h)
│   ├── shopify-sync.job.ts          — Shopify sync (6h)
│   ├── stripe-sync.job.ts           — Stripe sync (6h)
│   └── token-refresh.job.ts         — OAuth token refresh (30min)
├── routes/             (13 arquivos)
│   ├── ai.routes.ts, alerts.routes.ts, campaign.routes.ts, card.routes.ts,
│   ├── cron.routes.ts, dashboard.routes.ts, data.routes.ts, growth.routes.ts,
│   ├── integration.routes.ts, pixel.routes.ts, profile.routes.ts,
│   ├── reports.routes.ts, webhook.routes.ts
├── services/
│   ├── ai.service.ts               — Claude Sonnet 4.6 + function calling
│   ├── capital.service.ts           — Capital Score (4 dimensões)
│   ├── growth.service.ts            — Dispatcher + 10 executores
│   ├── growth-intelligence.service.ts — Pipeline multi-agente (4 agentes)
│   ├── integration.service.ts       — OAuth state, tokens
│   ├── normalization.service.ts     — Northie Schema
│   ├── agents/                      — 4 agentes IA (strategic, traffic, conversion, attribution)
│   └── reports/                     — 12 arquivos (PDF, XLSX, AI analyst, email)
├── middleware/
│   ├── auth.middleware.ts           — JWT local + Supabase fallback
│   └── rate-limit.middleware.ts     — 3 tiers
├── lib/
│   ├── supabase.ts, webhook-queue.ts, webhook-schemas.ts
├── utils/
│   ├── encryption.ts, pixel-snippet.ts
├── types/
│   └── index.ts                     — Tipos compartilhados
└── index.ts                         — Entry point Express
```
