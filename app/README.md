# Market Wizard

Market Wizard is a comprehensive financial analysis platform for market data, events, economic indicators, and global military/aid spending. It provides tools for downloading, visualizing, and analyzing financial and geopolitical data.

## Main Pages

| Page              | Path                 | Description                                  | Data Source                                          |
| ----------------- | -------------------- | -------------------------------------------- | ---------------------------------------------------- |
| Home              | `/`                  | Dashboard and navigation                     | -                                                    |
| Market Data       | `/market-data`       | Download and analyze market data             | `asset_prices` DB                                    |
| Asset Analysis    | `/asset-analysis`    | Chart asset prices against economic data     | `asset_prices` & `economic_data` DBs                 |
| Event Analysis    | `/event-analysis`    | Analyze market performance around key events | Local file (`/app/event-analysis/default-events.js`) |
| Economic Analysis | `/economic-analysis` | Track and forecast economic indicators       | `economic_data` DB                                   |
| Military Spending | `/military-spending` | Track US military/aid spending by country    | Mock Data (in API route)                             |

## App Architecture

```mermaid
graph TD
    subgraph "User Interface (Next.js)"
        A[Home Page]
        B[Market Data Page]
        C[Asset Analysis Page]
        D[Event Analysis Page]
        E[Economic Analysis Page]
        F[Military Spending Page]
    end

    subgraph "API Routes"
        G[/api/asset-data]
        H[/api/economic-data]
        I[/api/events]
        J[/api/military-spending]
    end

    subgraph "Data Sources"
        K[Database: asset_prices]
        L[Database: economic_data]
        M[Local File: default-events.js]
        N[Mock Data: military-spending API]
    end

    A --> B & C & D & E & F
    B --> G
    C --> G & H
    D --> I
    E --> H
    F --> J

    G --> K
    H --> L
    I --> M
    J --> N
```

## Database Schemas

Database connection details are managed in `lib/db.ts` and configured via `.env.local`.

### `economic_data` Database

- **`indicator_mapping`**: Maps indicator IDs to human-readable names.
- **`indicator_values`**: Time series data for each economic indicator.
- **`period_lookup`**: Defines periods (e.g., monthly, quarterly).
- **`unit_lookup`**: Defines units for indicator values (e.g., %, USD Billions).

### `asset_prices` Database

- **`assets`**: Core asset information (symbol, name, etc.).
- **`asset_types`**, **`asset_subtypes`**: Categories for assets.
- **`exchanges`**: Information about exchanges.
- **`prices_ohlcv_*`**: A series of tables containing OHLCV (Open, High, Low, Close, Volume) data at various frequencies (e.g., `_daily`, `_hourly`).
- **`prices_tick`**: Tick-level price data.

#### assets Table

| Column | Type    | Description                        |
| ------ | ------- | ---------------------------------- |
| id     | integer | Primary key                        |
| symbol | text    | Asset symbol (e.g., 'WTI', 'Gold') |
| name   | text    | Asset name                         |

#### prices_ohlcv_daily Table

| Column    | Type                     | Description              |
| --------- | ------------------------ | ------------------------ |
| asset_id  | integer                  | Foreign key to assets.id |
| timestamp | timestamp with time zone | Price timestamp          |
| open      | numeric                  | Opening price            |
| high      | numeric                  | High price               |
| low       | numeric                  | Low price                |
| close     | numeric                  | Closing price            |
| volume    | bigint                   | Trading volume           |

## Development

The development server runs on port 3000 by default.

```bash
npm install
npm run dev
```

To run on a different port, use `npm run dev -- -p <port_number>`.
