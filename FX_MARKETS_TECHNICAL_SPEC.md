# FX Markets Page - Technical Specification

## Overview

This document outlines the implementation plan for adding a new FX markets page to display analytics for currency pairs from OANDA, including funding rates from a postgres database and a cross-correlation matrix for all 68 currency pairs.

## Database Schema

Based on the provided schema, we'll be working with the `funding_rates` table in the `asset_prices` database:

```sql
CREATE TABLE funding_rates (
    id SERIAL PRIMARY KEY,
    asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    broker_id INTEGER NOT NULL REFERENCES exchanges(id) ON DELETE CASCADE,
    "timestamp" TIMESTAMPTZ NOT NULL,
    long_rate DECIMAL(10, 6), -- Funding rate for long positions (can be negative)
    short_rate DECIMAL(10, 6), -- Funding rate for short positions (can be negative)
    effective_date DATE NOT NULL, -- Date when this rate becomes effective
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Ensure no duplicate entries for same asset/broker/effective_date
    UNIQUE (asset_id, broker_id, effective_date)
);
```

## API Routes

### 1. Funding Rates API

**Endpoint:** `/api/fx/funding-rates`
**Method:** GET
**Parameters:**

- `broker` (optional): Filter by broker (default: OANDA)
- `symbols` (optional): Comma-separated list of currency pair symbols
- `limit` (optional): Number of records to return (default: 100)

**Response:**

```json
{
  "data": [
    {
      "symbol": "EURUSD",
      "broker": "OANDA",
      "long_rate": 0.0015,
      "short_rate": -0.002,
      "effective_date": "2025-08-09",
      "timestamp": "2025-08-09T10:30:00Z"
    }
  ]
}
```

### 2. Correlation Matrix API

**Endpoint:** `/api/fx/correlation-matrix`
**Method:** GET
**Parameters:**

- `days` (optional): Number of days for correlation calculation (default: 30)
- `symbols` (optional): Comma-separated list of currency pair symbols (default: all FX pairs)

**Response:**

```json
{
  "assets": ["EURUSD", "GBPUSD", "USDJPY", ...],
  "matrix": [
    [1.0, 0.75, -0.2],
    [0.75, 1.0, -0.3],
    [-0.2, -0.3, 1.0]
  ]
}
```

## UI Components

### 1. FX Markets Page (`app/fx-markets/page.tsx`)

- Navigation header with back button
- Tabbed interface for different analytics views:
  - Funding Rates
  - Correlation Matrix
- Loading states and error handling

### 2. Funding Rates Panel

- Data table showing funding rates for currency pairs
- Columns: Symbol, Long Rate, Short Rate, Effective Date
- Filtering by currency pair
- Sorting capabilities

### 3. Correlation Matrix Panel

- Interactive heatmap visualization
- Time period selector (30 days, 90 days, custom)
- Color-coded correlation values (red for negative, green for positive)
- Clickable cells to view detailed pair analysis

## Implementation Steps

### Step 1: Database Connection

- Extend `lib/db.ts` to include connection to `asset_prices` database
- Create helper functions for querying funding rates

### Step 2: API Routes

- Create `/api/fx/funding-rates/route.ts` for funding rates data
- Create `/api/fx/correlation-matrix/route.ts` for correlation calculations

### Step 3: UI Components

- Create the main FX markets page component
- Implement funding rates display panel
- Implement correlation matrix visualization
- Add time period selection controls

### Step 4: Data Processing

- Implement correlation calculation algorithm
- Create data transformation functions for visualization
- Add caching mechanisms for performance optimization

### Step 5: Testing and Optimization

- Test with sample data
- Optimize database queries
- Implement error handling
- Add loading states and user feedback

## Technical Considerations

### Performance Optimization

- Implement server-side pagination for funding rates
- Cache correlation matrix calculations
- Use database indexes for efficient querying
- Implement client-side data virtualization for large tables

### Error Handling

- Database connection failures
- Missing data scenarios
- API request timeouts
- Invalid parameter handling

### Security

- Validate all API parameters
- Implement proper database connection pooling
- Use environment variables for database credentials
- Implement rate limiting for API endpoints

## Dependencies

- `pg` for PostgreSQL database connections
- `react-plotly.js` for correlation matrix visualization
- `next/dynamic` for dynamic component imports
- Existing UI components from the project

## File Structure

```
app/
  fx-markets/
    page.tsx
    loading.tsx
    README.md
api/
  fx/
    funding-rates/
      route.ts
    correlation-matrix/
      route.ts
lib/
  fx-utils.ts
components/
  fx/
    funding-rates-panel.tsx
    correlation-matrix-panel.tsx
    time-period-selector.tsx
```
