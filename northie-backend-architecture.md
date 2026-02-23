# Northie: Backend Architecture & Master Strategy

Este documento consolida todas as definições técnicas e decisões de arquitetura para o ecossistema de inteligência do Northie, conforme discutido.

---

## 1. Core Architecture: O Motor de Dados

O backend do Northie foi projetado para ser o "Juiz da Verdade" do founder, centralizando dados fragmentados em um esquema único e normalizado.

### Ingestão Híbrida
- **OAuth-First (One-Click Setup):** Fluxo simplificado para Meta Ads, Google Ads e Stripe. O backend gerencia o ciclo de vida dos tokens (Exchange & Auto-refresh) de forma silenciosa.
- **Webhooks de Tempo Real:** Endpoints dedicados para Gateways (Hotmart, Kiwify) para capturar vendas, reembolsos e assinaturas no segundo em que acontecem.
- **Cron Jobs (Polling):** Sincronização periódica para métricas de Ads e backfill de dados históricos.

### Camada de Normalização (The Northie Schema)
Todos os dados brutos são traduzidos para objetos padronizados (Vendas, Clientes, Ads), garantindo que a IA lide sempre com a mesma estrutura de dados, independente da fonte original.

---

## 2. Confiabilidade e Atribuição (The Source of Truth)

Para garantir que o Northie seja mais confiável que os painéis das próprias plataformas:

### Rastreabilidade de Ponta a Ponta
1. **Northie Pixel:** Script leve que gera um ID único de visitante e captura UTMs/GCLID/FBCLID.
2. **Metadata Pass-through:** O Pixel injeta automaticamente o ID da visita nos campos de "metadata" ou "src" do checkout.
3. **Reconciliação:** O backend cruza o Webhook de pagamento com o ID de visita original para atribuir a venda à campanha real.

### Dados Retroativos vs. Atuais
- **Certeza Financeira:** Puxamos 100% do histórico financeiro via API. O LTV da base de clientes é sempre real desde o início.
- **Certeza de Origem:** Atribuição determinística começa a partir da instalação do Pixel. O passado utiliza atribuição estimada via API das plataformas.

---

## 3. Camada de Inteligência (Claude Integration)

A IA atua como uma camada de execução estratégica integrada aos dados.

### Ask Northie (Contextual Reading)
- O backend atua como um **Orquestrador**, filtrando os dados normalizados e entregando contexto limpo para o **Claude 3.5 Sonnet**.
- **Vector Database:** Memória de longo prazo para as discussões e objetivos estratégicos do founder.

### Autonomia de Execução (Function Calling)
- O Claude possui "ferramentas" técnicas (ex: `pausar_campanha`, `ajustar_budget`).
- **Flow:** IA decide -> Backend valida tokens -> Chamada via API do Meta -> Registro de log e notificação.

---

## 4. Robustez e Infraestrutura Invisível

- **Escudo de API:** Fila de processamento (Broker) para respeitar Rate Limits e garantir 100% de recebimento de webhooks.
- **Conversão de Moeda:** Motor de câmbio para converter gastos em USD (Ads) para faturamento em BRL.
- **Vigilante Proativo:** Notificações via WhatsApp/Push para anomalias ou erros de integração.
- **Segurança & LGPD:** Criptografia de dados sensíveis (PII) e anonimização de payloads para a IA.

---

## 5. Estrutura de Dados (Supabase / PostgreSQL)

Para suportar a inteligência e a escala do Northie, utilizaremos o PostgreSQL com a extensão `pgvector`. Abaixo, as tabelas core:

### Core Tables
- **`profiles`**: Dados do founder, configurações do workspace e chaves de segurança.
- **`integrations`**: Armazena tokens OAuth (encriptados), status da conexão e metadados de cada plataforma (Meta, Google, Hotmart, etc).
- **`platforms_data_raw`**: Buffer para armazenar os JSONs brutos recebidos via Webhook/Polling antes da normalização (segurança contra perda de dados).

### Business Intelligence (Normalized)
- **`transactions`**: O coração financeiro. Campos: `id`, `user_id`, `customer_id`, `platform`, `amount_gross`, `amount_net`, `status`, `created_at`, `northie_attribution_id`.
- **`ad_metrics`**: Performance de tráfego. Campos: `id`, `campaign_id`, `platform`, `spend_brl`, `spend_original`, `impressions`, `clicks`, `date`.
- **`customers`**: Base única consolidada por e-mail/documento. Campos: `id`, `email`, `total_ltv`, `first_origin_id`, `rfm_score`.

### Attribution & IA
- **`visits`**: Log de acessos capturados pelo Northie Pixel (UTMs, Click IDs).
- **`ai_chat_history`**: Histórico de mensagens do "Ask Northie".
- **`embeddings`**: (Utilizando `pgvector`) Vetores das conversas e insights para busca semântica e memória de longo prazo da IA.

---

## 6. Filosofia de Produto no Backend
