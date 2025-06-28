console.log("RUNNING get-db-assets.ts - DEBUG VERSION");
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var pg_1 = require("pg");
var pool = new pg_1.Pool({
    user: 'postgres',
    host: process.env.PG_HOST || '192.53.174.253',
    database: 'asset_prices',
    password: process.env.PG_PASSWORD,
    port: process.env.PG_PORT ? parseInt(process.env.PG_PORT, 10) : 5432,
});
var ASSET_SYMBOLS = ['WTI', 'Gold', 'VIX', 'DXY Index'];
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var _i, ASSET_SYMBOLS_1, symbol, assetRes, asset, priceRes, err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 6, 7, 9]);
                    console.log('Successfully connected to asset_prices database.');
                    _i = 0, ASSET_SYMBOLS_1 = ASSET_SYMBOLS;
                    _a.label = 1;
                case 1:
                    if (!(_i < ASSET_SYMBOLS_1.length)) return [3 /*break*/, 5];
                    symbol = ASSET_SYMBOLS_1[_i];
                    return [4 /*yield*/, pool.query('SELECT id, name FROM assets WHERE symbol = $1', [symbol])];
                case 2:
                    assetRes = _a.sent();
                    if (assetRes.rows.length === 0) {
                        console.log("Asset not found for symbol: ".concat(symbol));
                        return [3 /*break*/, 4];
                    }
                    asset = assetRes.rows[0];
                    return [4 /*yield*/, pool.query('SELECT timestamp, close FROM prices_ohlcv_daily WHERE asset_id = $1 ORDER BY timestamp ASC', [asset.id])];
                case 3:
                    priceRes = _a.sent();
                    console.log("\nAsset: ".concat(symbol, " (").concat(asset.name, ")"));
                    console.log("  Data points: ".concat(priceRes.rows.length));
                    if (priceRes.rows.length > 0) {
                        console.log("  Date range: ".concat(priceRes.rows[0].timestamp.toISOString().split('T')[0], " to ").concat(priceRes.rows[priceRes.rows.length - 1].timestamp.toISOString().split('T')[0]));
                    }
                    else {
                        console.log('  No price data found.');
                    }
                    _a.label = 4;
                case 4:
                    _i++;
                    return [3 /*break*/, 1];
                case 5: return [3 /*break*/, 9];
                case 6:
                    err_1 = _a.sent();
                    console.error('Error querying assets from the database:', err_1);
                    return [3 /*break*/, 9];
                case 7: return [4 /*yield*/, pool.end()];
                case 8:
                    _a.sent();
                    console.log('Database connection released.');
                    return [7 /*endfinally*/];
                case 9: return [2 /*return*/];
            }
        });
    });
}
main();
