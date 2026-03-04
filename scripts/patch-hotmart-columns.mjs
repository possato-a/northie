/**
 * Patch script: popula product_name e payment_method nas transações
 * Hotmart existentes que têm esses campos como NULL.
 *
 * Uso: node scripts/patch-hotmart-columns.mjs
 */
import axios from 'axios';
import pg from 'pg';

const { Client } = pg;

const PROFILE_ID = '5ffb35c4-34f5-4247-925a-10639b08096a';
const HOTMART_AUTH_URL = 'https://api-sec-vlc.hotmart.com/security/oauth/token';
const HOTMART_API_BASE = 'https://developers.hotmart.com';
const HOTMART_CLIENT_ID = '6cf83254-2f45-4cce-8876-77914e720938';
const HOTMART_CLIENT_SECRET = '15b9845f-6e6c-4ffd-85a1-2144c290b3fa';
const DB_URL = 'postgresql://postgres:TSfmezl2rnS5msqJ@db.ucwlgqowqpfmotcofqoz.supabase.co:5432/postgres';

function mapPaymentType(type) {
  if (!type) return null;
  const t = type.toUpperCase();
  if (t.includes('PIX')) return 'Pix';
  if (t.includes('BILLET') || t.includes('BOLETO')) return 'Boleto';
  if (t.includes('CREDIT') || t.includes('DEBIT') || t.includes('CARD')) return 'Cartão';
  return type;
}

async function getToken() {
  const credentials = Buffer.from(`${HOTMART_CLIENT_ID}:${HOTMART_CLIENT_SECRET}`).toString('base64');
  const res = await axios.post(
    HOTMART_AUTH_URL,
    new URLSearchParams({ grant_type: 'client_credentials' }),
    {
      headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 15000,
    }
  );
  return res.data.access_token;
}

async function fetchAllSales(token, days = 365) {
  const endMs = Date.now();
  const startMs = endMs - days * 24 * 60 * 60 * 1000;
  const all = [];
  let pageToken = undefined;

  do {
    const params = {
      max_results: 50,
      start_date: startMs,
      end_date: endMs,
      ...(pageToken && { page_token: pageToken }),
    };
    const res = await axios.get(`${HOTMART_API_BASE}/payments/api/v1/sales/history`, {
      headers: { Authorization: `Bearer ${token}` },
      params,
      timeout: 30000,
    });
    const items = res.data?.items ?? [];
    all.push(...items);
    pageToken = res.data?.page_info?.next_page_token;
    console.log(`Fetched ${items.length} items. Total: ${all.length}`);
  } while (pageToken);

  return all;
}

async function main() {
  console.log('=== Hotmart Column Patch ===\n');

  // 1. Auth
  console.log('Getting Hotmart token...');
  const token = await getToken();
  console.log('Token obtained.\n');

  // 2. Fetch sales
  console.log('Fetching sales from last 365 days...');
  const rawSales = await fetchAllSales(token, 365);
  console.log(`Total sales fetched: ${rawSales.length}\n`);

  // 3. Connect to DB
  const client = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('Connected to DB.\n');

  let updated = 0;
  let skipped = 0;
  let notFound = 0;

  for (const raw of rawSales) {
    const externalId = raw.purchase?.transaction;
    const productName = raw.product?.name || null;
    const paymentMethod = mapPaymentType(raw.purchase?.payment?.type);

    if (!externalId) { skipped++; continue; }

    const res = await client.query(
      `UPDATE transactions
       SET
         product_name = COALESCE(product_name, $1),
         payment_method = COALESCE(payment_method, $2)
       WHERE profile_id = $3
         AND external_id = $4
         AND (product_name IS NULL OR payment_method IS NULL)
       RETURNING id`,
      [productName, paymentMethod, PROFILE_ID, externalId]
    );

    if (res.rowCount === 0) {
      // Either doesn't exist or already had values — check which
      const check = await client.query(
        `SELECT id, product_name, payment_method FROM transactions WHERE profile_id = $1 AND external_id = $2`,
        [PROFILE_ID, externalId]
      );
      if (check.rowCount === 0) {
        notFound++;
      } else {
        skipped++;
      }
    } else {
      updated++;
      console.log(`  Updated ${externalId}: "${productName}" / "${paymentMethod}"`);
    }
  }

  await client.end();

  console.log('\n=== Done ===');
  console.log(`Updated: ${updated}`);
  console.log(`Already populated (skipped): ${skipped}`);
  console.log(`Not in DB (not found): ${notFound}`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
