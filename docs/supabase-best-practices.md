# Supabase Best Practices — Northie

> Documento criado após incidente de crash repetido do banco (2026-03-10).
> Causa raiz: combinação de thundering herd, autovacuum inativo, extensões desnecessárias e padrões N+1.
> **Plano atual: Pro ($25/mês) — Micro Compute (1GB RAM, 2-core ARM).**

---

## 1. Conexoes e Connection Pool

### O que aconteceu
22 conexoes idle do PostgREST + 14 cron jobs abrindo conexoes simultaneamente no boot = pool exaurido, queries enfileiradas, OOM.

### Regras

- **PostgREST idle connections sao normais.** Supabase mantém ~20-25 conexoes idle do PostgREST. Nao tente matar elas.
- **Nunca abrir mais de 2-3 queries simultaneas por request.** Promise.all com 5+ queries e aceitavel se sao leves (SELECT com index). Nunca 10+.
- **Connection string direta so para migrations e scripts one-off.** Aplicacao sempre usa o client Supabase (que passa pelo PostgREST/pooler).
- **Monitorar conexoes ativas:**
  ```sql
  SELECT state, count(*) FROM pg_stat_activity GROUP BY state;
  ```
  Se `active` > 10 sustentado por mais de 30s, algo esta errado.

### Limites do Micro Compute

| Recurso | Limite |
|---------|--------|
| RAM | 1GB |
| CPU | 2-core ARM (burst) |
| Max connections (direct) | ~60 |
| Max connections (pooler/transaction) | ~200 |
| Disk IOPS | Baseline low, burst limited |

---

## 2. Thundering Herd — Staggered Boot

### O que aconteceu
14 cron jobs iniciavam simultaneamente no `app.listen()`. Cada um fazia 3-10 queries. Resultado: 50+ queries concorrentes no primeiro segundo = DB overwhelmed.

### Regras

- **Nunca executar jobs imediatamente no boot.** Sempre usar `setTimeout` com delays escalonados.
- **Delay minimo entre jobs: 30 segundos.** Jobs pesados (sync, correlacoes): 5-15 minutos de delay.
- **Jobs nunca rodam a funcao principal antes do primeiro intervalo.** O `setInterval` ja garante a primeira execucao no tempo certo.

### Padrao correto

```typescript
// BOM — escalonado
app.listen(PORT, () => {
    const delay = (ms: number, fn: () => void) => setTimeout(fn, ms);
    delay(5_000,  () => startTokenRefreshJob());      // leve
    delay(30_000, () => startCorrelationRefreshJob()); // medio
    delay(60_000, () => startChatCleanupJob());        // leve
    delay(4 * 60_000, () => startGrowthJob());         // pesado
    delay(10 * 60_000, () => startAdsSyncJob());       // pesado + API externa
});

// RUIM — thundering herd
app.listen(PORT, () => {
    startTokenRefreshJob();
    startCorrelationRefreshJob();
    startChatCleanupJob();
    startGrowthJob();
    startAdsSyncJob();
});
```

### Padrao correto dentro do job

```typescript
// BOM — so agenda, nao executa
export function startMyJob() {
    setInterval(runMyJob, 60 * 60 * 1000); // roda a cada 1h
}

// RUIM — executa imediatamente + agenda
export function startMyJob() {
    runMyJob(); // <-- isso causa o thundering herd
    setInterval(runMyJob, 60 * 60 * 1000);
}
```

---

## 3. Queries — Eliminar N+1 e SELECT *

### O que aconteceu
`listCampaignCreators` fazia 2 queries por creator dentro de um loop. 10 creators = 20 queries. `handleWebhook` fazia `.select()` (retorna row inteira) quando so precisava do `id`.

### Regras

- **Nunca fazer query dentro de `.map()` ou `for` loop.** Se precisa de dados relacionados, buscar tudo de uma vez e indexar com Map.
- **Nunca usar `.select()` ou `.select('*')`.** Sempre listar colunas explicitas.
- **Queries independentes: usar `Promise.all`.** Queries dependentes: sequenciais.
- **Pre-indexar resultados com `Map<string, T>` para lookups O(1).**

### Padrao correto — eliminar N+1

```typescript
// BOM — 3 queries fixas + Map
const [{ data: items }, { data: allRelated }] = await Promise.all([
    supabase.from('items').select('id, name').eq('profile_id', pid),
    supabase.from('related').select('item_id, value').in('item_id', itemIds),
]);

const relatedMap = new Map<string, number>();
for (const r of (allRelated ?? [])) {
    relatedMap.set(r.item_id, (relatedMap.get(r.item_id) ?? 0) + r.value);
}

const result = (items ?? []).map(item => ({
    ...item,
    total: relatedMap.get(item.id) ?? 0,
}));

// RUIM — N queries
const result = await Promise.all(items.map(async item => {
    const { data } = await supabase.from('related')
        .select('value').eq('item_id', item.id); // 1 query por item!
    return { ...item, total: data?.reduce(...) };
}));
```

