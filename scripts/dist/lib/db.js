"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assetPricesPool = exports.economicDataPool = exports.worldEventsPool = void 0;
var pg_1 = require("pg");
// IMPORTANT: Ensure you have a .env.local file with these variables
var economicDataPool = new pg_1.Pool({
    user: 'postgres',
    host: process.env.PG_HOST || '192.53.174.253',
    database: 'economic_data',
    password: process.env.PG_PASSWORD,
    port: process.env.PG_PORT ? parseInt(process.env.PG_PORT, 10) : 5432,
});
exports.economicDataPool = economicDataPool;
var assetPricesPool = new pg_1.Pool({
    user: 'postgres',
    host: process.env.PG_HOST || '192.53.174.253',
    database: 'asset_prices',
    password: process.env.PG_PASSWORD,
    port: process.env.PG_PORT ? parseInt(process.env.PG_PORT, 10) : 5432,
});
exports.assetPricesPool = assetPricesPool;
exports.worldEventsPool = new pg_1.Pool({
    user: process.env.PG_USER,
    host: process.env.PG_HOST,
    database: process.env.PG_WORLD_EVENTS_DATABASE,
    password: process.env.PG_PASSWORD,
    port: parseInt(process.env.PG_PORT || "5432"),
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});
