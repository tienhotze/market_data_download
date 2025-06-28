const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function ultraBasicTest() {
  console.log('--- Ultra Basic Connection Test ---');
  console.log('Using environment variables to connect to asset_prices database...');

  const pool = new Pool({
    user: process.env.PG_USER,
    host: process.env.PG_HOST,
    database: process.env.PG_ASSET_PRICES_DATABASE,
    password: process.env.PG_PASSWORD,
    port: process.env.PG_PORT,
  });

  let client;
  try {
    console.log('Attempting to get a client from the pool...');
    client = await pool.connect();
    console.log('✅ Client connected successfully!');
    
    const res = await client.query('SELECT NOW()');
    console.log('✅ Test query successful. Server time:', res.rows[0].now);

    console.log('\\n--- Listing all tables from all schemas ---');
    const tablesQuery = `
      SELECT schemaname, tablename 
      FROM pg_tables
      WHERE schemaname NOT IN ('pg_catalog', 'information_schema');
    `;
    const tablesResult = await client.query(tablesQuery);
    
    console.log('📋 Tables found in asset_prices:');
    if (tablesResult.rows.length > 0) {
      console.table(tablesResult.rows);
    } else {
      console.log('No user-created tables found in any schema.');
    }

  } catch (err) {
    console.error('❌ Test failed.');
    console.error('Error message:', err.message);
    console.error('Full error object:', err);
  } finally {
    if (client) {
      client.release();
      console.log('Client released.');
    }
    await pool.end();
    console.log('Pool ended.');
    console.log('--- Test Complete ---');
  }
}

ultraBasicTest(); 