### Padrao correto — colunas explicitas

```typescript
// BOM
supabase.from('profiles').select('id, business_type, name')

// RUIM
supabase.from('profiles').select('*')
supabase.from('profiles').select()
```

### Padrao correto — count sem carregar dados

```typescript
// BOM — retorna so o count, zero bytes transferidos
supabase.from('customers')
    .select('id', { count: 'exact', head: true })
    .eq('profile_id', pid)
// Resultado: { count: 42, data: null }

// RUIM — carrega todos os rows so pra contar
const { data } = await supabase.from('customers')
    .select('id').eq('profile_id', pid);
const count = data?.length ?? 0;
```

---

## 4. Autovacuum — Configurar para Tabelas Pequenas

### O que aconteceu
Threshold padrao do autovacuum: `50 + 20% das live rows`. Tabelas com <50 rows nunca atingiam o threshold. Dead tuples acumularam indefinidamente, bloat nas tabelas, planner com stats desatualizados.

### Regras

- **Toda tabela com <100 rows esperadas precisa de threshold customizado.**
- **Threshold recomendado: 2-10 dependendo da frequencia de updates.**
- **Rodar a migration abaixo em toda tabela nova que for criada.**

### SQL padrao

```sql
-- Tabelas de negocio (poucas rows, updates frequentes)
ALTER TABLE my_table SET (
    autovacuum_vacuum_threshold = 5,
    autovacuum_vacuum_scale_factor = 0.1,
    autovacuum_analyze_threshold = 5,
    autovacuum_analyze_scale_factor = 0.05
);

-- Tabelas de log (muitas rows, append-only)
ALTER TABLE my_log_table SET (
    autovacuum_vacuum_threshold = 10,
    autovacuum_vacuum_scale_factor = 0.1
);
```

### Verificar dead tuples

```sql
SELECT relname, n_dead_tup, n_live_tup, last_autovacuum
FROM pg_stat_user_tables
WHERE n_dead_tup > 0
ORDER BY n_dead_tup DESC;
```

Se `n_dead_tup` > `n_live_tup` em qualquer tabela: problema.

---

## 5. Extensoes — So Manter o Necessario

### O que aconteceu
`pg_graphql` estava habilitado mas nunca usado pela aplicacao. Consumia RAM para manter schema introspection cache. Com 1GB de RAM, cada extensao conta.

### Regras

- **Auditar extensoes a cada 3 meses.** Remover qualquer uma que nao esteja em uso ativo.
- **Extensoes essenciais da Northie:** `pgvector`, `pg_cron` (se usar), `uuid-ossp`
- **Nunca habilitar:** `pg_graphql` (usamos REST), `pg_net` (fazemos HTTP no backend), `timescaledb` (overhead massivo)

### Verificar extensoes ativas

```sql
SELECT extname, extversion FROM pg_extension ORDER BY extname;
```

### Remover extensao

```sql
DROP EXTENSION IF EXISTS pg_graphql CASCADE;
```

---

## 6. Realtime — Desabilitar se Nao Usar

### O que aconteceu
Supabase Realtime publica changes via WAL. Se tabelas estao na publication mas ninguem escuta, e overhead puro: WAL cresce, slots acumulam, memoria consumida.

### Regras

- **Nunca adicionar tabelas ao Realtime "por precaucao".** So adicionar quando o frontend realmente escuta changes.
- **REPLICA IDENTITY deve ser DEFAULT (nao FULL).** FULL duplica o tamanho do WAL entry.
- **Verificar publicacao:**
  ```sql
  SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
  ```
  Se alguma tabela aparece e o frontend nao usa Realtime nela: remover.

### Remover tabela do Realtime

```sql
ALTER PUBLICATION supabase_realtime DROP TABLE my_table;
ALTER TABLE my_table REPLICA IDENTITY DEFAULT;
```

---

## 7. Indexes — Criar com Criterio

### Regras

- **Todo FK precisa de index.** Postgres NAO cria index automaticamente em foreign keys. Sem index, JOINs e CASCADE deletes fazem sequential scan.
- **Queries com `.eq('profile_id', x).eq('status', 'active')` precisam de index composto**, nao dois indexes separados.
- **Index parcial quando possivel:**
  ```sql
  CREATE INDEX idx_tx_pending ON transactions(profile_id, created_at)
  WHERE status = 'approved';
  ```
