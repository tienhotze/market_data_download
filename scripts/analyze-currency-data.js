const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

// Configuration
const ANALYSIS_DAYS = 730; // 2 years
const START_DATE = new Date();
START_DATE.setDate(START_DATE.getDate() - ANALYSIS_DAYS);

// Currency pairs to analyze (removed CADUSD as it's been deleted from DB)
const CURRENCY_PAIRS = [
  'AUDJPY', 'AUDUSD', 'EURUSD', 'NZDUSD', 
  'USDCAD', 'USDCNH', 'USDJPY', 'USDMXN', 'USDNOK', 
  'USDSGD', 'USDTHB'
];

class CurrencyDataAnalyzer {
  constructor() {
    this.pool = new Pool({
      user: process.env.PG_USER || 'postgres',
      host: process.env.PG_HOST,
      database: 'asset_prices',
      password: process.env.PG_PASSWORD,
      port: process.env.PG_PORT || 5432,
    });
    this.client = null;
    this.currencyData = {};
    this.percentageChanges = {};
    this.missingData = [];
    this.errorData = [];
    this.dateMatrix = {};
  }

  async connect() {
    try {
      this.client = await this.pool.connect();
      console.log('✅ Connected to asset_prices database.');
    } catch (err) {
      console.error('❌ Failed to connect to database:', err.message);
      throw err;
    }
  }

  async disconnect() {
    if (this.client) {
      this.client.release();
    }
    await this.pool.end();
    console.log('🔌 Disconnected from database.');
  }

  async getCurrencyData(symbol) {
    console.log(`📊 Fetching data for ${symbol}...`);
    
    const query = `
      SELECT 
        T2.timestamp as date,
        T2.close as price,
        T2.volume,
        T2.high,
        T2.low,
        T2.open
      FROM assets AS T1 
      JOIN prices_ohlcv_daily AS T2 ON T1.id = T2.asset_id 
      WHERE T1.symbol = $1 
        AND T2.timestamp >= $2
      ORDER BY T2.timestamp ASC
    `;

    try {
      const result = await this.client.query(query, [symbol, START_DATE]);
      console.log(`   Found ${result.rows.length} data points for ${symbol}`);
      
      return result.rows.map(row => ({
        date: new Date(row.date).toISOString().split('T')[0],
        price: parseFloat(row.price),
        volume: parseFloat(row.volume),
        high: parseFloat(row.high),
        low: parseFloat(row.low),
        open: parseFloat(row.open)
      }));
    } catch (err) {
      console.error(`❌ Error fetching data for ${symbol}:`, err.message);
      return [];
    }
  }

  calculatePercentageChanges(data, symbol) {
    console.log(`🔄 Calculating percentage changes for ${symbol}...`);
    
    const changes = [];
    const missingDates = [];
    const errorDates = [];

    for (let i = 1; i < data.length; i++) {
      const current = data[i];
      const previous = data[i - 1];
      
      // Check for missing or invalid data
      if (current.price === null || current.price === undefined || isNaN(current.price)) {
        missingDates.push({
          symbol,
          date: current.date,
          type: 'missing_price',
          value: current.price,
          current_high: current.high,
          current_low: current.low,
          current_open: current.open,
          current_volume: current.volume
        });
        continue;
      }

      if (previous.price === null || previous.price === undefined || isNaN(previous.price)) {
        missingDates.push({
          symbol,
          date: previous.date,
          type: 'missing_previous_price',
          value: previous.price,
          current_high: previous.high,
          current_low: previous.low,
          current_open: previous.open,
          current_volume: previous.volume
        });
        continue;
      }

      // Check for zero or negative prices (errors)
      if (current.price <= 0 || previous.price <= 0) {
        errorDates.push({
          symbol,
          date: current.date,
          type: 'invalid_price',
          current_price: current.price,
          previous_price: previous.price,
          current_high: current.high,
          current_low: current.low,
          current_open: current.open,
          current_volume: current.volume
        });
        continue;
      }

      // Check for extreme price movements (potential errors)
      const percentChange = ((current.price / previous.price) - 1) * 100;
      if (Math.abs(percentChange) > 50) { // More than 50% daily change
        errorDates.push({
          symbol,
          date: current.date,
          type: 'extreme_movement',
          current_price: current.price,
          previous_price: previous.price,
          percent_change: percentChange,
          current_high: current.high,
          current_low: current.low,
          current_open: current.open,
          current_volume: current.volume
        });
        continue;
      }

      // Calculate percentage change
      changes.push({
        date: current.date,
        symbol,
        percentChange,
        currentPrice: current.price,
        previousPrice: previous.price
      });
    }

    return { changes, missingDates, errorDates };
  }

