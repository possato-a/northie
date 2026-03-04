# Northie: Backend Architecture & Development Guide
> Documento de referência para desenvolvimento contínuo. Reflete o produto v10.
> Última atualização: Março 2026

---

## 0. Contexto do Pivot

O produto original era um analytics tool com IA conversacional em cima. O produto atual é **infraestrutura financeira para founders digitais**, composta por quatro produtos interdependentes:

| Produto | O que faz | Dependências técnicas |
|---|---|---|
| **Northie Growth** | Detecta correlações entre fontes e executa ações com aprovação do founder | Todas as integrações + cohort de LTV |
| **Northie Card** | Cartão com limite baseado nos dados reais do negócio | Histórico mínimo de dados + parceiro financeiro (Fase 2) |
| **Northie Raise** | Data room auditado com métricas conectadas às fontes | Growth ativo + permissões por investidor |
| **Northie Valuation** | Valuation mensal calculado automaticamente com benchmark | Dados acumulados de múltiplos profiles (Fase 3) |

O backend existe para servir esses quatro produtos. Não é um fim em si mesmo.

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

## 2. O Que Precisa Ser Construído

### 2.1 Northie Growth — O produto central, Fase 1

O Growth é o diferencial técnico: **cruzar pelo menos duas fontes de dados para gerar uma recomendação que nenhuma plataforma isolada consegue fazer**. A IA não executa — ela recomenda. O founder aprova. O backend executa.

**Tabelas novas necessárias:**

```sql
-- Recomendações geradas pelo engine de correlação
CREATE TABLE growth_actions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id      UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    type            TEXT NOT NULL,  -- 'reactivation', 'campaign_pause', 'audience_sync', 'budget_reallocation', 'upsell'
    status          TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'approved', 'rejected', 'executed', 'failed'
    title           TEXT NOT NULL,
    rationale       TEXT NOT NULL,  -- Explicação do cruzamento que gerou a ação
    data_sources    TEXT[] NOT NULL, -- Ex: ['ad_campaigns', 'transactions'] — quais fontes foram cruzadas
    payload         JSONB NOT NULL,  -- Parâmetros da ação (campaign_id, audience_size, etc.)
    impact_estimate JSONB,          -- Estimativa de impacto (revenue, clientes reativados, etc.)
    approved_at     TIMESTAMP WITH TIME ZONE,
    executed_at     TIMESTAMP WITH TIME ZONE,
    error_message   TEXT,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

CREATE INDEX idx_growth_actions_profile_status ON growth_actions(profile_id, status, created_at DESC);
```

**Serviço novo: `growth-engine.service.ts`**

Responsável por rodar as correlações e gerar `growth_actions` com status `pending`. Deve ser chamado pelo `growth-engine.job.ts` a cada 24h e sob demanda via API.

Correlações a implementar (em ordem de prioridade):

```
1. ROAS alto + LTV baixo → recomendar pausa de campanha
   Fontes: ad_campaigns (ROAS) × transactions cohort por campaign_id (LTV médio 90d)
   Threshold: ROAS > 3x AND LTV médio dos clientes da campanha < LTV médio geral * 0.7

2. Clientes Champions sem compra recente → recomendar reativação
   Fontes: customers (rfm_score) × transactions (last_purchase_at)
   Threshold: rfm_score LIKE '5%' AND last_purchase_at < NOW() - INTERVAL '60 days'

3. Canal com melhor LTV/CAC → recomendar realocação de budget
   Fontes: ad_campaigns (spend) × customers (total_ltv, acquisition_channel)
   Lógica: comparar LTV médio por canal, recomendar shift de budget do pior pro melhor

4. Clientes no momento de recompra do cohort → recomendar upsell
   Fontes: customers (cohort) × transactions (padrão de frequência do cohort)
   Lógica: identificar intervalo médio de recompra do cohort e notificar próximos a chegar nele
```

**Serviço de execução: `growth-executor.service.ts`**

Executado apenas após aprovação do founder. Implementações por tipo:

