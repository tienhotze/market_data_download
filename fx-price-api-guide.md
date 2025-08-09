# FX Price Data API Guide

This guide provides complete API endpoints and examples for fetching FX price data from PostgreSQL across multiple timeframes and brokers. Default broker is OANDA for FX data.

## Database Schema Overview

### Key Tables

- `assets` - Asset metadata (symbols, brokers, asset types)
- `exchanges` - Data sources/brokers (OANDA, Interactive Brokers, IG, etc.)
- `prices_ohlcv_*` - OHLCV data tables by timeframe
- `prices_tick` - Individual price ticks (if available)

### Available Timeframes

- `tick` - Individual price ticks
- `1min` - 1-minute OHLCV bars
- `5min` - 5-minute OHLCV bars
- `1hour` - 1-hour OHLCV bars
- `4hour` - 4-hour OHLCV bars
- `12hour` - 12-hour OHLCV bars
- `daily` - Daily OHLCV bars
- `weekly` - Weekly OHLCV bars
- `monthly` - Monthly OHLCV bars
- `yearly` - Yearly OHLCV bars

## Netlify Functions Implementation

### Base Database Connection

Create `netlify/functions/utils/db.js`:

```javascript
const { Client } = require("pg");

const createClient = () => {
  return new Client({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: {
      rejectUnauthorized: false,
    },
  });
};

const executeQuery = async (query, params = []) => {
  const client = createClient();
  try {
    await client.connect();
    const result = await client.query(query, params);
    return result.rows;
  } finally {
    await client.end();
  }
};

module.exports = { createClient, executeQuery };
```

### 1. Get Available FX Symbols

`netlify/functions/fx-symbols.js`:

```javascript
const { executeQuery } = require("./utils/db");

exports.handler = async (event, context) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  try {
    const { broker = "OANDA" } = event.queryStringParameters || {};

    const query = `
      SELECT DISTINCT a.symbol, a.name, a.description, e.name as broker
      FROM assets a
      JOIN asset_types at ON a.asset_type_id = at.id
      JOIN exchanges e ON a.exchange_id = e.id
      WHERE at.name = 'FX' 
        AND e.name = $1
      ORDER BY a.symbol
    `;

    const symbols = await executeQuery(query, [broker]);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        broker,
        count: symbols.length,
        data: symbols,
      }),
    };
  } catch (error) {
    console.error("Error fetching FX symbols:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: "Failed to fetch FX symbols",
      }),
    };
  }
};
```

### 2. Get FX Price Data (Main Endpoint)

`netlify/functions/fx-prices.js`:

```javascript
const { executeQuery } = require("./utils/db");

exports.handler = async (event, context) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  try {
    const {
      symbol,
      timeframe = "daily",
      broker = "OANDA",
      start_date,
      end_date,
      limit = "1000",
    } = event.queryStringParameters || {};

    if (!symbol) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: "Symbol parameter is required",
        }),
      };
    }

    // Validate timeframe
    const validTimeframes = [
      "tick",
      "1min",
      "5min",
      "1hour",
      "4hour",
      "12hour",
      "daily",
      "weekly",
      "monthly",
      "yearly",
    ];
    if (!validTimeframes.includes(timeframe)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: `Invalid timeframe. Valid options: ${validTimeframes.join(
            ", "
          )}`,
        }),
      };
    }

    // Build query based on timeframe
    let tableName =
      timeframe === "tick" ? "prices_tick" : `prices_ohlcv_${timeframe}`;

    let selectFields =
      timeframe === "tick"
        ? "p.timestamp, p.bid, p.ask, p.spread"
        : "p.timestamp, p.open, p.high, p.low, p.close, p.volume";

    let query = `
      SELECT ${selectFields}, a.symbol, e.name as broker
      FROM ${tableName} p
      JOIN assets a ON p.asset_id = a.id
      JOIN asset_types at ON a.asset_type_id = at.id
      JOIN exchanges e ON a.exchange_id = e.id
      WHERE a.symbol = $1 
        AND at.name = 'FX'
        AND e.name = $2
    `;

    const queryParams = [symbol, broker];
    let paramIndex = 3;

    // Add date filters if provided
    if (start_date) {
      query += ` AND p.timestamp >= $${paramIndex}`;
      queryParams.push(start_date);
      paramIndex++;
    }

    if (end_date) {
      query += ` AND p.timestamp <= $${paramIndex}`;
      queryParams.push(end_date);
      paramIndex++;
    }

    query += ` ORDER BY p.timestamp DESC LIMIT $${paramIndex}`;
    queryParams.push(parseInt(limit));

    const prices = await executeQuery(query, queryParams);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        symbol,
        timeframe,
        broker,
        count: prices.length,
        data: prices,
      }),
    };
  } catch (error) {
    console.error("Error fetching FX prices:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: "Failed to fetch FX prices",
      }),
    };
  }
};
```

