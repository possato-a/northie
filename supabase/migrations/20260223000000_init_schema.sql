-- Northie: Initial Database Schema
-- Last Updated: 2026-02-23

-- 1. EXTENSIONS
-- Se o erro "extension pgvector is not available" persistir, habilite "VECTOR" no painel do Supabase (Database -> Extensions)
-- CREATE EXTENSION IF NOT EXISTS pgvector;

-- 2. ENUMS
CREATE TYPE business_type AS ENUM ('saas', 'ecommerce', 'infoprodutor_perpetuo', 'infoprodutor_lancamento');
CREATE TYPE acquisition_channel AS ENUM ('meta_ads', 'google_ads', 'organico', 'email', 'direto', 'afiliado', 'desconhecido');
CREATE TYPE campaign_type AS ENUM ('affiliate', 'internal');
CREATE TYPE transaction_status AS ENUM ('pending', 'approved', 'refunded', 'cancelled');

-- 3. CORE TABLES

-- profiles: Data about the founder/workspace
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    business_type business_type DEFAULT 'infoprodutor_perpetuo',
    workspace_config JSONB DEFAULT '{}'::jsonb,
    community_cost DECIMAL(12, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- integrations: OAuth and API keys
CREATE TABLE integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    platform TEXT NOT NULL, -- 'meta', 'google', 'hotmart', 'stripe', 'kiwify'
    config_encrypted JSONB NOT NULL, -- Encrypted tokens/keys
    status TEXT DEFAULT 'active',
    last_sync_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(profile_id, platform)
);

-- platforms_data_raw: Buffer for webhooks/polling
CREATE TABLE platforms_data_raw (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    platform TEXT NOT NULL,
    payload JSONB NOT NULL,
    processed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. BUSINESS LOGIC TABLES

-- customers: Unified customer base
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    email TEXT NOT NULL,
    total_ltv DECIMAL(12, 2) DEFAULT 0.00,
    acquisition_channel acquisition_channel DEFAULT 'desconhecido',
    acquisition_campaign_id UUID, -- References campaigns.id (added later)
    rfm_score JSONB DEFAULT '{"r": 0, "f": 0, "m": 0}'::jsonb,
    churn_probability DECIMAL(5, 4) DEFAULT 0.00,
    last_purchase_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(profile_id, email)
);

-- campaigns: Creator or Internal campaigns
CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    type campaign_type DEFAULT 'internal',
    status TEXT DEFAULT 'active',
    commission_rate DECIMAL(5, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add foreign key to customers now that campaigns table exists
ALTER TABLE customers ADD CONSTRAINT fk_acquisition_campaign FOREIGN KEY (acquisition_campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL;

-- transactions: The financial core
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    platform TEXT NOT NULL,
    external_id TEXT, -- Transaction ID from platform
    amount_gross DECIMAL(12, 2) NOT NULL,
    amount_net DECIMAL(12, 2) NOT NULL,
    fee_platform DECIMAL(12, 2) DEFAULT 0.00,
    status transaction_status DEFAULT 'pending',
    northie_attribution_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ad_metrics: Traffic performance
CREATE TABLE ad_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    platform TEXT NOT NULL,
    spend_brl DECIMAL(12, 2) NOT NULL,
    spend_original DECIMAL(12, 2) NOT NULL,
    currency TEXT DEFAULT 'BRL',
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. ATTRIBUTION & GROWTH

-- affiliate_links: Links per creator
CREATE TABLE affiliate_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE NOT NULL,
    creator_id TEXT NOT NULL, -- External or profile ID
    slug TEXT UNIQUE NOT NULL,
    target_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- affiliate_clicks: Click log
CREATE TABLE affiliate_clicks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    link_id UUID REFERENCES affiliate_links(id) ON DELETE CASCADE NOT NULL,
    visitor_id UUID NOT NULL,
    ip TEXT,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- visits: Pixel tracking
CREATE TABLE visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    visitor_id UUID NOT NULL,
    url TEXT,
    referrer TEXT,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    affiliate_id UUID REFERENCES affiliate_links(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. AI & CHAT (Comentado temporariamente para evitar erro de pgvector)
/*
CREATE TABLE ai_chat_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    role TEXT CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    embedding VECTOR(1536), 
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX idx_embeddings_vector ON embeddings USING ivfflat (embedding vector_cosine_ops);
*/

-- 7. INDEXES FOR PERFORMANCE
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_transactions_customer ON transactions(customer_id);
CREATE INDEX idx_transactions_profile ON transactions(profile_id);
CREATE INDEX idx_visits_visitor ON visits(visitor_id);
CREATE INDEX idx_visits_profile ON visits(profile_id);
-- Index for pgvector (Comentado até habilitar a extensão)
-- CREATE INDEX idx_embeddings_vector ON embeddings USING ivfflat (embedding vector_cosine_ops);
