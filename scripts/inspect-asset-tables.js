const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function inspectAssetTables() {
  console.log('--- Inspecting asset_prices tables ---');
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
    console.log('✅ Connected to asset_prices');

    const tablesToInspect = ['assets', 'prices_ohlcv_daily'];
    for (const tableName of tablesToInspect) {
      console.log(`\\n--- Schema for ${tableName} ---`);
      const columnsQuery = `
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = $1 
        ORDER BY ordinal_position
      `;
      const columnsResult = await client.query(columnsQuery, [tableName]);
      
      if (columnsResult.rows.length > 0) {
        console.table(columnsResult.rows);
      } else {
        console.log(`Table '${tableName}' not found or has no columns.`);
      }
    }

  } catch (err) {
    console.error('❌ Test failed:', err.message);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

inspectAssetTables(); 