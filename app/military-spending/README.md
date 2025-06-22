# Military Spending Tracker Page

This page allows users to track US military spending and foreign aid, starting with grants and aid to Israel by year.

## Features

- Annual and YTD breakdown of US aid to Israel (2015-2025)
- Totals for military, economic, and humanitarian aid
- Data table with sources and notes
- Data sourced from `/api/military-spending` (mocked or database-backed)

## Data Dependencies

- Military aid data is fetched from the API and visualized using custom React components and tables.

## Table Schema (`military_aid_data`)

| Column           | Type    | Description                     |
| ---------------- | ------- | ------------------------------- |
| year             | INTEGER | Calendar year                   |
| country          | TEXT    | Country receiving aid           |
| military_aid     | FLOAT   | Military aid (billions USD)     |
| economic_aid     | FLOAT   | Economic aid (billions USD)     |
| humanitarian_aid | FLOAT   | Humanitarian aid (billions USD) |
| total            | FLOAT   | Total aid (billions USD)        |
| source           | TEXT    | Data source                     |
| notes            | TEXT    | Additional notes (optional)     |

## Update Policy

- Always update this README after pushing new features or changes to this page.
