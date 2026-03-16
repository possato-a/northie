/**
 * Script de backfill — Google Ads
 *
 * Executa o sync histórico de métricas do Google Ads para um perfil específico.
 *
 * Uso:
 *   npx tsx src/scripts/backfill-google.ts <profileId> [days]
 *
 * Exemplos:
 *   npx tsx src/scripts/backfill-google.ts abc-123          # últimos 365 dias
 *   npx tsx src/scripts/backfill-google.ts abc-123 30       # últimos 30 dias
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../../.env.local') });

import { backfillGoogleAds } from '../jobs/ads-sync.job.js';

const [, , profileId, daysArg] = process.argv;

if (!profileId) {
    console.error('Uso: npx tsx src/scripts/backfill-google.ts <profileId> [days]');
    process.exit(1);
}

const days = daysArg ? parseInt(daysArg, 10) : undefined;

console.log(`\nBackfill Google Ads`);
console.log(`  Profile : ${profileId}`);
console.log(`  Período : últimos ${days ?? 365} dias\n`);

try {
    const result = await backfillGoogleAds(profileId, days);
    console.log(`\n✅ Backfill concluído — ${result.rowsUpserted} dia(s) sincronizados.`);
} catch (err: unknown) {
    console.error('\n❌ Erro no backfill:', err instanceof Error ? err.message : String(err));
    process.exit(1);
}
