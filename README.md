# Market Wizard 🧙‍♂️📈

*Advanced Market Data Analysis & Event Correlation Platform*

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/tienhotzes-projects/v0-follow-prd-guidelines)
[![Built with v0](https://img.shields.io/badge/Built%20with-v0.dev-black?style=for-the-badge)](https://v0.dev/chat/projects/AbvcNeY5Mtu)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)

## 🎯 Overview

Market Wizard is a sophisticated financial analysis platform that correlates market events with asset price movements. Built with Next.js 14 and TypeScript, it provides real-time market data analysis, event correlation, and advanced charting capabilities.

## ✨ Key Features

### 📊 **Market Data Analysis**
- **Real-time Price Tracking**: Live data for stocks, commodities, currencies, and indices
- **Historical Analysis**: Access to extensive historical price data
- **Technical Indicators**: RSI, Moving Averages, Bollinger Bands, and more
- **Multi-Asset Comparison**: Side-by-side analysis of different assets

### 🎯 **Event Correlation**
- **Economic Events**: Fed meetings, employment reports, inflation data
- **Geopolitical Events**: Elections, policy changes, international relations
- **Market Events**: Earnings, IPOs, mergers & acquisitions
- **Custom Event Analysis**: Add and analyze your own market events

### 🚀 **Smart Data Management**
- **Intelligent Caching**: IndexedDB storage with automatic freshness checks
- **GitHub Integration**: Persistent data storage and sharing
- **API Throttling**: Smart rate limiting (max 3 attempts per asset)
- **Fallback Sources**: Multiple data providers for reliability

### 📈 **Advanced Charting**
- **Interactive Charts**: Zoom, pan, and explore price movements
- **Event Overlays**: Visualize events directly on price charts
- **Multi-Event Analysis**: Compare multiple events simultaneously
- **Responsive Design**: Works seamlessly on desktop and mobile

## 🛠️ Technology Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui components
- **Charts**: Recharts for interactive visualizations
- **Storage**: IndexedDB for client-side caching
- **APIs**: Yahoo Finance, Alpha Vantage, GitHub API
- **Deployment**: Vercel with automatic CI/CD

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- GitHub account (for data storage)

### Installation

\`\`\`bash
# Clone the repository
git clone https://github.com/yourusername/market-wizard.git
cd market-wizard

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your API keys

# Run development server
npm run dev
\`\`\`

### Environment Variables

\`\`\`env
# GitHub Integration (Required)
GITHUB_TOKEN=your_github_personal_access_token

# Optional: Custom domain for API calls
NEXT_PUBLIC_APP_URL=http://localhost:3000
\`\`\`

## 📖 Usage Guide

### 🔍 **Asset Search & Analysis**
1. **Search Assets**: Use the search bar to find stocks, ETFs, commodities
2. **View Status**: Check data freshness and cache status
3. **Refresh Data**: Click "Refresh Cache" to update with latest prices
4. **Analyze Trends**: View charts with technical indicators

### 📅 **Event Analysis**
1. **Navigate to Events**: Go to `/event-analysis` page
2. **Select Events**: Choose from predefined economic/political events
3. **Multi-Event Mode**: Compare multiple events simultaneously
4. **Subgroup Selection**: Use "Select All" for event categories
5. **Visualize Impact**: See event markers on price charts

### 💾 **Data Management**
- **Auto-Caching**: Data automatically cached for 6 hours
- **Smart Refresh**: GitHub first, then Yahoo Finance fallback
- **Failure Handling**: Max 3 API attempts with 5-minute cooldown
- **Storage Stats**: Monitor cache usage and performance

## 🏗️ Project Structure

\`\`\`
market-wizard/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   ├── download/      # Yahoo Finance data fetching
│   │   ├── asset-data/    # Asset status and caching
│   │   └── event-data/    # Event correlation data
│   ├── event-analysis/    # Event analysis page
│   └── page.tsx          # Main dashboard
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   ├── charts-tab.tsx    # Chart visualization
│   ├── asset-status-table.tsx # Asset monitoring
│   └── multi-event-chart.tsx  # Event correlation
├── lib/                  # Utility libraries
│   ├── indexeddb.ts     # Client-side storage
│   ├── technical-indicators.ts # Chart analysis
│   └── date-utils.ts    # Date formatting
├── data/                 # Cached market data
└── scripts/             # Python data scripts
\`\`\`

## 🔌 API Reference

### Asset Data Endpoints

\`\`\`typescript
// Get asset status and cache info
GET /api/asset-data
Response: {
  assets: Array<{
    ticker: string;
    lastPrice: number;
    lastDate: string;
    status: 'fresh' | 'stale' | 'missing' | 'failed';
    cacheAge: string;
    dataPoints: number;
    attempts?: number;
  }>
}

// Download fresh market data
POST /api/download
Body: {
  ticker: string;
  period: string;
  interval: string;
}
\`\`\`

### Event Data Endpoints

\`\`\`typescript
// Get event correlation data
GET /api/event-data?events=fed_meeting,jobs_report
Response: {
  events: Array<{
    date: string;
    title: string;
    type: string;
    impact: 'high' | 'medium' | 'low';
  }>
}
\`\`\`

## 📊 Supported Assets

### **Stocks & ETFs**
- S&P 500 (^GSPC)
- Individual stocks (AAPL, MSFT, etc.)
- Sector ETFs and index funds

### **Commodities**
- Crude Oil (CL=F)
- Gold (GC=F)
- Silver, Copper, Natural Gas

### **Currencies**
- US Dollar Index (DX-Y.NYB)
- Major forex pairs

### **Fixed Income**
- 10-Year Treasury (^TNX)
- Bond ETFs and yields

### **Volatility**
- VIX (^VIX)
- Volatility indices

## 🎯 Event Categories

### **Economic Events**
- Federal Reserve meetings and decisions
- Employment reports (NFP, unemployment)
- Inflation data (CPI, PPI)
- GDP releases and revisions

### **Geopolitical Events**
- Presidential elections
- Policy announcements
- International trade developments
- Regulatory changes

### **Market Events**
- Earnings announcements
- IPO launches
- Merger & acquisition activity
- Market volatility events

## 🔧 Configuration

### **Cache Settings**
\`\`\`typescript
// Adjust cache freshness thresholds
const CACHE_SETTINGS = {
  FRESH_THRESHOLD: 6 * 60 * 60 * 1000,  // 6 hours
  STALE_THRESHOLD: 24 * 60 * 60 * 1000, // 24 hours
  MAX_RETRIES: 3,                       // API attempts
  COOLDOWN_PERIOD: 5 * 60 * 1000        // 5 minutes
};
\`\`\`

### **Chart Customization**
\`\`\`typescript
// Modify chart appearance
const CHART_CONFIG = {
  colors: {
    primary: '#2563eb',
    secondary: '#64748b',
    success: '#16a34a',
    warning: '#ca8a04',
    danger: '#dc2626'
  },
  indicators: ['RSI', 'SMA', 'EMA', 'BOLLINGER']
};
\`\`\`

## 🚀 Deployment

### **Vercel (Recommended)**
\`\`\`bash
# Deploy with Vercel CLI
npm i -g vercel
vercel

# Or use the Deploy button in v0 interface
\`\`\`

### **Manual Deployment**
\`\`\`bash
# Build for production
npm run build

# Start production server
npm start
\`\`\`

## 🤝 Contributing

1. **Fork the repository**
2. **Create feature branch**: `git checkout -b feature/amazing-feature`
3. **Commit changes**: `git commit -m 'Add amazing feature'`
4. **Push to branch**: `git push origin feature/amazing-feature`
5. **Open Pull Request**

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Yahoo Finance** for market data API
- **shadcn/ui** for beautiful UI components
- **Recharts** for interactive charting
- **Vercel** for seamless deployment
- **v0.dev** for rapid development platform

## 📞 Support

- **Documentation**: [GitHub Wiki](https://github.com/yourusername/market-wizard/wiki)
- **Issues**: [GitHub Issues](https://github.com/yourusername/market-wizard/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/market-wizard/discussions)

---

**Built with ❤️ using [v0.dev](https://v0.dev) - The AI-powered development platform**
