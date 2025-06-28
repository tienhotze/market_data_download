import { Pool } from 'pg';

const pool = new Pool({
  user: 'postgres',
  host: process.env.PG_HOST || '192.53.174.253',
  database: 'asset_prices',
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT ? parseInt(process.env.PG_PORT, 10) : 5432,
});

const ASSET_SYMBOLS = ['WTI', 'Gold', 'VIX', 'DXY Index'];

async function main() {
  try {
    console.log('Successfully connected to asset_prices database.');
    for (const symbol of ASSET_SYMBOLS) {
      const assetRes = await pool.query('SELECT id, name FROM assets WHERE symbol = $1', [symbol]);
      if (assetRes.rows.length === 0) {
        console.log(`Asset not found for symbol: ${symbol}`);
        continue;
      }
      const asset = assetRes.rows[0];
      const priceRes = await pool.query(
        'SELECT timestamp, close FROM prices_ohlcv_daily WHERE asset_id = $1 ORDER BY timestamp ASC',
        [asset.id]
      );
      console.log(`\nAsset: ${symbol} (${asset.name})`);
      console.log(`  Data points: ${priceRes.rows.length}`);
      if (priceRes.rows.length > 0) {
        console.log(`  Date range: ${priceRes.rows[0].timestamp.toISOString().split('T')[0]} to ${priceRes.rows[priceRes.rows.length-1].timestamp.toISOString().split('T')[0]}`);
      } else {
        console.log('  No price data found.');
      }
    }
  } catch (err) {
    console.error('Error querying assets from the database:', err);
  } finally {
    await pool.end();
    console.log('Database connection released.');
  }
}

main(); 