- **Nunca criar index em tabela com <1000 rows.** Sequential scan e mais rapido.
- **Verificar indexes nao utilizados:**
  ```sql
  SELECT indexrelname, idx_scan, pg_size_pretty(pg_relation_size(indexrelid))
  FROM pg_stat_user_indexes
  WHERE idx_scan = 0 AND schemaname = 'public'
  ORDER BY pg_relation_size(indexrelid) DESC;
  ```

### Indexes obrigatorios que faltavam

```sql
-- FK indexes (Postgres nao cria automaticamente!)
CREATE INDEX IF NOT EXISTS idx_transactions_profile_id ON transactions(profile_id);
CREATE INDEX IF NOT EXISTS idx_transactions_customer_id ON customers(id); -- ja e PK, mas verificar
CREATE INDEX IF NOT EXISTS idx_ad_metrics_profile_id ON ad_metrics(profile_id);
CREATE INDEX IF NOT EXISTS idx_customers_profile_id ON customers(profile_id);

-- Queries frequentes
CREATE INDEX IF NOT EXISTS idx_transactions_profile_status ON transactions(profile_id, status);
CREATE INDEX IF NOT EXISTS idx_integrations_profile_platform ON integrations(profile_id, platform);
```

---

## 8. Limpeza de Dados — Retention Policy

### O que aconteceu
`platforms_data_raw` acumulava JSONs brutos indefinidamente. `ai_chat_history` sem expiracao. `sync_logs` crescendo sem limite.

### Regras

- **Toda tabela de log/buffer precisa de retention policy.**
- **Rodar limpeza semanal ou mensal via cron job ou migration periodica.**

### Retention recomendada

| Tabela | Retention | Criterio |
|--------|-----------|----------|
| `platforms_data_raw` | 30 dias (processed) | `processed = true AND created_at < now() - 30d` |
| `ai_chat_history` | 90 dias | `created_at < now() - 90d` |
| `sync_logs` | 60 dias | `created_at < now() - 60d` |
| `alerts` | 90 dias (read) | `read = true AND created_at < now() - 90d` |
| `growth_recommendations` | 180 dias (executed) | `status IN ('executed','dismissed') AND created_at < now() - 180d` |
| `report_logs` | 365 dias | Manter 1 ano para historico |

### SQL de limpeza

```sql
DELETE FROM platforms_data_raw
WHERE processed = true AND created_at < now() - interval '30 days';

DELETE FROM ai_chat_history
WHERE created_at < now() - interval '90 days';

DELETE FROM sync_logs
WHERE created_at < now() - interval '60 days';
```

---

## 9. Memory Safety no Backend

### O que aconteceu
Webhook queue sem limite de tamanho e preview cache sem evicao podiam crescer indefinidamente na memoria do processo Node.

### Regras

- **Toda estrutura in-memory (Map, Array, queue) precisa de limite maximo.**
- **Padrao: MAX_SIZE + evicao do mais antigo quando cheio.**
- **Nunca armazenar payloads grandes em memoria.** Persistir no banco e manter so IDs na fila.

### Padrao correto

```typescript
const MAX_CACHE_SIZE = 50;
const cache = new Map<string, { data: any; ts: number }>();

function set(key: string, data: any) {
    if (cache.size >= MAX_CACHE_SIZE) {
        const oldest = cache.keys().next().value;
        if (oldest) cache.delete(oldest);
    }
    cache.set(key, { data, ts: Date.now() });
}
```

```typescript
const MAX_QUEUE_SIZE = 500;
const queue: Item[] = [];

function enqueue(item: Item) {
    if (queue.length >= MAX_QUEUE_SIZE) {
        console.warn('[Queue] Full, dropping oldest');
        queue.shift();
    }
    queue.push(item);
}
```

---

## 10. Singletons para Clientes Externos

### O que aconteceu
`getAnthropicClient()` criava `new Anthropic()` a cada chamada. Cada instancia aloca buffers internos, event listeners e HTTP agents.

### Regras

- **Clientes de API externa (Anthropic, Stripe, Resend) devem ser singleton.**
- **Padrao: variavel de modulo + lazy init.**

```typescript
let _client: Anthropic | null = null;

function getClient(): Anthropic {
    if (_client) return _client;
    _client = new Anthropic({ apiKey: process.env.API_KEY });
    return _client;
}
```

---

## 11. Cron Jobs — Frequencia e Concorrencia

### Regras

