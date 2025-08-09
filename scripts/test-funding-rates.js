const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function testFundingRates() {
  console.log('Testing funding rates connection...');
  
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
    
    // Test query for funding rates
    const query = `
      SELECT 
        a.symbol,
        e.name as broker,
        fr.long_rate,
        fr.short_rate,
        fr.effective_date,
        fr.timestamp
      FROM funding_rates fr
      JOIN assets a ON fr.asset_id = a.id
      JOIN exchanges e ON fr.broker_id = e.id
      WHERE e.name = 'OANDA'
      ORDER BY fr.effective_date DESC, fr.timestamp DESC
      LIMIT 5
    `;
    
    console.log('Executing funding rates query...');
    const result = await client.query(query);
    console.log(`✅ Found ${result.rows.length} funding rate records.`);
    
    if (result.rows.length > 0) {
      console.log('Sample funding rates:');
      result.rows.forEach(row => {
        console.log(`  ${row.symbol}: Long=${row.long_rate}, Short=${row.short_rate}, Date=${row.effective_date}`);
      });
    } else {
      console.log('❌ No funding rate records found.');
    }
    
  } catch (error) {
    console.error('❌ Error testing funding rates:', error.message);
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
testFundingRates();