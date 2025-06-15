export interface TickerData {
  symbol: string
  name: string
  exchange?: string
  type?: string
}

export interface NewsItem {
  title: string
  summary: string
  url: string
  published: string
  source: string
}

export interface ResearchItem {
  title: string
  summary: string
  url: string
  published: string
  source: string
  analyst?: string
  rating?: string
}

export interface EventData {
  id: string
  name: string
  date: string
  category: string
  description: string
}
