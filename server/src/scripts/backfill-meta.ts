/**
 * Standalone backfill script — run with:
 *   npx tsx src/scripts/backfill-meta.ts
 *
 * Populates ad_campaigns and ad_metrics with the last 365 days of Meta Ads data.
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Load .env.local from server root
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../../.env.local') });

import { backfillMetaAds } from '../jobs/ads-sync.job.js';

const PROFILE_ID = '5ffb35c4-34f5-4247-925a-10639b08096a';
const DAYS = 365;

console.log(`\n🚀 Starting Meta Ads backfill for profile ${PROFILE_ID} — last ${DAYS} days\n`);

try {
    await backfillMetaAds(PROFILE_ID, DAYS);
    console.log('\n✅ Backfill complete!');
} catch (err: any) {
    console.error('\n❌ Backfill failed:', err.message);
    process.exit(1);
}
