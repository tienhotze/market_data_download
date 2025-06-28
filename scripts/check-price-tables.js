const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function listPriceTables() {
  console.log('--- Checking for available price tables in asset_prices ---');
  const pool = new Pool({
    user: process.env.PG_USER || 'postgres',
    host: process.env.PG_HOST,
    database: 'asset_prices',
    password: process.env.PG_PASSWORD,
    port: process.env.PG_PORT || 5432,
  });

  let client;
  try {
    client = await pool.connect();
    console.log('✅ Connected to asset_prices database.');

    const tablesQuery = `
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public' AND (tablename LIKE 'prices_ohlcv_%' OR tablename = 'prices_tick')
      ORDER BY tablename;
    `;
    const tablesResult = await client.query(tablesQuery);

    if (tablesResult.rows.length > 0) {
      console.log('📋 Found the following price tables:');
      console.table(tablesResult.rows.map(r => r.tablename));
    } else {
      console.log('No price tables (e.g., prices_ohlcv_*, prices_tick) found.');
    }

  } catch (err) {
    console.error('❌ Script failed:', err.message);
  } finally {
    if (client) client.release();
    await pool.end();
    console.log('--- Check complete ---');
  }
}

listPriceTables(); 