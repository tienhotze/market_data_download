# FX Markets Analytics Page

## Overview

The FX Markets Analytics page provides comprehensive analysis tools for foreign exchange markets, including funding rates from OANDA and cross-correlation matrices for currency pairs.

## Features

1. **Funding Rates Display** - View current funding rates for currency pairs from OANDA
2. **Cross-Correlation Matrix** - Analyze correlations between currency pairs with adjustable time periods
3. **Interactive Visualization** - Heatmap visualization of correlation matrix with color-coded values
4. **Time Period Selection** - Choose different analysis periods (30, 90, 180 days, or 1 year)

## Implementation Details

### Database Schema

The page uses the `funding_rates` table in the `asset_prices` database with the following schema:

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

### API Endpoints

1. **Funding Rates API** - `/api/fx/funding-rates`

   - Fetches funding rates from the postgres database
   - Supports filtering by broker (default: OANDA) and currency pairs

2. **Correlation Matrix API** - `/api/fx/correlation-matrix`
   - Calculates cross-correlation matrix for currency pairs
   - Supports adjustable time periods (default: 30 days)

### UI Components

1. **Main Page** - `app/fx-markets/page.tsx`

   - Tabbed interface for switching between funding rates and correlation matrix
   - Responsive design for mobile compatibility
   - Loading states and error handling

2. **Funding Rates Panel**

   - Data table showing funding rates for currency pairs
   - Columns: Symbol, Long Rate, Short Rate, Effective Date, Timestamp

3. **Correlation Matrix Panel**
   - Interactive heatmap visualization using Plotly.js
   - Time period selector for correlation analysis
   - Color-coded correlation values (red for negative, green for positive)

## Usage Instructions

### Accessing the Page

Navigate to `/fx-markets` to access the FX Markets Analytics page.

### Viewing Funding Rates

1. The funding rates tab displays current funding rates for currency pairs from OANDA
2. Click "Refresh Data" to fetch the latest funding rates

### Analyzing Correlation Matrix

1. Switch to the correlation matrix tab
2. Select a time period from the dropdown (30 days, 90 days, etc.)
3. Click "Calculate Matrix" to generate the correlation matrix
4. Hover over cells in the heatmap to view correlation values
5. The diagonal of the matrix will always show 1.0 (perfect correlation with itself)

## Technical Considerations

### Performance Optimization

- Database queries are optimized with appropriate indexes
- Correlation calculations are performed server-side for better performance
- Data is aligned to common dates for accurate correlation calculations

### Error Handling

- Database connection errors are handled gracefully
- API request errors are displayed to the user
- Missing data scenarios are handled appropriately

### Security

- Database credentials are stored in environment variables
- API parameters are validated to prevent injection attacks
- Rate limiting is implemented for API endpoints

## Dependencies

- `react-plotly.js` for correlation matrix visualization
- `next/dynamic` for dynamic component imports
- `pg` for PostgreSQL database connections
- Existing UI components from the project

## Testing

To test the FX Markets Analytics page:

1. Verify database connection to asset_prices database
2. Check that funding_rates table contains data
3. Test API endpoints with sample requests
4. Verify correlation calculations with known datasets
5. Check UI responsiveness on different devices
