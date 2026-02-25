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
- O backend atua como um **Orquestrador**, filtrando os dados normalizados e entregando contexto limpo para o **Claude Sonnet 4** (queries padrão) e **Claude Opus 4** (análises profundas e forecasting).
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
- **`profiles`**: Dados do founder, configurações do workspace, chaves de segurança e o campo `business_type` (`saas`, `ecommerce`, `infoprodutor_perpetuo`, `infoprodutor_lancamento`).
- **`integrations`**: Armazena tokens OAuth (encriptados), status da conexão e metadados de cada plataforma (Meta, Google, Hotmart, etc).
- **`platforms_data_raw`**: Buffer para armazenar os JSONs brutos recebidos via Webhook/Polling antes da normalização (segurança contra perda de dados).

### Business Intelligence (Normalized)
- **`transactions`**: O coração financeiro. Campos: `id`, `user_id`, `customer_id`, `platform`, `amount_gross`, `amount_net`, `fee_platform`, `status`, `created_at`, `northie_attribution_id`, `campaign_id`.
- **`ad_metrics`**: Performance de tráfego. Campos: `id`, `campaign_id`, `platform`, `spend_brl`, `spend_original`, `impressions`, `clicks`, `date`.
- **`customers`**: Base única consolidada por e-mail/documento. Campos: `id`, `email`, `total_ltv`, `acquisition_channel` (`meta_ads`, `google_ads`, `organico`, `email`, `direto`, `afiliado`, `desconhecido`), `acquisition_campaign_id`, `rfm_score`, `churn_probability`, `last_purchase_at`.

### Northie Campaigns & Tracking
- **`campaigns`**: Metadados de campanhas de criadores/canais. Campos: `id`, `name`, `type` (affiliate, internal), `status`, `commission_rate`.
- **`affiliate_links`**: Links únicos por criador. Campos: `id`, `campaign_id`, `creator_id`, `slug`, `target_url`.
- **`affiliate_clicks`**: Log de cliques. Campos: `id`, `link_id`, `visitor_id`, `ip`, `user_agent`, `created_at`.

### Attribution & IA
- **`visits`**: Log de acessos capturados pelo Northie Pixel (UTMs, Click IDs, `affiliate_id`).
- **`ai_chat_history`**: Histórico de mensagens do "Ask Northie".
- **`embeddings`**: (Utilizando `pgvector`) Vetores das conversas e insights para busca semântica e memória de longo prazo da IA.

---

## 6. Northie Campaigns & Fluxo de Atribuição

O sistema de atribuição para criadores garante que o ROI seja calculado com base no valor real gerado, não apenas cliques.

1.  **Geração do Link:** O criador gera um link via Northie App que contém um `affiliate_id` único.
2.  **Captura (Pixel):** Quando o visitante clica, o **Northie Pixel** no destino identifica o parâmetro, registra um `affiliate_click` e armazena o `affiliate_id` no localStorage/Cookie do navegador, associado ao `visitor_id`.
3.  **Pass-through de Checkout:** No momento da compra, o Pixel injeta o `visitor_id` ou `affiliate_id` nos metadados do gateway (ex: campo `src` na Hotmart ou `metadata` no Stripe).
4.  **Reconciliação:** Ao receber o Webhook de venda, o backend busca se há um `affiliate_id` vinculado àquele `visitor_id`. Se sim, a transação é marcada com o `campaign_id` correspondente.

---

## 7. Audience Sync & Processamento em Fila

Sincronização automática de segmentos para Meta Audiences sem intervenções manuais.

-   **Pipeline Técnico:**
    1.  **Segmentação:** O backend isola a lista de IDs/Emails baseada em filtros (ex: "Champions").
    2.  **Preparação:** Os dados (Email, Telefone) são normalizados e convertidos para **SHA-256** localmente no backend (requisito de privacidade do Meta).
    3.  **Job Enqueue:** O payload é enviado para uma fila (Redis/BullMQ).
    4.  **Upload:** Workers processam a fila, realizando chamadas segmentadas (`batch`) para a API do Meta Audiences, tratando erros de rede e evitando timeout.

---

## 8. Estratégia de Rate Limiting e Resiliência

