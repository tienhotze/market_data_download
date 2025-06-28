const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function checkAssets() {
  console.log('--- Checking contents of the assets table ---');
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

    const query = `SELECT id, symbol, name FROM assets ORDER BY symbol;`;
    const result = await client.query(query);

    if (result.rows.length > 0) {
      console.log('📋 Found the following assets:');
      console.table(result.rows);
    } else {
      console.log('No assets found in the table.');
    }

  } catch (err) {
    console.error('❌ Script failed:', err.message);
  } finally {
    if (client) client.release();
    await pool.end();
    console.log('--- Check complete ---');
  }
}

checkAssets(); 