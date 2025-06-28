const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function checkAllDbs() {
  console.log('--- Full Database Schema Check ---');

  const databases = ["asset_prices", "economic_data"];

  for (const dbName of databases) {
    console.log(`\\n--- Checking Database: ${dbName} ---`);
    const pool = new Pool({
      user: process.env.PG_USER,
      host: process.env.PG_HOST,
      database: dbName,
      password: process.env.PG_PASSWORD,
      port: process.env.PG_PORT,
    });

    let client;
    try {
      client = await pool.connect();
      console.log(`✅ Connected to ${dbName}`);
      
      const tablesQuery = `
        SELECT schemaname, tablename 
        FROM pg_tables
        WHERE schemaname NOT IN ('pg_catalog', 'information_schema');
      `;
      const tablesResult = await client.query(tablesQuery);

      if (tablesResult.rows.length > 0) {
        console.log('📋 Tables found:');
        console.table(tablesResult.rows);
      } else {
        console.log('No user-created tables found in any schema.');
      }

    } catch (err) {
      console.error(`❌ Failed to check ${dbName}:`, err.message);
    } finally {
      if (client) client.release();
      await pool.end();
    }
  }
  console.log('\\n--- Check Complete ---');
}

checkAllDbs(); 