```typescript
// campaign_pause: chama Meta Ads API para pausar campanha
// audience_sync: exporta segmento de customers como Custom Audience no Meta
// reactivation: dispara via integração de email/whatsapp (a definir)
// budget_reallocation: ajusta budget via Meta Ads API
// upsell: dispara via integração de email (a definir)
```

**Rotas novas:**
```
GET  /api/growth/actions          — lista ações pendentes e histórico
POST /api/growth/actions/:id/approve  — founder aprova → executor roda
POST /api/growth/actions/:id/reject   — founder rejeita
GET  /api/growth/actions/:id      — detalhes de uma ação (fontes, payload, impacto)
```

**Evolução do `ai.service.ts`**

O Claude precisa de function calling real para o Growth funcionar. Hoje o system prompt é genérico. Precisa:

1. Trocar `claude-3-haiku` por `claude-sonnet-4-20250514` (Sonnet 4 como padrão)
2. Adicionar tools para o Claude chamar ao analisar dados:
   - `get_campaign_ltv_analysis(campaign_id)` — cruza ad_campaigns com transactions
   - `get_reactivation_candidates()` — retorna Champions sem compra recente
   - `get_channel_comparison()` — LTV/CAC por canal

3. O resultado do function calling gera um `growth_action` com `pending` — não executa direto

### 2.2 Northie Raise — Fase 1

O Raise é um data room auditado. Tecnicamente: um conjunto de endpoints públicos com autenticação por token + log de acesso.

**Tabelas novas necessárias:**

```sql
-- Links de acesso para investidores
CREATE TABLE raise_access_links (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id      UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    investor_name   TEXT NOT NULL,
    investor_email  TEXT,
    token           TEXT UNIQUE NOT NULL,  -- UUID gerado, usado na URL
    permissions     JSONB NOT NULL DEFAULT '{"mrr": true, "ltv": true, "cac": true, "cohort": true, "churn": true}',
    expires_at      TIMESTAMP WITH TIME ZONE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

-- Log de cada acesso ao data room
CREATE TABLE raise_access_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    link_id         UUID REFERENCES raise_access_links(id) ON DELETE CASCADE NOT NULL,
    profile_id      UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    accessed_at     TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    duration_seconds INTEGER,
    sections_viewed TEXT[],  -- quais seções o investidor visualizou
    ip              TEXT,
    user_agent      TEXT
);

CREATE INDEX idx_raise_access_log_link ON raise_access_log(link_id, accessed_at DESC);
CREATE INDEX idx_raise_access_links_token ON raise_access_links(token);
```

**Rotas novas:**
```
POST /api/raise/links              — criar link para investidor com permissões configuráveis
GET  /api/raise/links              — listar links ativos
DELETE /api/raise/links/:id        — revogar link
GET  /api/raise/links/:id/activity — quem acessou e por quanto tempo

GET  /api/raise/view/:token        — endpoint público do data room (autenticado por token)
POST /api/raise/view/:token/ping   — frontend envia pings de tempo de sessão
```

**O endpoint `/api/raise/view/:token`** retorna apenas as métricas permitidas pelas `permissions` do link:
- MRR/ARR calculado das transações
- LTV médio e por canal
- CAC por canal
- Cohort de retenção
- Churn probability médio
- Northie Score (já calculado)

Tudo conectado às fontes reais — não é dado digitado pelo founder.

**Exportação em PDF**

O Raise precisa exportar um relatório em PDF. Implementar endpoint:
```
POST /api/raise/links/:id/export-pdf  — gera PDF com as métricas do data room
```

### 2.3 Capital Score — Fase 1 (preparação para Fase 2)

O Capital Score deve aparecer desde o primeiro dia para o usuário, mesmo sem o Card lançado. Serve como engajamento e lista de espera qualificada.

**Tabela nova:**

```sql
CREATE TABLE capital_scores (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id      UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
    score           INTEGER NOT NULL DEFAULT 0,  -- 0-1000
    eligible_limit  DECIMAL(12, 2) DEFAULT 0,    -- valor estimado de limite
    eligible        BOOLEAN DEFAULT false,
    breakdown       JSONB NOT NULL DEFAULT '{}', -- detalhamento dos fatores
    calculated_at   TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

CREATE TABLE card_waitlist (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id      UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
    joined_at       TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    score_at_join   INTEGER NOT NULL,
    notified        BOOLEAN DEFAULT false
);
```

