# Cross-Correlation & Beta Analysis

This page provides comprehensive analysis of cross-correlations and betas between multiple financial assets from the asset_prices database.

## Features

### Asset Selection

- **Multi-asset Selection**: Choose from all available assets in the database via checkboxes
- **Asset Information**: Each asset displays:
  - Symbol and name
  - Timeframe (e.g., Daily)
  - Data source (e.g., Yahoo Finance, OANDA)
- **Selection Counter**: Shows how many assets are currently selected

### Analysis Configuration

- **Data Window**: Choose from predefined periods:
  - 1 Month, 3 Months, 6 Months, 12 Months
  - 2 Years, 5 Years, 10 Years
  - Custom (user-defined number of days)
- **Percent Change Periods**: Configure the lookback period for calculating returns
  - Formula: (t+n price / t price - 1)
  - Default: 1 period (daily returns)
  - Range: 1-30 periods

### Matrix Analysis

- **Correlation Matrix**: Shows pairwise correlations between all selected assets
  - Values range from -1 to +1
  - Color-coded heatmap (red = negative, yellow = neutral, green = positive)
- **Beta Matrix**: Shows sensitivity of each asset to others
  - Values typically range from -2 to +2
  - Color-coded heatmap (blue = negative, yellow = neutral, red = positive)
- **Interactive Cells**: Click any cell to view detailed analysis

### Detailed Analysis

When clicking on a matrix cell, the page displays:

#### Rolling Analysis Chart

- **Rolling Correlation/Beta**: Shows how the relationship between two assets has evolved over time
- **Configurable Window**: Use the same data window options as the main analysis
- **Time Series**: Displays the rolling metric over the selected period

#### Price Comparison Chart

- **Dual Y-Axis**: Shows both assets' prices on separate axes for easy comparison
- **Normalized Prices**: Both assets start at 100 for fair comparison
- **Time Windows**: Choose from 1 Year, 2 Years, 5 Years, or 10 Years
- **Interactive**: Hover for exact values and dates

## Technical Implementation

### Database Integration

- **PostgreSQL**: Uses the asset_prices database
- **Tables**:
  - `assets`: Asset metadata (id, symbol, name)
  - `prices_ohlcv_daily`: Daily price data (timestamp, close price)
- **Joins**: Links assets to their price data via asset_id

### API Endpoints

1. **`/api/assets`**: Fetches all available assets
2. **`/api/asset-data`**: Gets price data for a specific asset and time period
3. **`/api/rolling-analysis`**: Calculates rolling correlation/beta between two assets
4. **`/api/asset-prices`**: Fetches price data for comparison charts

### Statistical Calculations

- **Correlation**: Pearson correlation coefficient
- **Beta**: Linear regression beta (covariance / variance)
- **Percent Changes**: (current_price / previous_price - 1)
- **Rolling Windows**: Configurable window sizes for time series analysis

### Data Processing

- **Data Alignment**: Ensures both assets have data for the same dates
- **Missing Data Handling**: Filters out periods with incomplete data
- **Normalization**: Scales prices to start at 100 for comparison
- **Error Handling**: Graceful handling of insufficient data or API errors

## Usage Instructions

1. **Select Assets**: Choose 2 or more assets from the selection panel
2. **Configure Analysis**: Set data window and percent change periods
3. **Run Analysis**: Click "Run Analysis" to generate matrices
4. **Explore Results**: View correlation and beta matrices
5. **Drill Down**: Click any matrix cell for detailed analysis
6. **Adjust Views**: Change time windows for rolling analysis and price charts

## Error Handling

- **Insufficient Data**: Warns if less than 2 assets selected or insufficient overlapping data
- **API Errors**: Displays user-friendly error messages for database connection issues
- **Data Validation**: Ensures data quality and completeness before analysis

## Performance Considerations

- **Database Optimization**: Uses indexed queries for efficient data retrieval
- **Client-Side Processing**: Performs matrix calculations in the browser
- **Lazy Loading**: Only fetches detailed data when cells are clicked
- **Caching**: Reuses fetched data when possible

## Future Enhancements

- **Export Functionality**: Download matrices as CSV/Excel
- **Advanced Metrics**: Sharpe ratio, volatility analysis
- **Portfolio Analysis**: Optimal portfolio weights based on correlations
- **Real-time Updates**: Live data feeds for current market analysis
- **Custom Timeframes**: Support for intraday data and custom periods
