const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function basicConnectionTest() {
  console.log('Basic PostgreSQL connection test...\n');
  console.log('Environment variables:');
  console.log('PG_HOST:', process.env.PG_HOST || '192.53.174.253');
  console.log('PG_PORT:', process.env.PG_PORT || '5432');
  console.log('PG_PASSWORD:', process.env.PG_PASSWORD ? '***SET***' : '***NOT SET***');
  
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
    
    client.release();
  } catch (error) {
    console.log('\n❌ Connection failed:', error.message);
    console.log('Full error:', error);
  } finally {
    await pool.end();
  }
}

basicConnectionTest(); 