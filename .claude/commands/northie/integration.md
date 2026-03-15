---
description: Scaffold a complete new platform integration for Northie (OAuth, webhook, sync job, normalization)
model: claude-sonnet-4-6
---

Crie o scaffolding completo de uma nova integração de plataforma para a Northie.

## Especificação

$ARGUMENTS

## Estrutura a Criar

Para cada nova integração, criar todos os arquivos necessários seguindo os padrões estabelecidos:

### 1. Controller (`server/src/controllers/integration.controller.js`)
Adicionar handlers de OAuth ao controller existente:
- `GET /api/integrations/{platform}/auth` — gerar URL de autorização
- `GET /api/integrations/{platform}/callback` — trocar code por tokens
- `DELETE /api/integrations/{platform}` — desconectar integração

### 2. Sync Job (`server/src/jobs/{platform}-sync.job.js`)
```javascript
// Padrão obrigatório:
let isRunning = false;

async function syncPlatformData(profileId, accessToken) {
  // 1. Buscar dados com paginação completa
  // 2. Normalizar para Northie Schema via normalization.service
  // 3. Upsert em transactions/customers/ad_metrics
  // 4. Salvar raw em platforms_data_raw
}

export function startPlatformSyncJob() {
  // Rodar na frequência adequada
  setInterval(async () => {
    if (isRunning) return;
    isRunning = true;
    try {
      // buscar todos os profiles com a integração ativa
      // chamar syncPlatformData para cada um
    } finally {
      isRunning = false;
    }
  }, INTERVAL_MS);
}
```

### 3. Normalização (`server/src/services/normalization.service.js`)
Adicionar função `normalize{Platform}Transaction(raw)` que retorna:
```javascript
{
  user_id, customer_id, platform, external_id,
  amount_gross, amount_net, fee_platform,
  status, created_at, northie_attribution_id, campaign_id
}
```

### 4. Tokens — segurança obrigatória
```javascript
import { encrypt, decrypt } from '../utils/encryption.js';

// Sempre encriptar antes de salvar
const { error } = await supabase.from('integrations').upsert({
  user_id: profileId,
  platform: 'platform_name',
  access_token: encrypt(tokens.access_token),
  refresh_token: encrypt(tokens.refresh_token),
  expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
  status: 'active'
});
```

### 5. Safety Net (`server/src/jobs/safety-net.job.js`)
Adicionar verificação da nova plataforma ao safety net existente.

### 6. Registro no index.ts
Adicionar o novo job ao `server/src/index.ts`.

## Checklist de Qualidade

- [ ] Paginação completa (não assumir que primeira página tem tudo)
- [ ] Tokens sempre encriptados antes de salvar
- [ ] Validação de assinatura HMAC em webhooks
- [ ] Idempotência: upsert por `platform + external_id + user_id`
- [ ] Exponential backoff em falhas de API
- [ ] Rate limiting respeitado (ver limites por plataforma)
- [ ] Backfill de histórico na primeira conexão (mínimo 12 meses)
- [ ] Mutex para evitar execuções simultâneas do job

## Rate Limits (referência)

| Plataforma | Limite | Estratégia |
|-----------|--------|-----------|
| Meta Ads | 200 calls/hora | Sliding window |
| Google Ads | 15.000 ops/dia | Batch + cache |
| Stripe | 100 req/s | Backoff |
| Shopify | 2 calls/s | Queue + throttle |

## Output

Criar todos os arquivos necessários prontos para uso, seguindo exatamente os padrões da codebase Northie.
