const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function testWithEnvPassword() {
  console.log('Testing database connection with PG_PASSWORD from .env.local...\n');
  
  // Check if PG_PASSWORD is set
  if (!process.env.PG_PASSWORD) {
    console.log('❌ PG_PASSWORD environment variable is not set in .env.local');
    console.log('Please make sure you have a .env.local file with PG_PASSWORD=your_password');
    return;
  }
  
  console.log('✅ PG_PASSWORD is set');
  console.log('PG_HOST:', process.env.PG_HOST || '192.53.174.253');
  console.log('PG_PORT:', process.env.PG_PORT || '5432');
  
  const pool = new Pool({
    user: 'postgres',
    host: process.env.PG_HOST || '192.53.174.253',
    database: 'asset_prices',
    password: process.env.PG_PASSWORD,
    port: process.env.PG_PORT ? parseInt(process.env.PG_PORT, 10) : 5432,
  });

  try {
    const client = await pool.connect();
    console.log('\n✅ Successfully connected to asset_prices database');
    
    // List all tables
    const tables = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log('\n📋 All tables in asset_prices database:');
    tables.rows.forEach(table => {
      console.log(`  - ${table.table_name}`);
    });
    
    // If prices_ohlcv_daily exists, get its schema
    const hasTable = tables.rows.some(row => row.table_name === 'prices_ohlcv_daily');
    if (hasTable) {
      console.log('\n📋 Schema for prices_ohlcv_daily table:');
      const columns = await client.query(`
        SELECT column_name, data_type FROM information_schema.columns 
        WHERE table_name = 'prices_ohlcv_daily' ORDER BY ordinal_position
      `);
      columns.rows.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type}`);
      });
    }
    
    client.release();
  } catch (error) {
    console.log('\n❌ Connection failed:', error.message);
  } finally {
    await pool.end();
  }
}

testWithEnvPassword(); 