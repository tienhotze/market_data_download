# Database Schema: `indicator_values`

This table stores time series indicator values (e.g., economic data) with unique constraints and tracking columns.

## Table: `indicator_values`

| Column            | Type                     | Nullable | Default                            | Description                           |
| ----------------- | ------------------------ | -------- | ---------------------------------- | ------------------------------------- |
| id                | integer                  | No       | nextval('indicator_values_id_seq') | Primary key (auto-increment)          |
| series_id         | text                     | No       |                                    | Foreign key to indicator_mapping      |
| date              | date                     | No       |                                    | Date of the value                     |
| value             | numeric                  | No       |                                    | Value for the indicator               |
| created_at        | timestamp with time zone | Yes      | now()                              | Row creation timestamp                |
| updated_at        | timestamp with time zone | Yes      | now()                              | Row update timestamp                  |
| source_updated_at | date                     | Yes      |                                    | Date value was last updated at source |
| pct_change_1m     | numeric                  | Yes      |                                    | 1-month percent change                |
| pct_change_12m    | numeric                  | Yes      |                                    | 12-month percent change               |

## Indexes & Constraints

- **Primary Key:** `id`
- **Unique Constraint:** (`series_id`, `date`)
- **Index:** (`series_id`, `date`)

---

> **Note:** `series_id` must exist in the `indicator_mapping` table (foreign key constraint).

# Database Schema: `indicator_mapping`

This table maps indicator series IDs to human-readable labels, source, and metadata.

## Table: `indicator_mapping`

| Column              | Type    | Nullable | Default | Description                                                     |
| ------------------- | ------- | -------- | ------- | --------------------------------------------------------------- |
| series_id           | text    | No       |         | Primary key. Unique series identifier.                          |
| label               | text    | No       |         | Human-readable label for the indicator.                         |
| source              | text    | No       |         | Data source (e.g., BLS, FRED, etc.).                            |
| seasonally_adjusted | boolean | Yes      |         | Whether the series is seasonally adjusted.                      |
| indicator_category  | text    | Yes      |         | Category/grouping of the indicator.                             |
| period_id           | integer | Yes      |         | Foreign key to period_lookup (frequency, e.g. monthly, weekly). |
| unit_id             | integer | Yes      |         | Foreign key to unit_lookup (unit of measurement).               |

## Indexes & Constraints

- **Primary Key:** `series_id`
- **Foreign Key:** `period_id` → `period_lookup(id)`
- **Foreign Key:** `unit_id` → `unit_lookup(id)`

---

# Database Schema: `period_lookup`

This table defines the available time frequencies for indicators (e.g., monthly, weekly).

## Table: `period_lookup`

| Column             | Type    | Nullable | Default                         | Description                                    |
| ------------------ | ------- | -------- | ------------------------------- | ---------------------------------------------- |
| id                 | integer | No       | nextval('period_lookup_id_seq') | Primary key (auto-increment)                   |
| name               | text    | No       |                                 | Name of the period (e.g., 'monthly', 'weekly') |
| api_frequency_code | text    | Yes      |                                 | Code used by APIs for this period              |

## Indexes & Constraints

- **Primary Key:** `id`
- **Unique Constraint:** `api_frequency_code`
- **Unique Constraint:** `name`

---

# Database Schema: `unit_lookup`

This table defines the available units of measurement for indicators.

## Table: `unit_lookup`

| Column         | Type    | Nullable | Default                       | Description                               |
| -------------- | ------- | -------- | ----------------------------- | ----------------------------------------- |
| id             | integer | No       | nextval('unit_lookup_id_seq') | Primary key (auto-increment)              |
| name           | text    | No       |                               | Name of the unit (e.g., 'persons', 'USD') |
| symbol         | text    | Yes      |                               | Symbol for the unit (e.g., '$')           |
| display_format | text    | Yes      |                               | Format string for displaying values       |

## Indexes & Constraints

- **Primary Key:** `id`
- **Unique Constraint:** `name`
