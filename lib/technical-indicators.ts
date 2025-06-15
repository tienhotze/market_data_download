export interface TechnicalData {
  date: string
  price: number
  sma: number | null
  upperBand: number | null
  lowerBand: number | null
  rsi: number | null
}

export function calculateSMA(prices: number[], period: number): (number | null)[] {
  const sma: (number | null)[] = []

  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      sma.push(null)
    } else {
      const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0)
      sma.push(sum / period)
    }
  }

  return sma
}

export function calculateStandardDeviation(prices: number[], period: number): (number | null)[] {
  const stdDev: (number | null)[] = []

  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      stdDev.push(null)
    } else {
      const slice = prices.slice(i - period + 1, i + 1)
      const mean = slice.reduce((a, b) => a + b, 0) / period
      const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period
      stdDev.push(Math.sqrt(variance))
    }
  }

  return stdDev
}

export function calculateBollingerBands(prices: number[], period = 21, multiplier = 2) {
  const sma = calculateSMA(prices, period)
  const stdDev = calculateStandardDeviation(prices, period)

  const upperBand = sma.map((avg, i) => (avg !== null && stdDev[i] !== null ? avg + stdDev[i]! * multiplier : null))

  const lowerBand = sma.map((avg, i) => (avg !== null && stdDev[i] !== null ? avg - stdDev[i]! * multiplier : null))

  return { sma, upperBand, lowerBand }
}

export function calculateRSI(prices: number[], period = 14): (number | null)[] {
  const rsi: (number | null)[] = []
  const gains: number[] = []
  const losses: number[] = []

  // Calculate price changes
  for (let i = 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1]
    gains.push(change > 0 ? change : 0)
    losses.push(change < 0 ? Math.abs(change) : 0)
  }

  // Calculate RSI
  for (let i = 0; i < prices.length; i++) {
    if (i < period) {
      rsi.push(null)
    } else {
      const avgGain = gains.slice(i - period, i).reduce((a, b) => a + b, 0) / period
      const avgLoss = losses.slice(i - period, i).reduce((a, b) => a + b, 0) / period

      if (avgLoss === 0) {
        rsi.push(100)
      } else {
        const rs = avgGain / avgLoss
        const rsiValue = 100 - 100 / (1 + rs)
        rsi.push(rsiValue)
      }
    }
  }

  return rsi
}

export function prepareTechnicalData(priceData: any[], maPeriod = 21, rsiPeriod = 14): TechnicalData[] {
  // Sort by date ascending for calculations
  const sortedData = [...priceData].sort((a, b) => new Date(a.Date).getTime() - new Date(b.Date).getTime())

  const prices = sortedData.map((d) => d.Close)
  const dates = sortedData.map((d) => d.Date)

  const { sma, upperBand, lowerBand } = calculateBollingerBands(prices, maPeriod)
  const rsi = calculateRSI(prices, rsiPeriod)

  return sortedData.map((item, index) => ({
    date: item.Date,
    price: item.Close,
    sma: sma[index],
    upperBand: upperBand[index],
    lowerBand: lowerBand[index],
    rsi: rsi[index],
  }))
}

export function getPriceDistribution(prices: number[], bins = 20) {
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const binSize = (max - min) / bins

  const distribution = Array(bins)
    .fill(0)
    .map((_, i) => ({
      range: `${(min + i * binSize).toFixed(2)}-${(min + (i + 1) * binSize).toFixed(2)}`,
      count: 0,
      midpoint: min + (i + 0.5) * binSize,
    }))

  prices.forEach((price) => {
    const binIndex = Math.min(Math.floor((price - min) / binSize), bins - 1)
    distribution[binIndex].count++
  })

  return distribution
}
