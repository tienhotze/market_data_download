import { Pool } from 'pg';
import { PoolClient } from 'pg';

// IMPORTANT: Ensure you have a .env.local file with these variables
const dbConfig = {
  user: process.env.PG_USER || 'postgres',
  host: process.env.PG_HOST || '192.53.174.253',
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT ? parseInt(process.env.PG_PORT, 10) : 5432,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
};

const economicDataPool = new Pool({
  ...dbConfig,
  database: 'economic_data',
});

const assetPricesPool = new Pool({
  ...dbConfig,
  database: 'asset_prices',
});

export const worldEventsPool = new Pool({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_WORLD_EVENTS_DATABASE,
  password: process.env.PG_PASSWORD,
  port: parseInt(process.env.PG_PORT || "5432"),
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Add helper functions for funding rates
export async function getFundingRates(symbols?: string[], broker?: string, limit?: number) {
  const client = await assetPricesPool.connect();
  try {
    let query = `
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
      WHERE 1=1
    `;
    
    const params: any[] = [];
    let paramIndex = 1;
    
    if (symbols && symbols.length > 0) {
      query += ` AND a.symbol = ANY($${paramIndex})`;
      params.push(symbols);
      paramIndex++;
    }
    
    if (broker) {
      query += ` AND e.name = $${paramIndex}`;
      params.push(broker);
      paramIndex++;
    }
    
    query += ` ORDER BY fr.effective_date DESC, fr.timestamp DESC`;
    
    if (limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(limit);
    }
    
    const result = await client.query(query, params);
    
    return result.rows.map(row => {
      // Clean up the data and format as percentages
      const formatRate = (rate: any) => {
        if (rate === null || rate === undefined) return null;
        const percentage = parseFloat(String(rate).replace(/[+%]/g, '')) * 100;
        return `${percentage >= 0 ? '+' : ''}${percentage.toFixed(4)}%`;
      };
      
      const long_rate = formatRate(row.long_rate);
      const short_rate = formatRate(row.short_rate);
      const effective_date = row.effective_date ? new Date(row.effective_date) : null;

      return {
        ...row,
        long_rate,
        short_rate,
        effective_date: effective_date ? effective_date.toISOString().split('T')[0] : null,
      };
    });
  } catch (error) {
    console.error("Error fetching funding rates from DB:", error);
    throw error;
  }
  finally {
    client.release();
  }
}

export async function getCurrencyPairsWithFundingRates() {
  const client = await assetPricesPool.connect();
  try {
    const query = `
      SELECT DISTINCT a.symbol
      FROM funding_rates fr
      JOIN assets a ON fr.asset_id = a.id
      JOIN exchanges e ON fr.broker_id = e.id
      WHERE e.name = 'OANDA'
      ORDER BY a.symbol
    `;
    
    const result = await client.query(query);
    return result.rows.map(row => row.symbol);
  } finally {
    client.release();
  }
}

// Helper function to calculate correlation between two arrays
export function calculateCorrelation(data1: number[], data2: number[]): number {
  if (data1.length !== data2.length || data1.length === 0) return 0;

  const n = data1.length;
  const mean1 = data1.reduce((a, b) => a + b, 0) / n;
  const mean2 = data2.reduce((a, b) => a + b, 0) / n;

  const numerator = data1.reduce(
    (sum, val, i) => sum + (val - mean1) * (data2[i] - mean2),
    0
  );

  const denominator1 = Math.sqrt(
    data1.reduce((sum, val) => sum + Math.pow(val - mean1, 2), 0)
  );
  const denominator2 = Math.sqrt(
    data2.reduce((sum, val) => sum + Math.pow(val - mean2, 2), 0)
  );

  return denominator1 * denominator2 === 0
    ? 0
    : numerator / (denominator1 * denominator2);
}

// Helper function to get closing prices for currency pairs
export async function getClosingPrices(symbols: string[], days: number) {
  const client = await assetPricesPool.connect();
  try {
    // Get asset IDs for symbols
    const assetQuery = `
      SELECT id, symbol FROM assets WHERE symbol = ANY($1)
    `;
    const assetResult = await client.query(assetQuery, [symbols]);
    const assetMap = new Map(assetResult.rows.map(row => [row.symbol, row.id]));
    
    const prices: Record<string, { date: string; close: number }[]> = {};
    
    // Get closing prices for each asset
    for (const symbol of symbols) {
      const assetId = assetMap.get(symbol);
      if (!assetId) continue;
      
      const priceQuery = `
        SELECT timestamp::date as date, close
        FROM prices_ohlcv_daily
        WHERE asset_id = $1
        AND timestamp >= NOW() - INTERVAL '${days} days'
        ORDER BY timestamp ASC
      `;
      
      const priceResult = await client.query(priceQuery, [assetId]);
      prices[symbol] = priceResult.rows.map(row => ({
        date: row.date.toISOString().split('T')[0],
        close: parseFloat(row.close)
      }));
    }
    
    return prices;
  } finally {
    client.release();
  }
}

export async function getLastPrice(symbol: string) {
  const client = await assetPricesPool.connect();
  try {
    const assetQuery = `
      SELECT id FROM assets WHERE symbol = $1
    `;
    const assetResult = await client.query(assetQuery, [symbol]);
    if (assetResult.rows.length === 0) {
      return null;
    }
    const assetId = assetResult.rows[0].id;

    const priceQuery = `
      SELECT close
      FROM prices_ohlcv_daily
      WHERE asset_id = $1
      ORDER BY timestamp DESC
      LIMIT 1
    `;
    const priceResult = await client.query(priceQuery, [assetId]);
    if (priceResult.rows.length === 0) {
      return null;
    }
    return parseFloat(priceResult.rows[0].close);
  } finally {
    client.release();
  }
}

// Helper function to align data to common dates
export function alignData(
  prices: Record<string, { date: string; close: number }[]>
): Record<string, number[]> {
  // Get all unique dates
  const allDates = new Set<string>();
  Object.values(prices).forEach(priceArray => {
    priceArray.forEach(price => allDates.add(price.date));
  });
  
  const sortedDates = Array.from(allDates).sort();
  
  // Create aligned arrays
  const aligned: Record<string, number[]> = {};
  Object.keys(prices).forEach(symbol => {
    aligned[symbol] = [];
    const symbolPrices = prices[symbol];
    
    sortedDates.forEach(date => {
      const priceEntry = symbolPrices.find(p => p.date === date);
      aligned[symbol].push(priceEntry ? priceEntry.close : NaN);
    });
  });
  
  // Remove dates with missing data
  const cleanAligned: Record<string, number[]> = {};
  Object.keys(aligned).forEach(symbol => {
    cleanAligned[symbol] = [];
  });
  
  for (let i = 0; i < sortedDates.length; i++) {
    let hasMissing = false;
    Object.values(aligned).forEach(prices => {
      if (isNaN(prices[i])) hasMissing = true;
    });
    
    if (!hasMissing) {
      Object.keys(aligned).forEach(symbol => {
        cleanAligned[symbol].push(aligned[symbol][i]);
      });
    }
  }
  
  return cleanAligned;
}

export { economicDataPool, assetPricesPool };