-- Adiciona novos canais ao enum acquisition_channel para suportar
-- clientes vindos de Shopify e Stripe (novas integracoes)
ALTER TYPE acquisition_channel ADD VALUE IF NOT EXISTS 'shopify';
ALTER TYPE acquisition_channel ADD VALUE IF NOT EXISTS 'stripe';