**Job novo: `capital-score.job.ts`**

Roda mensalmente. Calcula score baseado em:
- MRR dos últimos 3 meses (peso: 40%)
- Taxa de churn média da base (peso: 25%)
- LTV médio dos customers (peso: 20%)
- Tempo de histórico na plataforma em meses (peso: 15%)

Resultado: score 0-1000 e limite estimado.

**Rotas novas:**
```
GET  /api/card/score       — retorna Capital Score atual do perfil
POST /api/card/waitlist    — founder entra na lista de espera
GET  /api/card/waitlist    — status na lista (posição, score atual, critérios faltantes)
```

### 2.4 Relatórios Automáticos — Feature transversal

Presente em todos os produtos. O founder configura e os relatórios chegam sem precisar abrir a plataforma.

**Tabelas novas:**

```sql
CREATE TABLE report_configs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id      UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    name            TEXT NOT NULL,
    frequency       TEXT NOT NULL,  -- 'weekly', 'monthly', 'quarterly'
    sections        TEXT[] NOT NULL, -- ['growth', 'card', 'raise', 'valuation']
    format          TEXT NOT NULL DEFAULT 'pdf',  -- 'pdf', 'csv'
    delivery        TEXT NOT NULL DEFAULT 'email', -- 'email', 'whatsapp'
    active          BOOLEAN DEFAULT true,
    next_run_at     TIMESTAMP WITH TIME ZONE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

CREATE TABLE report_history (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id       UUID REFERENCES report_configs(id) ON DELETE CASCADE NOT NULL,
    profile_id      UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    generated_at    TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    file_url        TEXT,
    status          TEXT DEFAULT 'success',
    error_message   TEXT
);
```

**Job novo: `reports.job.ts`**

Roda a cada hora, verifica configs com `next_run_at <= NOW()`, gera o relatório e atualiza `next_run_at`.

### 2.5 Northie Valuation — Fase 3

Estrutura simples, depende de dados acumulados de múltiplos profiles para o benchmark.

```sql
CREATE TABLE valuation_snapshots (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id      UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    valuation_brl   DECIMAL(16, 2) NOT NULL,
    methodology     TEXT NOT NULL,  -- 'arr_multiple', 'ltv_cac', 'revenue_multiple'
    multiple_used   DECIMAL(6, 2),
    arr             DECIMAL(14, 2),
    benchmark_data  JSONB,          -- dados anônimos de profiles similares usados no benchmark
    calculated_at   TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

CREATE INDEX idx_valuation_profile ON valuation_snapshots(profile_id, calculated_at DESC);
```

---

## 3. Evoluções Necessárias no Que Já Existe

### 3.1 `rfm-calc.job.ts` → adicionar Audience Sync

Após calcular RFM, o job deve exportar automaticamente o segmento "Champions" (rfm_score LIKE '5%' ou '4%5%') como Custom Audience no Meta via API. Isso é o "Audience Sync inteligente" do produto.

Adicionar ao final do `calcRfmForProfile`:
```typescript
// Se o perfil tem integração Meta ativa, sincronizar Champions como Custom Audience
await syncChampionsToMetaAudience(profileId);
```

### 3.2 `alerts.job.ts` → adicionar correlações de Growth

Os alertas atuais são simples (ROAS caiu, churn alto). Adicionar:

```typescript
// ROAS alto com LTV baixo — o insight central do produto
async function checkRoasLtvMismatch(profileId: string): Promise<void>
// Canal orgânico crescendo sem investimento correspondente
async function checkOrganicGrowthOpportunity(profileId: string): Promise<void>
// Cohort de clientes chegando no momento de recompra
async function checkRepurchaseWindow(profileId: string): Promise<void>
```

### 3.3 `ai.service.ts` → trocar modelo e adicionar function calling

