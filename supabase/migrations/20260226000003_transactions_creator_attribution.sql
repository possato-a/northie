-- Adiciona campos de atribuição de criadores/campanhas em transactions
-- NOTA: creators e campaign_creators são criadas aqui se ainda não existirem,
-- para garantir ordem de dependência.

CREATE TABLE IF NOT EXISTS creators (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    name       TEXT NOT NULL,
    email      TEXT,
    phone      TEXT,
    instagram  TEXT,
    status     TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS campaign_creators (
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE NOT NULL,
    creator_id  UUID REFERENCES creators(id)  ON DELETE CASCADE NOT NULL,
    status      TEXT DEFAULT 'active',
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (campaign_id, creator_id)
);

CREATE TABLE IF NOT EXISTS commissions (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id     UUID REFERENCES profiles(id)     ON DELETE CASCADE NOT NULL,
    campaign_id    UUID REFERENCES campaigns(id)    ON DELETE CASCADE NOT NULL,
    creator_id     UUID REFERENCES creators(id)     ON DELETE CASCADE NOT NULL,
    transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
    amount         DECIMAL(12, 2) NOT NULL,
    status         TEXT DEFAULT 'pending',
    paid_at        TIMESTAMP WITH TIME ZONE,
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Adiciona colunas de atribuição em transactions
ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS creator_id  UUID REFERENCES creators(id)  ON DELETE SET NULL;

-- Índices
CREATE INDEX IF NOT EXISTS idx_transactions_campaign_id ON transactions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_transactions_creator_id  ON transactions(creator_id);

-- Trigger para resolver atribuição automaticamente via utm_campaign
CREATE OR REPLACE FUNCTION resolve_creator_attribution()
RETURNS TRIGGER AS $$
DECLARE
    v_utm_campaign TEXT;
    v_campaign_id  UUID;
    v_creator_id   UUID;
BEGIN
    IF NEW.campaign_id IS NOT NULL OR NEW.northie_attribution_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT utm_campaign INTO v_utm_campaign
    FROM visits
    WHERE visitor_id = NEW.northie_attribution_id
      AND profile_id = NEW.profile_id
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_utm_campaign IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT id INTO v_campaign_id
    FROM campaigns
    WHERE profile_id = NEW.profile_id
      AND LOWER(name) = LOWER(v_utm_campaign)
    LIMIT 1;

    IF v_campaign_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT creator_id INTO v_creator_id
    FROM campaign_creators
    WHERE campaign_id = v_campaign_id
      AND status = 'active'
    LIMIT 1;

    NEW.campaign_id := v_campaign_id;
    NEW.creator_id  := v_creator_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_resolve_creator_attribution ON transactions;
CREATE TRIGGER trg_resolve_creator_attribution
    BEFORE INSERT ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION resolve_creator_attribution();
