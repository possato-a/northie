/**
 * Standalone backfill script — run with:
 *   npx tsx src/scripts/backfill-hotmart.ts <profileId> [days]
 *
 * Populates transactions and customers with Hotmart sales data.
 *
 * Arguments:
 *   profileId  (required) — UUID do perfil a ser populado
 *   days       (optional) — número de dias para backfill (padrão: 365)
 *
 * Examples:
 *   npx tsx src/scripts/backfill-hotmart.ts 5ffb35c4-34f5-4247-925a-10639b08096a
 *   npx tsx src/scripts/backfill-hotmart.ts 5ffb35c4-34f5-4247-925a-10639b08096a 90
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../../.env.local') });
import { backfillHotmart } from '../jobs/hotmart-sync.job.js';
const [profileId, daysArg] = process.argv.slice(2);
if (!profileId) {
    console.error('\n❌ profileId is required.');
    console.error('   Usage: npx tsx src/scripts/backfill-hotmart.ts <profileId> [days]\n');
    process.exit(1);
}
const days = daysArg ? parseInt(daysArg, 10) : 365;
if (isNaN(days) || days <= 0) {
    console.error(`\n❌ Invalid days value: "${daysArg}". Must be a positive integer.\n`);
    process.exit(1);
}
console.log(`\n🚀 Starting Hotmart backfill for profile ${profileId} — last ${days} days\n`);
try {
    const { synced, skipped, errors } = await backfillHotmart(profileId, days);
    console.log(`\n✅ Backfill complete! synced: ${synced} | skipped: ${skipped} | errors: ${errors}`);
    if (errors > 0)
        process.exit(1);
}
catch (err) {
    console.error('\n❌ Backfill failed:', err.message);
    process.exit(1);
}
//# sourceMappingURL=backfill-hotmart.js.map