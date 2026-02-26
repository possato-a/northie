-- Add columns to campaigns
ALTER TABLE campaigns ADD COLUMN description TEXT;
ALTER TABLE campaigns ADD COLUMN product_name TEXT;
ALTER TABLE campaigns ADD COLUMN start_date DATE;
ALTER TABLE campaigns ADD COLUMN end_date DATE;

-- Creators management
CREATE TABLE creators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    instagram TEXT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Linking creators to campaigns
CREATE TABLE campaign_creators (
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE NOT NULL,
    creator_id UUID REFERENCES creators(id) ON DELETE CASCADE NOT NULL,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (campaign_id, creator_id)
);

-- Commissions/Payouts tracking
CREATE TABLE commissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE NOT NULL,
    creator_id UUID REFERENCES creators(id) ON DELETE CASCADE NOT NULL,
    transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
    amount DECIMAL(12, 2) NOT NULL,
    status TEXT DEFAULT 'pending', -- 'pending', 'paid', 'cancelled'
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