| Tipo de job | Frequencia maxima | Concorrencia |
|------------|-------------------|--------------|
| Token refresh | 45 min | 1 (sequential) |
| Sync de dados (Meta, Hotmart, etc) | 1h | 1 por plataforma, sequential entre plataformas |
| Calculos (RFM, Capital Score) | 1x/dia (madrugada) | 1 |
| Correlacoes/Views | 1h | 1 |
| Limpeza (chat, logs) | 1x/dia | 1 |
| Alertas | 2h | 1 |
| Reports automaticos | 1h (verifica schedule) | 1 |

- **Nunca rodar syncs de multiplas plataformas em paralelo.** Cada sync pode fazer 10-50 queries. Sequential com `.catch()` individual.
- **cronSync (endpoint manual) deve ser sequential**, nao `Promise.allSettled`.

---

## 12. Monitoring — O que Verificar

### Queries para rodar periodicamente

```sql
-- 1. Conexoes por estado
SELECT state, count(*) FROM pg_stat_activity GROUP BY state;

-- 2. Dead tuples acumulando
SELECT relname, n_dead_tup, n_live_tup, last_autovacuum
FROM pg_stat_user_tables WHERE n_dead_tup > 50 ORDER BY n_dead_tup DESC;

-- 3. Tamanho das tabelas
SELECT relname, pg_size_pretty(pg_total_relation_size(relid))
FROM pg_stat_user_tables ORDER BY pg_total_relation_size(relid) DESC LIMIT 10;

-- 4. Queries lentas (se pg_stat_statements disponivel)
SELECT query, calls, mean_exec_time, total_exec_time
FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;

-- 5. Cache hit ratio (deve ser >99%)
SELECT
    sum(heap_blks_hit) / nullif(sum(heap_blks_hit) + sum(heap_blks_read), 0) AS ratio
FROM pg_statio_user_tables;

-- 6. Extensoes ativas
SELECT extname FROM pg_extension ORDER BY extname;

-- 7. Tabelas no Realtime (deve estar vazio se nao usa)
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
```

### Sinais de alerta

| Sinal | Acao |
|-------|------|
| `active` connections > 10 por mais de 1 min | Verificar queries travadas, matar com `pg_terminate_backend()` |
| `idle in transaction` > 0 por mais de 30s | Bug no codigo — alguma transacao nao foi fechada |
| Dead tuples > live tuples em qualquer tabela | Autovacuum nao esta rodando — verificar thresholds |
| Cache hit ratio < 95% | RAM insuficiente ou queries sem index |
| DB size > 500MB no Micro | Considerar limpeza ou upgrade |

---

## 13. Migrations — Execucao Segura

### Regras

- **Sempre rodar via CLI, nunca pelo dashboard:**
  ```bash
  npx supabase db push --include-all --db-url "$DB_URL"
  ```
- **Se travar por "duplicate key" em `schema_migrations`:**
  ```bash
  npx supabase migration repair <version> --status reverted --db-url "$DB_URL"
  ```
- **VACUUM e ALTER SYSTEM nao funcionam via Management API** (rodam dentro de transaction block). Usar connection direta ou dashboard SQL editor.
- **Testar migrations localmente primeiro:**
  ```bash
  npx supabase db reset  # aplica todas migrations do zero localmente
  ```

---

## 14. Checklist — Antes de Cada Deploy

- [ ] Nenhum `.select('*')` ou `.select()` sem colunas
- [ ] Nenhuma query dentro de loop (`.map`, `for`, `forEach`)
- [ ] Toda estrutura in-memory tem limite maximo
- [ ] Novos jobs tem delay no boot e nao executam imediatamente
- [ ] Novas tabelas tem autovacuum threshold configurado
- [ ] Novas tabelas NAO estao no Realtime publication
- [ ] FK columns tem index
- [ ] Clientes de API externa sao singleton
- [ ] `Promise.all` so com queries independentes (max 5-6)

---

## 15. Quando Fazer Upgrade de Compute

O Micro (1GB) aguenta a Northie ate:

- ~50 profiles ativos
- ~100k transactions
- ~500k rows total
- ~5 queries concorrentes sustentadas

Se qualquer um desses limites for atingido consistentemente, upgrade para **Small (2GB, $65/mes)**.

Sinais de que precisa de upgrade:
- DB caindo mais de 1x por semana
- Cache hit ratio < 90%
- Queries simples levando > 500ms
- SWAP usage > 50% consistente

---

*Ultima atualizacao: 2026-03-10*
*Incidente que motivou: crash repetido por thundering herd + autovacuum inativo + pg_graphql*