```typescript
// Antes
model: 'claude-3-haiku-20240307'

// Depois
model: 'claude-sonnet-4-20250514'
```

Adicionar tools para o Claude usar ao responder perguntas de growth:

```typescript
const tools = [
  {
    name: 'get_campaign_ltv_analysis',
    description: 'Retorna análise de LTV dos clientes adquiridos por uma campanha específica',
    input_schema: { type: 'object', properties: { campaign_id: { type: 'string' } } }
  },
  {
    name: 'get_reactivation_candidates',
    description: 'Lista clientes Champions com alta probabilidade de reativação',
    input_schema: { type: 'object', properties: { limit: { type: 'number' } } }
  },
  {
    name: 'create_growth_action',
    description: 'Cria uma ação de growth pendente de aprovação do founder',
    input_schema: { /* type, payload, rationale */ }
  }
]
```

### 3.4 `normalization.service.ts` → adicionar campo `acquisition_channel` normalizado

Atualmente o Hotmart sync grava `acquisition_channel: 'Hotmart'` mas o enum do banco espera `'desconhecido'` para plataformas sem atribuição UTM. Padronizar:

```typescript
// hotmart-sync.job.ts linha ~85
acquisition_channel: 'desconhecido'  // Hotmart é a plataforma, não o canal de aquisição
```

O canal real só é determinado pelo Pixel + UTMs. Sem Pixel, fica `desconhecido`.

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
- **Raise**: métricas auditadas para apresentar ao investidor
- **Card**: histórico financeiro para underwriting
- **Valuation**: benchmark anônimo de profiles similares

O `ai.service.ts` deve receber um `product_context` como parâmetro e montar o system prompt adequado.

### Lock-in por histórico

O moat do produto é o histórico acumulado. Cada mês de dados torna as correlações mais precisas. Implicações técnicas:
- Nunca deletar dados normalizados, apenas marcar como `status: 'cancelled'` ou `'refunded'`
- O Capital Score e o Valuation dependem de séries temporais — a precisão aumenta com o tempo
- O benchmark do Valuation só funciona quando há múltiplos profiles com dados suficientes (Fase 3)

---

## 5. Roadmap Técnico por Fase

### Fase 1 — Growth + Raise (zero dependência de capital ou regulação)

**Objetivo:** validar que founders pagam por inteligência contextual e execução baseada em dados.

| O que construir | Arquivo/Serviço | Prioridade |
|---|---|---|
| `growth_actions` table + RLS | migration | P0 |
| `growth-engine.service.ts` com correlações 1 e 2 | novo serviço | P0 |
| `growth-engine.job.ts` (roda 24h) | novo job | P0 |
| `growth-executor.service.ts` (campaign_pause) | novo serviço | P0 |
| Rotas `/api/growth/*` | novo router | P0 |
| Atualizar `ai.service.ts` com Sonnet 4 + function calling | editar existente | P0 |
| `raise_access_links` + `raise_access_log` tables | migration | P1 |
| Rotas `/api/raise/*` | novo router | P1 |
| Exportação PDF do data room | novo serviço | P1 |
| `capital_scores` + `card_waitlist` tables | migration | P1 |
| `capital-score.job.ts` | novo job | P1 |
| Rotas `/api/card/score` e `/api/card/waitlist` | novo router | P1 |
| Correlações 3 e 4 no growth engine | editar serviço | P2 |
| `growth-executor.service.ts` (audience_sync) | editar serviço | P2 |
| `report_configs` + `reports.job.ts` | novo job | P2 |
| Fix normalização `acquisition_channel` Hotmart | editar existente | P2 |

### Fase 2 — Northie Card (requer parceiro financeiro regulado)

Dependências técnicas que precisam estar prontas:
- Capital Score calculado e histórico de pelo menos 3 meses por profile elegível
- Lista de espera qualificada com score mínimo definido
- Integração com QI Tech ou Celcoin para desembolso (novo domínio, fora do escopo atual)
- Split de pagamento configurado nas integrações Hotmart/Stripe

### Fase 3 — Northie Valuation