### 3. Get Latest FX Prices

`netlify/functions/fx-latest.js`:

```javascript
const { executeQuery } = require("./utils/db");

exports.handler = async (event, context) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  try {
    const {
      symbols, // comma-separated list
      timeframe = "daily",
      broker = "OANDA",
    } = event.queryStringParameters || {};

    const validTimeframes = [
      "1min",
      "5min",
      "1hour",
      "4hour",
      "12hour",
      "daily",
      "weekly",
      "monthly",
      "yearly",
    ];
    if (!validTimeframes.includes(timeframe)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: `Invalid timeframe for latest prices. Valid options: ${validTimeframes.join(
            ", "
          )}`,
        }),
      };
    }

    let query;
    let queryParams = [broker];

    if (symbols) {
      const symbolList = symbols.split(",").map((s) => s.trim());
      const placeholders = symbolList.map((_, i) => `$${i + 2}`).join(",");

      query = `
        WITH latest_prices AS (
          SELECT DISTINCT ON (a.symbol) 
            a.symbol,
            p.timestamp,
            p.open,
            p.high, 
            p.low,
            p.close,
            p.volume,
            e.name as broker
          FROM prices_ohlcv_${timeframe} p
          JOIN assets a ON p.asset_id = a.id
          JOIN asset_types at ON a.asset_type_id = at.id
          JOIN exchanges e ON a.exchange_id = e.id
          WHERE at.name = 'FX'
            AND e.name = $1
            AND a.symbol IN (${placeholders})
          ORDER BY a.symbol, p.timestamp DESC
        )
        SELECT * FROM latest_prices ORDER BY symbol
      `;
      queryParams.push(...symbolList);
    } else {
      // Get latest for all FX symbols from the broker
      query = `
        WITH latest_prices AS (
          SELECT DISTINCT ON (a.symbol) 
            a.symbol,
            p.timestamp,
            p.open,
            p.high, 
            p.low,
            p.close,
            p.volume,
            e.name as broker
          FROM prices_ohlcv_${timeframe} p
          JOIN assets a ON p.asset_id = a.id
          JOIN asset_types at ON a.asset_type_id = at.id
          JOIN exchanges e ON a.exchange_id = e.id
          WHERE at.name = 'FX'
            AND e.name = $1
          ORDER BY a.symbol, p.timestamp DESC
        )
        SELECT * FROM latest_prices ORDER BY symbol
      `;
    }

    const latestPrices = await executeQuery(query, queryParams);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        timeframe,
        broker,
        count: latestPrices.length,
        data: latestPrices,
      }),
    };
  } catch (error) {
    console.error("Error fetching latest FX prices:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: "Failed to fetch latest FX prices",
      }),
    };
  }
};
```

### 4. Get Multiple Timeframes

`netlify/functions/fx-multi-timeframe.js`:

```javascript
const { executeQuery } = require("./utils/db");

exports.handler = async (event, context) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  try {
    const {
      symbol,
      timeframes = "1hour,daily", // comma-separated
      broker = "OANDA",
      limit = "100",
    } = event.queryStringParameters || {};

    if (!symbol) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: "Symbol parameter is required",
        }),
      };
    }

    const timeframeList = timeframes.split(",").map((tf) => tf.trim());
    const validTimeframes = [
      "1min",
      "5min",
      "1hour",
      "4hour",
      "12hour",
      "daily",
      "weekly",
      "monthly",
      "yearly",
    ];

    const invalidTimeframes = timeframeList.filter(
      (tf) => !validTimeframes.includes(tf)
    );
    if (invalidTimeframes.length > 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: `Invalid timeframes: ${invalidTimeframes.join(", ")}`,
        }),
      };
    }

    const results = {};

    // Fetch data for each timeframe
    for (const timeframe of timeframeList) {
      const query = `
        SELECT p.timestamp, p.open, p.high, p.low, p.close, p.volume
        FROM prices_ohlcv_${timeframe} p
        JOIN assets a ON p.asset_id = a.id
        JOIN asset_types at ON a.asset_type_id = at.id
        JOIN exchanges e ON a.exchange_id = e.id
        WHERE a.symbol = $1 
          AND at.name = 'FX'
          AND e.name = $2
        ORDER BY p.timestamp DESC
        LIMIT $3
      `;

      const data = await executeQuery(query, [symbol, broker, parseInt(limit)]);
      results[timeframe] = data;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        symbol,
        broker,
        timeframes: timeframeList,
        data: results,
      }),
    };
  } catch (error) {
    console.error("Error fetching multi-timeframe data:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: "Failed to fetch multi-timeframe data",
      }),
    };
  }
};
```

