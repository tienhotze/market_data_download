const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function testAssetPricesSchema() {
  console.log('Testing asset_prices database schema...\n');
  
  const pool = new Pool({
    user: 'postgres',
    host: process.env.PG_HOST || '192.53.174.253',
    database: 'asset_prices',
    password: process.env.PG_PASSWORD,
    port: process.env.PG_PORT ? parseInt(process.env.PG_PORT, 10) : 5432,
  });

  try {
    const client = await pool.connect();
    console.log('✅ Connected to asset_prices database');
    
    // Get table schema
    const columns = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'prices_ohlcv_daily' 
      ORDER BY ordinal_position
    `);
    
    console.log('\n📋 Schema for prices_ohlcv_daily table:');
    columns.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    
    // Show a few sample rows
    const sample = await client.query(`
      SELECT * FROM prices_ohlcv_daily LIMIT 3
    `);
    
    console.log('\n📊 Sample data (first 3 rows):');
    console.log(JSON.stringify(sample.rows, null, 2));
    
    client.release();
  } catch (error) {
    console.log('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

testAssetPricesSchema(); 