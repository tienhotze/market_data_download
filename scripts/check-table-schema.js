const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function checkTableSchema() {
  console.log('--- Checking prices_ohlcv_daily table schema ---');
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

    // Check the schema of prices_ohlcv_daily table
    const tables = ['prices_ohlcv_daily', 'assets', 'asset_types'];
    for (const table of tables) {
      const schemaQuery = `
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = '${table}'
        ORDER BY ordinal_position;
      `;
      const schemaResult = await client.query(schemaQuery);

      if (schemaResult.rows.length > 0) {
        console.log(`📋 ${table} table columns:`);
        console.table(schemaResult.rows);
        
        // Also show the column names in a simple list
        console.log('Column names:', schemaResult.rows.map(r => r.column_name).join(', '));
      } else {
        console.log(`No columns found for ${table} table.`);
      }

      // Also check a few sample rows to see the actual data structure
      const sampleQuery = `
        SELECT * FROM ${table} LIMIT 3;
      `;
      const sampleResult = await client.query(sampleQuery);

      if (sampleResult.rows.length > 0) {
        console.log(`📋 Sample data from ${table}:`);
        console.table(sampleResult.rows);
      }
    }

  } catch (err) {
    console.error('❌ Script failed:', err.message);
  } finally {
    if (client) client.release();
    await pool.end();
    console.log('--- Check complete ---');
  }
}

checkTableSchema(); 