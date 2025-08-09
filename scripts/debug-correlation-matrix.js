const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function debugCorrelationMatrix() {
  console.log('Debugging correlation matrix data extraction...');
  
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
    
    // Test query to get FX currency pairs (same as in the correlation matrix route)
    const query = `
      SELECT DISTINCT symbol FROM assets a
      JOIN asset_types at ON a.asset_type_id = at.id
      WHERE at.name = 'FX'
      ORDER BY symbol
    `;
    
    console.log('Executing currency pairs query...');
    const result = await client.query(query);
    console.log(`✅ Found ${result.rows.length} currency pairs.`);
    
    if (result.rows.length > 0) {
      console.log('First 10 currency pairs:');
      result.rows.slice(0, 10).forEach(row => {
        console.log(`  ${row.symbol}`);
      });
      
      // Test getting closing prices for the first few pairs
      const symbols = result.rows.slice(0, 5).map(row => row.symbol);
      console.log(`\nTesting closing prices for: ${symbols.join(', ')}`);
      
      // Get asset IDs
      const assetQuery = `
        SELECT id, symbol FROM assets WHERE symbol = ANY($1)
      `;
      const assetResult = await client.query(assetQuery, [symbols]);
      const assetMap = new Map(assetResult.rows.map(row => [row.symbol, row.id]));
      console.log('Asset IDs:', Object.fromEntries(assetMap));
      
      // Get closing prices for each asset
      for (const symbol of symbols) {
        const assetId = assetMap.get(symbol);
        if (!assetId) {
          console.log(`  ❌ No asset ID found for ${symbol}`);
          continue;
        }
        
        const priceQuery = `
          SELECT timestamp::date as date, close
          FROM prices_ohlcv_daily
          WHERE asset_id = $1
          AND timestamp >= NOW() - INTERVAL '30 days'
          ORDER BY timestamp ASC
        `;
        
        const priceResult = await client.query(priceQuery, [assetId]);
        console.log(`  ${symbol}: ${priceResult.rows.length} price records`);
        if (priceResult.rows.length > 0) {
          console.log(`    Sample: ${priceResult.rows[0].date} - ${priceResult.rows[0].close}`);
        }
      }
    } else {
      console.log('❌ No currency pairs found.');
    }
    
  } catch (error) {
    console.error('❌ Error debugging correlation matrix:', error.message);
    console.error('Error details:', error);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
    console.log('Disconnected from database.');
  }
}

// Run the debug
debugCorrelationMatrix();