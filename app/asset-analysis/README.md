# Asset Analysis Page

This page allows users to chart and analyze asset prices against economic indicators.

## Features

- Chart single or multiple assets (e.g., WTI crude oil).
- Chart economic indicators (e.g., CPI).
- Apply transformations:
  - Percent change (`(p1/p0) - 1`)
  - Simple price change (`p1 - p0`)
- Adjustable period for transformations (1-10000 days, weeks, etc.).
- View underlying data in a table below the chart.

## Data Source

- Connects to a PostgreSQL database at `192.53.174.253:5432`.
- Fetches from `asset_prices` and `indicator_values` tables.

## API Endpoint

- `/api/asset-analysis`
  - **assets**: Comma-separated list of tickers (e.g., `WTI,CPI`).
  - **transformation**: `percent` or `simple`.
  - **period**: Integer for the lookback period.
  - **frequency**: `D`, `W`, or `M`.