  async analyzeAllCurrencies() {
    console.log(`🚀 Starting analysis for ${CURRENCY_PAIRS.length} currency pairs...`);
    console.log(`📅 Analysis period: ${START_DATE.toISOString().split('T')[0]} to ${new Date().toISOString().split('T')[0]}`);
    console.log(`📊 Total days: ${ANALYSIS_DAYS}\n`);

    // Fetch data for all currency pairs
    for (const symbol of CURRENCY_PAIRS) {
      const data = await this.getCurrencyData(symbol);
      this.currencyData[symbol] = data;
      
      if (data.length > 0) {
        const { changes, missingDates, errorDates } = this.calculatePercentageChanges(data, symbol);
        this.percentageChanges[symbol] = changes;
        this.missingData.push(...missingDates);
        this.errorData.push(...errorDates);
      } else {
        console.log(`⚠️  No data found for ${symbol}`);
      }
    }

    // Create date matrix
    this.createDateMatrix();
  }

  createDateMatrix() {
    console.log('📋 Creating date matrix...');
    
    // Get all unique dates from all currency pairs
    const allDates = new Set();
    Object.values(this.percentageChanges).forEach(changes => {
      changes.forEach(change => allDates.add(change.date));
    });

    const sortedDates = Array.from(allDates).sort();
    
    // Create matrix structure
    this.dateMatrix = {
      dates: sortedDates,
      currencies: CURRENCY_PAIRS,
      data: {}
    };

    // Fill matrix with percentage changes
    sortedDates.forEach(date => {
      this.dateMatrix.data[date] = {};
      CURRENCY_PAIRS.forEach(symbol => {
        const changeData = this.percentageChanges[symbol]?.find(c => c.date === date);
        this.dateMatrix.data[date][symbol] = changeData ? changeData.percentChange : null;
      });
    });

    console.log(`   Matrix created with ${sortedDates.length} dates and ${CURRENCY_PAIRS.length} currencies`);
  }

  generateReport() {
    console.log('\n' + '='.repeat(80));
    console.log('📈 CURRENCY DATA ANALYSIS REPORT');
    console.log('='.repeat(80));

    // Summary statistics
    console.log('\n📊 SUMMARY STATISTICS:');
    console.log('-'.repeat(50));
    CURRENCY_PAIRS.forEach(symbol => {
      const dataCount = this.currencyData[symbol]?.length || 0;
      const changeCount = this.percentageChanges[symbol]?.length || 0;
      console.log(`${symbol.padEnd(8)}: ${dataCount.toString().padStart(4)} data points, ${changeCount.toString().padStart(4)} changes`);
    });

    // Missing data report
    if (this.missingData.length > 0) {
      console.log('\n❌ MISSING DATA POINTS:');
      console.log('-'.repeat(50));
      console.table(this.missingData);
    } else {
      console.log('\n✅ No missing data points found!');
    }

    // Error data report
    if (this.errorData.length > 0) {
      console.log('\n⚠️  ERROR DATA POINTS:');
      console.log('-'.repeat(50));
      console.table(this.errorData);
    } else {
      console.log('\n✅ No error data points found!');
    }

    // Data completeness by currency
    console.log('\n📋 DATA COMPLETENESS BY CURRENCY:');
    console.log('-'.repeat(50));
    CURRENCY_PAIRS.forEach(symbol => {
      const totalPossible = this.dateMatrix.dates.length;
      const actualData = this.dateMatrix.dates.filter(date => 
        this.dateMatrix.data[date][symbol] !== null
      ).length;
      const completeness = ((actualData / totalPossible) * 100).toFixed(1);
      console.log(`${symbol.padEnd(8)}: ${actualData}/${totalPossible} (${completeness}%)`);
    });

    // Matrix sample
    console.log('\n📊 MATRIX SAMPLE (First 5 dates):');
    console.log('-'.repeat(50));
    const sampleDates = this.dateMatrix.dates.slice(0, 5);
    const sampleMatrix = sampleDates.map(date => {
      const row = { date };
      CURRENCY_PAIRS.forEach(symbol => {
        row[symbol] = this.dateMatrix.data[date][symbol]?.toFixed(4) || 'NULL';
      });
      return row;
    });
    console.table(sampleMatrix);

    // Save detailed reports
    this.saveDetailedReports();
  }

