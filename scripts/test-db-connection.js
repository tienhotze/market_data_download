const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

// Test both database connections
async function testConnections() {
  console.log('Testing PostgreSQL database connections...\n');
  
  // Test economic_data database
  console.log('1. Testing economic_data database...');
  const economicDataPool = new Pool({
    user: 'postgres',
    host: process.env.PG_HOST || '192.53.174.253',
    database: 'economic_data',
    password: process.env.PG_PASSWORD,
    port: process.env.PG_PORT ? parseInt(process.env.PG_PORT, 10) : 5432,
  });

  try {
    const client = await economicDataPool.connect();
    console.log('✅ Connected to economic_data database successfully');
    
    // Check if indicator_values table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'indicator_values'
      );
    `);
    
    if (tableCheck.rows[0].exists) {
      console.log('✅ indicator_values table exists');
      
      // Check for CPI data
      const cpiData = await client.query(`
        SELECT COUNT(*) as count FROM indicator_values 
        WHERE series_id = 'CUUR0000SA0'
      `);
      console.log(`📊 Found ${cpiData.rows[0].count} CPI records`);
    } else {
      console.log('❌ indicator_values table does not exist');
    }
    
    client.release();
  } catch (error) {
    console.log('❌ Failed to connect to economic_data database:', error.message);
  }

  // Test asset_prices database
  console.log('\n2. Testing asset_prices database...');
  const assetPricesPool = new Pool({
    user: 'postgres',
    host: process.env.PG_HOST || '192.53.174.253',
    database: 'asset_prices',
    password: process.env.PG_PASSWORD,
    port: process.env.PG_PORT ? parseInt(process.env.PG_PORT, 10) : 5432,
  });

  try {
    const client = await assetPricesPool.connect();
    console.log('✅ Connected to asset_prices database successfully');
    
    // Check if prices_ohlcv_daily table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'prices_ohlcv_daily'
      );
    `);
    
    if (tableCheck.rows[0].exists) {
      console.log('✅ prices_ohlcv_daily table exists');
      
      // Print all columns in the table FIRST
      const columns = await client.query(`
        SELECT column_name, data_type FROM information_schema.columns 
        WHERE table_name = 'prices_ohlcv_daily' ORDER BY ordinal_position
      `);
      console.log('📋 Columns in prices_ohlcv_daily:', columns.rows);
      
      // Check for WTI data (if ticker column exists)
      try {
        const wtiData = await client.query(`
          SELECT COUNT(*) as count FROM prices_ohlcv_daily 
          WHERE ticker = 'WTI'
        `);
        console.log(`📊 Found ${wtiData.rows[0].count} WTI records`);
      } catch (err) {
        console.log('⚠️ Could not query for WTI records (maybe no ticker column):', err.message);
      }
      
      // List available tickers (if ticker column exists)
      try {
        const tickers = await client.query(`
          SELECT DISTINCT ticker FROM prices_ohlcv_daily 
          ORDER BY ticker LIMIT 10
        `);
        console.log('📋 Available tickers:', tickers.rows.map(row => row.ticker).join(', '));
      } catch (err) {
        console.log('⚠️ Could not list tickers (maybe no ticker column):', err.message);
      }
    } else {
      console.log('❌ prices_ohlcv_daily table does not exist');
      
      // List all tables in the database
      const tables = await client.query(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name
      `);
      console.log('📋 Available tables:', tables.rows.map(row => row.table_name).join(', '));
    }
    
    client.release();
  } catch (error) {
    console.log('❌ Failed to connect to asset_prices database:', error.message);
  }

  // Close pools
  await economicDataPool.end();
  await assetPricesPool.end();
  
  console.log('\n✅ Database connection test completed');
}

// Run the test
testConnections().catch(console.error); 