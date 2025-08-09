const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function testFxRates() {
  console.log('Testing FX rates connection...');
  
  const pool = new Pool({
    user: process.env.PG_USER || 'postgres',
    host: process.env.PG_HOST || '192.53.174.253',
    database: 'asset_prices',
    password: process.env.PG_PASSWORD,
    port: process.env.PG_PORT || 5432,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  let client;
  try {
    client = await pool.connect();
    console.log('✅ Connected to asset_prices database.');
    
    // Test query for FX rates
    const query = `
      SELECT
        a.symbol,
        p.timestamp::date as date,
        p.close
      FROM prices_ohlcv_daily p
      JOIN assets a ON p.asset_id = a.id
      JOIN asset_types at ON a.asset_type_id = at.id
      WHERE at.name = 'FX'
      ORDER BY a.symbol, p.timestamp DESC
      LIMIT 10
    `;
    
    console.log('Executing FX rates query...');
    const result = await client.query(query);
    console.log(`✅ Found ${result.rows.length} FX rate records.`);
    
    if (result.rows.length > 0) {
      console.log('Sample FX rates:');
      result.rows.forEach(row => {
        console.log(`  ${row.symbol}: Close=${row.close}, Date=${row.date}`);
      });
    } else {
      console.log('❌ No FX rate records found.');
    }
    
  } catch (error) {
    console.error('❌ Error testing FX rates:', error.message);
    console.error('Error details:', error);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
    console.log('Disconnected from database.');
  }
}

// Run the test
testFxRates();