Dependências:
- Dados acumulados de N profiles suficientes para benchmark anônimo (volume mínimo a definir)
- `valuation_snapshots` table
- `valuation-calc.job.ts` com lógica de múltiplo por modelo de negócio

---

## 6. Schema Completo das Tabelas Novas

```sql
-- ── FASE 1: GROWTH ────────────────────────────────────────────────────────────

CREATE TABLE growth_actions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id      UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    type            TEXT NOT NULL CHECK (type IN ('reactivation', 'campaign_pause', 'audience_sync', 'budget_reallocation', 'upsell')),
    status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'executed', 'failed')),
    title           TEXT NOT NULL,
    rationale       TEXT NOT NULL,
    data_sources    TEXT[] NOT NULL,
    payload         JSONB NOT NULL,
    impact_estimate JSONB,
    approved_at     TIMESTAMP WITH TIME ZONE,
    executed_at     TIMESTAMP WITH TIME ZONE,
    error_message   TEXT,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

CREATE INDEX idx_growth_actions_profile_status ON growth_actions(profile_id, status, created_at DESC);

ALTER TABLE growth_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "growth_actions: owner only" ON growth_actions FOR ALL USING (profile_id = auth.uid());

-- ── FASE 1: RAISE ─────────────────────────────────────────────────────────────

CREATE TABLE raise_access_links (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id      UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    investor_name   TEXT NOT NULL,
    investor_email  TEXT,
    token           TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
    permissions     JSONB NOT NULL DEFAULT '{"mrr": true, "ltv": true, "cac": true, "cohort": true, "churn": true, "northie_score": true}',
    expires_at      TIMESTAMP WITH TIME ZONE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

CREATE INDEX idx_raise_access_links_token ON raise_access_links(token);
CREATE INDEX idx_raise_access_links_profile ON raise_access_links(profile_id);

ALTER TABLE raise_access_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "raise_access_links: owner only" ON raise_access_links FOR ALL USING (profile_id = auth.uid());

CREATE TABLE raise_access_log (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    link_id          UUID REFERENCES raise_access_links(id) ON DELETE CASCADE NOT NULL,
    profile_id       UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    accessed_at      TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    duration_seconds INTEGER,
    sections_viewed  TEXT[],
    ip               TEXT,
    user_agent       TEXT
);

CREATE INDEX idx_raise_access_log_link ON raise_access_log(link_id, accessed_at DESC);

ALTER TABLE raise_access_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "raise_access_log: owner only" ON raise_access_log FOR ALL USING (profile_id = auth.uid());

-- ── FASE 1: CAPITAL SCORE ─────────────────────────────────────────────────────

CREATE TABLE capital_scores (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id      UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
    score           INTEGER NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 1000),
    eligible_limit  DECIMAL(12, 2) DEFAULT 0,
    eligible        BOOLEAN DEFAULT false,
    breakdown       JSONB NOT NULL DEFAULT '{}',
    calculated_at   TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

ALTER TABLE capital_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "capital_scores: owner only" ON capital_scores FOR ALL USING (profile_id = auth.uid());

CREATE TABLE card_waitlist (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id      UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
    joined_at       TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    score_at_join   INTEGER NOT NULL,
    notified        BOOLEAN DEFAULT false
);

ALTER TABLE card_waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "card_waitlist: owner only" ON card_waitlist FOR ALL USING (profile_id = auth.uid());

-- ── FEATURE TRANSVERSAL: RELATÓRIOS ──────────────────────────────────────────

CREATE TABLE report_configs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id      UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    name            TEXT NOT NULL,
    frequency       TEXT NOT NULL CHECK (frequency IN ('weekly', 'monthly', 'quarterly')),
    sections        TEXT[] NOT NULL,
    format          TEXT NOT NULL DEFAULT 'pdf' CHECK (format IN ('pdf', 'csv')),
    delivery        TEXT NOT NULL DEFAULT 'email' CHECK (delivery IN ('email', 'whatsapp')),
    active          BOOLEAN DEFAULT true,
    next_run_at     TIMESTAMP WITH TIME ZONE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

ALTER TABLE report_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "report_configs: owner only" ON report_configs FOR ALL USING (profile_id = auth.uid());

CREATE TABLE report_history (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id       UUID REFERENCES report_configs(id) ON DELETE CASCADE NOT NULL,
    profile_id      UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    generated_at    TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    file_url        TEXT,
    status          TEXT DEFAULT 'success' CHECK (status IN ('success', 'error')),
    error_message   TEXT
);

ALTER TABLE report_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "report_history: owner only" ON report_history FOR ALL USING (profile_id = auth.uid());

-- ── FASE 3: VALUATION ─────────────────────────────────────────────────────────

CREATE TABLE valuation_snapshots (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id      UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    valuation_brl   DECIMAL(16, 2) NOT NULL,
    methodology     TEXT NOT NULL CHECK (methodology IN ('arr_multiple', 'ltv_cac', 'revenue_multiple')),
    multiple_used   DECIMAL(6, 2),
    arr             DECIMAL(14, 2),
    benchmark_data  JSONB,
    calculated_at   TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

CREATE INDEX idx_valuation_profile ON valuation_snapshots(profile_id, calculated_at DESC);

ALTER TABLE valuation_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "valuation_snapshots: owner only" ON valuation_snapshots FOR ALL USING (profile_id = auth.uid());
```

