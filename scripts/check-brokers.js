const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function checkBrokers() {
  console.log('Checking brokers in the database...');
  
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
    
    // Check what brokers are in the exchanges table
    const brokerQuery = `
      SELECT id, name, country
      FROM exchanges
      ORDER BY name
    `;
    
    console.log('Checking exchanges table...');
    const brokerResult = await client.query(brokerQuery);
    console.log(`✅ Found ${brokerResult.rows.length} exchanges:`);
    brokerResult.rows.forEach(row => {
      console.log(`  ${row.name} (${row.country || 'N/A'})`);
    });
    
    // Check funding rates with broker names
    const fundingQuery = `
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
      ORDER BY fr.effective_date DESC, fr.timestamp DESC
      LIMIT 10
    `;
    
    console.log('\nChecking funding rates with broker names...');
    const fundingResult = await client.query(fundingQuery);
    console.log(`✅ Found ${fundingResult.rows.length} funding rate records:`);
    fundingResult.rows.forEach(row => {
      console.log(`  ${row.symbol}: Broker=${row.broker}, Long=${row.long_rate}, Short=${row.short_rate}, Date=${row.effective_date}`);
    });
    
  } catch (error) {
    console.error('❌ Error checking brokers:', error.message);
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
checkBrokers();