  saveDetailedReports() {
    const fs = require('fs');
    const path = require('path');
    
    const reportsDir = path.join(__dirname, 'reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // Save missing data as CSV
    if (this.missingData.length > 0) {
      const missingCsvFile = path.join(reportsDir, `missing-data-${timestamp}.csv`);
      const missingJsonFile = path.join(reportsDir, `missing-data-${timestamp}.json`);
      
      // Create CSV content
      const csvHeaders = ['symbol', 'date', 'type', 'value', 'current_high', 'current_low', 'current_open', 'current_volume'];
      const csvContent = [
        csvHeaders.join(','),
        ...this.missingData.map(item => 
          csvHeaders.map(header => {
            const value = item[header];
            return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
          }).join(',')
        )
      ].join('\n');
      
      fs.writeFileSync(missingCsvFile, csvContent);
      fs.writeFileSync(missingJsonFile, JSON.stringify(this.missingData, null, 2));
      console.log(`\n💾 Missing data saved to:`);
      console.log(`   CSV: ${missingCsvFile}`);
      console.log(`   JSON: ${missingJsonFile}`);
    }

    // Save error data as CSV
    if (this.errorData.length > 0) {
      const errorCsvFile = path.join(reportsDir, `error-data-${timestamp}.csv`);
      const errorJsonFile = path.join(reportsDir, `error-data-${timestamp}.json`);
      
      // Create CSV content for errors
      const errorCsvHeaders = ['symbol', 'date', 'type', 'current_price', 'previous_price', 'percent_change', 'current_high', 'current_low', 'current_open', 'current_volume'];
      const errorCsvContent = [
        errorCsvHeaders.join(','),
        ...this.errorData.map(item => 
          errorCsvHeaders.map(header => {
            const value = item[header];
            return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
          }).join(',')
        )
      ].join('\n');
      
      fs.writeFileSync(errorCsvFile, errorCsvContent);
      fs.writeFileSync(errorJsonFile, JSON.stringify(this.errorData, null, 2));
      console.log(`💾 Error data saved to:`);
      console.log(`   CSV: ${errorCsvFile}`);
      console.log(`   JSON: ${errorJsonFile}`);
    }

    // Save matrix data
    const matrixFile = path.join(reportsDir, `currency-matrix-${timestamp}.json`);
    fs.writeFileSync(matrixFile, JSON.stringify(this.dateMatrix, null, 2));
    console.log(`💾 Matrix data saved to: ${matrixFile}`);

    // Save summary report
    const summary = {
      timestamp: new Date().toISOString(),
      analysisPeriod: {
        start: START_DATE.toISOString(),
        end: new Date().toISOString(),
        days: ANALYSIS_DAYS
      },
      currencies: CURRENCY_PAIRS,
      statistics: CURRENCY_PAIRS.map(symbol => ({
        symbol,
        dataPoints: this.currencyData[symbol]?.length || 0,
        changes: this.percentageChanges[symbol]?.length || 0,
        missingCount: this.missingData.filter(m => m.symbol === symbol).length,
        errorCount: this.errorData.filter(e => e.symbol === symbol).length
      })),
      totals: {
        missingData: this.missingData.length,
        errorData: this.errorData.length,
        matrixDates: this.dateMatrix.dates.length,
        matrixCurrencies: this.dateMatrix.currencies.length
      }
    };

    const summaryFile = path.join(reportsDir, `analysis-summary-${timestamp}.json`);
    fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
    console.log(`💾 Summary report saved to: ${summaryFile}`);
  }
}

async function main() {
  const analyzer = new CurrencyDataAnalyzer();
  
  try {
    await analyzer.connect();
    await analyzer.analyzeAllCurrencies();
    analyzer.generateReport();
  } catch (err) {
    console.error('❌ Analysis failed:', err.message);
  } finally {
    await analyzer.disconnect();
  }
}

// Run the analysis
if (require.main === module) {
  main();
}

module.exports = { CurrencyDataAnalyzer, CURRENCY_PAIRS, ANALYSIS_DAYS };
