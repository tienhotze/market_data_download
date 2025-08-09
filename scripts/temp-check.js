const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function checkAssetType() {
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
    const result = await client.query("SELECT * FROM assets WHERE symbol = 'EUR_PLN'");
    console.log(result.rows);
  } catch (err) {
    console.error(err);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

checkAssetType();