Para evitar bloqueios e perda de dados em APIs externas com limites distintos.

| Plataforma | Estratégia de Rate Limit |
| :--- | :--- |
| **Meta/Google Ads** | Janela deslizante (Sliding Window). Consultas de volume são persistidas em cache e os workers respeitam o multiplicador de custo por token da API. |
| **Hotmart/Kiwify** | **Webhook-First**. Fila de prioridade máxima. Se o webhook falhar, o backend aguarda e reprocessa. O polling de segurança roda apenas off-peak. |
| **Geral** | Implementação de **Exponential Backoff** em todas as filas de integração. |

### Job de Reconciliação & Integridade (The Safety Net)
Para mitigar o risco de falhas em webhooks de terceiros (Hotmart, Kiwify, Stripe), o backend executa um ciclo de verificação redundante:
1.  **Auditoria Diária:** Um Cron Job roda em horários de baixo tráfego comparando o `count()` e a `sum(amount_net)` das transações no dashboard da plataforma (via API de relatórios) com os dados locais na tabela `transactions`.
2.  **Detecção de Gap:** Se houver discrepância (ex: $1.000,00 na Hotmart vs $950,00 no Northie), o sistema identifica os IDs de transação ausentes.
3.  **Backfill Automático:** O Northie dispara uma requisição de detalhamento para a API da plataforma para cada ID ausente e insere os dados normalizados, garantindo a integridade do LTV.
4.  **Alerta de Drift:** Caso o formato do payload da API mude e o backfill falhe, um alerta de prioridade máxima é disparado para o time técnico (Vigilante Proativo).

---

## 9. Lógica de Cálculo de Métricas

| Métrica | Fórmula / Lógica | Tabelas/Campos | Frequência |
| :--- | :--- | :--- | :--- |
| **LTV** | $\sum \text{amount\_net}$ de transações aprovadas por cliente. | `transactions.amount_net` | Tempo real (Webhook) |
| **CAC** | $\frac{\sum \text{spend\_brl}}{\text{Novos Clientes Adquiridos}}$ no período e canal. | `ad_metrics.spend_brl`, `customers` | Diário |
| **Margem de Contr.** | $\text{LTV} - \text{CAC} - \text{Taxas de Plataforma}$. | `transactions.amount_net`, `integrations.config` | Tempo real |
| **Status Lucrativo** | `Lucrativo` se $\text{LTV} > (\text{CAC} + \text{Taxas})$; Senão `Payback`. | `customers`, `transactions` | Pós-compra |
| **RFM Score** | Pontuação 1-5 para Recência (dias desde última compra), Frequência (contagem) e Valor (Total LTV). | `customers`, `transactions` | Diário (Madrugada) |
| **Churn Prob.** | Modelos por `business_type`:<br>1. **SaaS**: Baseado no status da assinatura e engajamento.<br>2. **E-com/Perpétuo**: 1.5x o intervalo médio de compra do segmento.<br>3. **Lançamento**: Desativado por padrão (manual com janela custom). | `profiles.business_type`, `customers.last_purchase_at` | Semanal |
| **ROAS** | $\frac{\text{Receita Atribuída ao Canal}}{\text{Gasto do Canal}}$. | `transactions`, `ad_metrics` | Diário |
| **CAC Social** | $\frac{\text{Custo da Comunidade}}{\text{Novas Vendas via Community Flow}}$. | `profiles.community_cost`, `transactions` | Mensal |
| **ROI Criador** | $\frac{\text{Receita Campanha (Incl. Upsell)}}{\text{Comissões Pagas}}$. | `transactions`, `campaigns` | Semanal |
| **Forecast** | $\text{Base Atual} \times \text{Average Order Value} \times \text{Rebuy Rate}$ histórica filtrada por cohort. Nota: Pré-calculado para resposta imediata; variações com parâmetros customizados (ex: +30% budget) em tempo real. | `transactions`, `customers` | Diário (Madrugada) + On-demand |

---

## 10. Filosofia de Produto no Backend

O backend não é apenas um repositório; é um motor proativo que deve antecipar a necessidade do founder e fornecer dados acionáveis via IA.
