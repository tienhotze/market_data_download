const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

function calculateChanges(data, period, type) {
  if (period <= 0 || !data || data.length <= period) {
    return [];
  }

  console.log(`Calculating ${type} changes with period ${period}`);
  console.log(`Input data length: ${data.length}`);
  console.log(`First 5 data points:`, data.slice(0, 5));

  // Data is assumed to be sorted ASC
  return data.slice(period).map((item, index) => {
    const p0 = data[index].value;
    const p1 = item.value;
    let change = null;
    
    console.log(`Comparing: p0=${p0} (${typeof p0}), p1=${p1} (${typeof p1})`);
    
    if (p0 !== null && p1 !== null && !isNaN(p0) && !isNaN(p1) && p0 !== 0) {
      if (type === 'percent') {
        change = ((p1 / p0) - 1) * 100;
      } else {
        change = p1 - p0;
      }
      console.log(`Calculated change: ${change}`);
    } else {
      console.log(`Skipping calculation - invalid values`);
    }
    
    return { date: item.date, value: change };
  });
}

async function testPercentChange() {
  console.log('--- Testing Percent Change Calculation ---');
  
  // Test WTI data
  console.log('\n=== Testing WTI Data ===');
  const assetPricesPool = new Pool({
    user: process.env.PG_USER || 'postgres',
    host: process.env.PG_HOST,
    database: 'asset_prices',
    password: process.env.PG_PASSWORD,
    port: process.env.PG_PORT || 5432,
  });

  let client;
  try {
    client = await assetPricesPool.connect();
    console.log('✅ Connected to asset_prices database.');

    // Test with WTI data
    const wtiQuery = `
      SELECT T2.timestamp as date, T2.close as value
      FROM assets AS T1 JOIN prices_ohlcv_daily AS T2 ON T1.id = T2.asset_id 
      WHERE T1.symbol = 'WTI' ORDER BY T2.timestamp ASC LIMIT 10
    `;
    
    const wtiResult = await client.query(wtiQuery);
    console.log(`Found ${wtiResult.rows.length} rows for WTI`);

    if (wtiResult.rows.length > 0) {
      const rawData = wtiResult.rows.map(row => ({
        date: new Date(row.date).toISOString().split("T")[0],
        value: parseFloat(row.value)
      }));

      console.log('Raw WTI data after parsing:');
      console.table(rawData);

      const transformedData = calculateChanges(rawData, 1, 'percent');
      console.log('Transformed WTI data:');
      console.table(transformedData);
    }

  } catch (err) {
    console.error('❌ WTI test failed:', err.message);
  } finally {
    if (client) client.release();
    await assetPricesPool.end();
  }

  // Test CPI data
  console.log('\n=== Testing CPI Data ===');
  const economicDataPool = new Pool({
    user: process.env.PG_USER || 'postgres',
    host: process.env.PG_HOST,
    database: 'economic_data',
    password: process.env.PG_PASSWORD,
    port: process.env.PG_PORT || 5432,
  });

  try {
    client = await economicDataPool.connect();
    console.log('✅ Connected to economic_data database.');

    // Test with CPI data
    const cpiQuery = `
      SELECT date, value FROM indicator_values WHERE series_id = 'CUUR0000SA0' ORDER BY date ASC LIMIT 10
    `;
    
    const cpiResult = await client.query(cpiQuery);
    console.log(`Found ${cpiResult.rows.length} rows for CPI`);

    if (cpiResult.rows.length > 0) {
      const rawData = cpiResult.rows.map(row => ({
        date: new Date(row.date).toISOString().split("T")[0],
        value: parseFloat(row.value)
      }));

      console.log('Raw CPI data after parsing:');
      console.table(rawData);

      const transformedData = calculateChanges(rawData, 1, 'percent');
      console.log('Transformed CPI data:');
      console.table(transformedData);
    }

  } catch (err) {
    console.error('❌ CPI test failed:', err.message);
  } finally {
    if (client) client.release();
    await economicDataPool.end();
    console.log('--- Test complete ---');
  }
}

testPercentChange(); 