### 5. Get Available Brokers

`netlify/functions/fx-brokers.js`:

```javascript
const { executeQuery } = require("./utils/db");

exports.handler = async (event, context) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  try {
    const query = `
      SELECT DISTINCT e.name as broker, e.country, COUNT(a.id) as symbol_count
      FROM exchanges e
      JOIN assets a ON e.id = a.exchange_id
      JOIN asset_types at ON a.asset_type_id = at.id
      WHERE at.name = 'FX'
      GROUP BY e.name, e.country
      ORDER BY symbol_count DESC, e.name
    `;

    const brokers = await executeQuery(query);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        count: brokers.length,
        data: brokers,
      }),
    };
  } catch (error) {
    console.error("Error fetching brokers:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: "Failed to fetch brokers",
      }),
    };
  }
};
```

## Frontend JavaScript Usage Examples

### Basic Price Fetching

```javascript
class FXPriceAPI {
  constructor(baseURL = "/.netlify/functions") {
    this.baseURL = baseURL;
  }

  async getSymbols(broker = "OANDA") {
    const response = await fetch(`${this.baseURL}/fx-symbols?broker=${broker}`);
    return await response.json();
  }

  async getPrices(symbol, options = {}) {
    const {
      timeframe = "daily",
      broker = "OANDA",
      startDate,
      endDate,
      limit = 1000,
    } = options;

    let url = `${this.baseURL}/fx-prices?symbol=${symbol}&timeframe=${timeframe}&broker=${broker}&limit=${limit}`;

    if (startDate) url += `&start_date=${startDate}`;
    if (endDate) url += `&end_date=${endDate}`;

    const response = await fetch(url);
    return await response.json();
  }

  async getLatestPrices(symbols = null, timeframe = "daily", broker = "OANDA") {
    let url = `${this.baseURL}/fx-latest?timeframe=${timeframe}&broker=${broker}`;
    if (symbols) url += `&symbols=${symbols.join(",")}`;

    const response = await fetch(url);
    return await response.json();
  }

  async getMultiTimeframe(
    symbol,
    timeframes = ["1hour", "daily"],
    broker = "OANDA"
  ) {
    const url = `${
      this.baseURL
    }/fx-multi-timeframe?symbol=${symbol}&timeframes=${timeframes.join(
      ","
    )}&broker=${broker}`;
    const response = await fetch(url);
    return await response.json();
  }

  async getBrokers() {
    const response = await fetch(`${this.baseURL}/fx-brokers`);
    return await response.json();
  }
}

// Usage examples
const api = new FXPriceAPI();

// Get all OANDA FX symbols
const symbols = await api.getSymbols("OANDA");
console.log("Available symbols:", symbols.data);

// Get daily EUR/USD prices for last 30 days
const eurUsdDaily = await api.getPrices("EURUSD", {
  timeframe: "daily",
  limit: 30,
});

// Get latest prices for major pairs
const latestPrices = await api.getLatestPrices(["EURUSD", "GBPUSD", "USDJPY"]);

// Get multiple timeframes for EUR/USD
const multiTF = await api.getMultiTimeframe("EURUSD", ["1hour", "daily"]);
```

### React Hook Example

```javascript
import { useState, useEffect } from "react";

const useFXPrices = (symbol, timeframe = "daily", broker = "OANDA") => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        setLoading(true);
        const response = await fetch(
          `/.netlify/functions/fx-prices?symbol=${symbol}&timeframe=${timeframe}&broker=${broker}`
        );
        const result = await response.json();

        if (result.success) {
          setData(result.data);
          setError(null);
        } else {
          setError(result.error);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (symbol) {
      fetchPrices();
    }
  }, [symbol, timeframe, broker]);

  return { data, loading, error };
};

// Component usage
const PriceChart = ({ symbol }) => {
  const { data, loading, error } = useFXPrices(symbol, "daily");

  if (loading) return <div>Loading prices...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h3>{symbol} Daily Prices</h3>
      {data?.map((price) => (
        <div key={price.timestamp}>
          {price.timestamp}: {price.close}
        </div>
      ))}
    </div>
  );
};
```

