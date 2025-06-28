const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function checkCADUSD() {
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

    // Check if CADUSD exists in assets table
    const assetQuery = `SELECT id, symbol, name FROM assets WHERE symbol = 'CADUSD'`;
    const assetResult = await client.query(assetQuery);
    console.log('CADUSD asset record:', assetResult.rows);

    if (assetResult.rows.length > 0) {
      const assetId = assetResult.rows[0].id;
      
      // Check for any price data for CADUSD
      const priceQuery = `SELECT COUNT(*) as count FROM prices_ohlcv_daily WHERE asset_id = $1`;
      const priceResult = await client.query(priceQuery, [assetId]);
      console.log('CADUSD price count:', priceResult.rows[0]);

      // Check for any price data in the last 2 years
      const twoYearsAgo = new Date();
      twoYearsAgo.setDate(twoYearsAgo.getDate() - 730);
      
      const recentPriceQuery = `
        SELECT COUNT(*) as count 
        FROM prices_ohlcv_daily 
        WHERE asset_id = $1 AND timestamp >= $2
      `;
      const recentPriceResult = await client.query(recentPriceQuery, [assetId, twoYearsAgo]);
      console.log('CADUSD recent price count (last 2 years):', recentPriceResult.rows[0]);

      // Check what timeframes are available for CADUSD
      const timeframeQuery = `
        SELECT DISTINCT 
          CASE 
            WHEN table_name LIKE '%daily%' THEN 'daily'
            WHEN table_name LIKE '%weekly%' THEN 'weekly'
            WHEN table_name LIKE '%monthly%' THEN 'monthly'
            WHEN table_name LIKE '%1min%' THEN '1min'
            WHEN table_name LIKE '%5min%' THEN '5min'
            WHEN table_name LIKE '%1hour%' THEN '1hour'
            WHEN table_name LIKE '%4hour%' THEN '4hour'
            WHEN table_name LIKE '%12hour%' THEN '12hour'
            WHEN table_name LIKE '%yearly%' THEN 'yearly'
            ELSE table_name
          END as timeframe,
          table_name
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name LIKE 'prices_ohlcv_%'
        ORDER BY timeframe
      `;
      const timeframeResult = await client.query(timeframeQuery);
      console.log('Available timeframes:', timeframeResult.rows);

      // Check if CADUSD has data in any timeframe
      for (const row of timeframeResult.rows) {
        const tableName = row.table_name;
        const checkQuery = `SELECT COUNT(*) as count FROM ${tableName} WHERE asset_id = $1`;
        const checkResult = await client.query(checkQuery, [assetId]);
        console.log(`${tableName}: ${checkResult.rows[0].count} records`);
      }
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    if (client) client.release();
    await pool.end();
    console.log('--- Check complete ---');
  }
}

checkCADUSD(); 