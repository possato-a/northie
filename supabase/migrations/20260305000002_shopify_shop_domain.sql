-- Migration: adiciona coluna shopify_shop_domain na tabela integrations
-- Necessária para armazenar o domínio da loja Shopify e fazer chamadas à API por shop.

ALTER TABLE integrations
  ADD COLUMN IF NOT EXISTS shopify_shop_domain TEXT;
