-- Migration: adiciona coluna phone à tabela customers
-- Necessário para sincronizar telefone dos clientes Shopify (e outras plataformas)

ALTER TABLE customers ADD COLUMN IF NOT EXISTS phone TEXT;
