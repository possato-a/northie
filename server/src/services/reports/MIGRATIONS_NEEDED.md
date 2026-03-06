# Migrations necessarias para o relatorio PDF completo

Documentacao para o Possato revisar e executar. NAO executar sem revisao.

---

## SECAO 5 — Engajamento e Operacao

### WhatsApp Business (nova tabela)
Necessario para custo de CS, volume de atendimento e correlacao com churn.

```sql
CREATE TABLE whatsapp_metrics (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    date          date NOT NULL,
    conversations_total     int DEFAULT 0,
    conversations_outbound  int DEFAULT 0,  -- negocio iniciou
    conversations_inbound   int DEFAULT 0,  -- cliente iniciou
    avg_response_time_min   numeric(8,2),   -- tempo medio de resposta em minutos
    created_at    timestamptz DEFAULT now(),
    UNIQUE (profile_id, date)
);
ALTER TABLE whatsapp_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_only" ON whatsapp_metrics USING (profile_id = auth.uid());
```

### Google Calendar / Meet (nova tabela)
Necessario para calcular custo oculto de CS via reunioes com clientes.

```sql
CREATE TABLE calendar_events (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    event_id      text NOT NULL,           -- Google Calendar event ID
    title         text,
    start_at      timestamptz NOT NULL,
    end_at        timestamptz NOT NULL,
    duration_min  int GENERATED ALWAYS AS (EXTRACT(EPOCH FROM (end_at - start_at)) / 60) STORED,
    is_client_meeting boolean DEFAULT false,
    attendees_count   int DEFAULT 1,
    source        text DEFAULT 'google_calendar',
    created_at    timestamptz DEFAULT now(),
    UNIQUE (profile_id, event_id)
);
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_only" ON calendar_events USING (profile_id = auth.uid());
```

### Email metrics do Resend (nova tabela)
Necessario para correlacionar engajamento de email com churn.

```sql
CREATE TABLE email_metrics (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    email_id      text NOT NULL UNIQUE,    -- Resend email ID
    sent_at       timestamptz NOT NULL,
    subject       text,
    opens         int DEFAULT 0,
    clicks        int DEFAULT 0,
    bounced       boolean DEFAULT false,
    unsubscribed  boolean DEFAULT false,
    audience_size int DEFAULT 0,
    created_at    timestamptz DEFAULT now()
);
ALTER TABLE email_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_only" ON email_metrics USING (profile_id = auth.uid());
```

---

## SECAO 4 — Retencao e Churn

### Churn events (nova tabela)
Necessario para calcular taxa real de churn mensal (hoje so temos churn_probability estimado).

```sql
CREATE TABLE churn_events (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    customer_id   uuid REFERENCES customers(id) ON DELETE SET NULL,
    churned_at    date NOT NULL,
    reason        text,                    -- cancelamento, reembolso, inatividade
    ltv_at_churn  numeric(12,2) DEFAULT 0,
    source        text,                    -- stripe_cancel, hotmart_refund, inferred
    created_at    timestamptz DEFAULT now()
);
ALTER TABLE churn_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_only" ON churn_events USING (profile_id = auth.uid());
```

---

## SECAO 7 — Fundraising / NRR

### MRR snapshots (nova tabela)
Necessario para calcular NRR real e MRR growth historico. Atualmente MRR e extrapolado da receita do periodo.

```sql
CREATE TABLE mrr_snapshots (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    snapshot_date date NOT NULL,
    mrr           numeric(12,2) NOT NULL,
    new_mrr       numeric(12,2) DEFAULT 0,   -- receita de novos clientes
    expansion_mrr numeric(12,2) DEFAULT 0,   -- upsell / cross-sell
    churned_mrr   numeric(12,2) DEFAULT 0,   -- receita perdida por cancelamentos
    contraction_mrr numeric(12,2) DEFAULT 0, -- downgrade
    source        text DEFAULT 'stripe',
    created_at    timestamptz DEFAULT now(),
    UNIQUE (profile_id, snapshot_date)
);
ALTER TABLE mrr_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_only" ON mrr_snapshots USING (profile_id = auth.uid());
```

---

## Campo adicional em `profiles` (ALTER TABLE)

Para melhorar a identificacao do modelo de negocio automaticamente:

```sql
ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS hourly_rate_brl numeric(10,2) DEFAULT NULL;
-- Usado para calcular custo real de CS (horas em reunioes * valor hora do founder)
```

---

## Notas de implementacao

- Todas as tabelas acima precisam de RLS policies revisadas pelo Possato
- Os webhooks/jobs para popular `whatsapp_metrics` e `email_metrics` precisam ser criados no backend (`server/src/services/integrations/`)
- O job noturno de RFM (`metrics-calculator.ts`) ja existe — apenas precisa de dados para funcionar
- `calendar_events` requer OAuth com escopo `https://www.googleapis.com/auth/calendar.readonly`