## API Endpoints Summary

| Endpoint              | Method | Purpose                  | Parameters                                                         |
| --------------------- | ------ | ------------------------ | ------------------------------------------------------------------ |
| `/fx-symbols`         | GET    | Get available FX symbols | `broker` (default: OANDA)                                          |
| `/fx-prices`          | GET    | Get OHLCV price data     | `symbol`, `timeframe`, `broker`, `start_date`, `end_date`, `limit` |
| `/fx-latest`          | GET    | Get latest prices        | `symbols`, `timeframe`, `broker`                                   |
| `/fx-multi-timeframe` | GET    | Get multiple timeframes  | `symbol`, `timeframes`, `broker`, `limit`                          |
| `/fx-brokers`         | GET    | Get available brokers    | None                                                               |

## Query Parameters Reference

### Common Parameters

- `symbol` - FX pair symbol (e.g., 'EURUSD', 'GBPJPY')
- `timeframe` - Data frequency ('1min', '1hour', 'daily', etc.)
- `broker` - Data provider (default: 'OANDA')
- `limit` - Maximum records to return (default: 1000)
- `start_date` - Start date (ISO format: '2025-01-01')
- `end_date` - End date (ISO format: '2025-12-31')

### Available Timeframes

- `tick` - Individual price ticks (bid/ask/spread)
- `1min` - 1-minute OHLCV bars
- `5min` - 5-minute OHLCV bars
- `1hour` - 1-hour OHLCV bars
- `4hour` - 4-hour OHLCV bars
- `12hour` - 12-hour OHLCV bars
- `daily` - Daily OHLCV bars
- `weekly` - Weekly OHLCV bars
- `monthly` - Monthly OHLCV bars
- `yearly` - Yearly OHLCV bars

## Response Format Examples

### FX Prices Response

```json
{
  "success": true,
  "symbol": "EURUSD",
  "timeframe": "daily",
  "broker": "OANDA",
  "count": 100,
  "data": [
    {
      "timestamp": "2025-01-15T00:00:00.000Z",
      "open": 1.0432,
      "high": 1.0456,
      "low": 1.0398,
      "close": 1.0445,
      "volume": 125000,
      "symbol": "EURUSD",
      "broker": "OANDA"
    }
  ]
}
```

### Latest Prices Response

```json
{
  "success": true,
  "timeframe": "daily",
  "broker": "OANDA",
  "count": 3,
  "data": [
    {
      "symbol": "EURUSD",
      "timestamp": "2025-01-15T00:00:00.000Z",
      "open": 1.0432,
      "high": 1.0456,
      "low": 1.0398,
      "close": 1.0445,
      "volume": 125000,
      "broker": "OANDA"
    }
  ]
}
```

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error description"
}
```

Common HTTP status codes:

- `200` - Success
- `400` - Bad Request (invalid parameters)
- `500` - Internal Server Error (database/server issues)

## Performance Optimization

### Database Indexes

Ensure these indexes exist for optimal performance:

```sql
-- Composite indexes for price queries
CREATE INDEX idx_prices_ohlcv_daily_asset_timestamp ON prices_ohlcv_daily(asset_id, timestamp DESC);
CREATE INDEX idx_prices_ohlcv_1hour_asset_timestamp ON prices_ohlcv_1hour(asset_id, timestamp DESC);
CREATE INDEX idx_prices_ohlcv_1min_asset_timestamp ON prices_ohlcv_1min(asset_id, timestamp DESC);

-- Asset lookup optimization
CREATE INDEX idx_assets_symbol_exchange ON assets(symbol, exchange_id, asset_type_id);
```

### Caching Strategy

Consider implementing caching for frequently requested data:

```javascript
// Add to your Netlify functions
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const getCachedData = (key) => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  cache.delete(key);
  return null;
};

const setCachedData = (key, data) => {
  cache.set(key, { data, timestamp: Date.now() });
};
```

This guide provides a complete foundation for building FX price APIs that can efficiently serve data to frontend applications with support for multiple brokers, timeframes, and query patterns.