---

## 7. Estrutura de Arquivos Alvo

```
server/src/
├── controllers/
│   ├── ai.controller.ts          ✅ existe — manter
│   ├── campaign.controller.ts    ✅ existe — manter
│   ├── customers.controller.ts   ✅ existe — manter
│   ├── dashboard.controller.ts   ✅ existe — manter
│   ├── growth.controller.ts      🔴 criar
│   ├── raise.controller.ts       🔴 criar
│   ├── card.controller.ts        🔴 criar
│   ├── integration.controller.ts ✅ existe — manter
│   ├── pixel.controller.ts       ✅ existe — manter
│   ├── transactions.controller.ts ✅ existe — manter
│   └── webhook.controller.ts     ✅ existe — manter
├── jobs/
│   ├── ads-sync.job.ts           ✅ existe — manter
│   ├── alerts.job.ts             ⚠️  existe — adicionar correlações de growth
│   ├── capital-score.job.ts      🔴 criar
│   ├── growth-engine.job.ts      🔴 criar
│   ├── hotmart-sync.job.ts       ⚠️  existe — fix acquisition_channel
│   ├── reports.job.ts            🔴 criar
│   ├── rfm-calc.job.ts           ⚠️  existe — adicionar audience sync
│   └── token-refresh.job.ts      ✅ existe — manter
├── routes/
│   ├── ai.routes.ts              ✅ existe — manter
│   ├── campaign.routes.ts        ✅ existe — manter
│   ├── card.routes.ts            🔴 criar
│   ├── cron.routes.ts            ✅ existe — manter
│   ├── dashboard.routes.ts       ✅ existe — manter
│   ├── data.routes.ts            ✅ existe — manter
│   ├── growth.routes.ts          🔴 criar
│   ├── integration.routes.ts     ✅ existe — manter
│   ├── pixel.routes.ts           ✅ existe — manter
│   ├── raise.routes.ts           🔴 criar
│   └── webhook.routes.ts         ✅ existe — manter
├── services/
│   ├── ai.service.ts             ⚠️  existe — Sonnet 4 + function calling
│   ├── capital-score.service.ts  🔴 criar
│   ├── growth-engine.service.ts  🔴 criar
│   ├── growth-executor.service.ts 🔴 criar
│   ├── integration.service.ts    ✅ existe — manter
│   ├── normalization.service.ts  ⚠️  existe — fix acquisition_channel
│   └── raise.service.ts          🔴 criar
├── lib/
│   ├── supabase.ts               ✅ existe — manter
│   ├── webhook-queue.ts          ✅ existe — manter
│   └── webhook-schemas.ts        ✅ existe — manter
└── index.ts                      ⚠️  existe — registrar novos routers
```

Legenda: ✅ manter como está | ⚠️ modificar | 🔴 criar do zero
