import type {
  Asset,
  ExchangeData,
  PortfolioSummary,
  AssetPerformance,
  PLByAssetClass,
  TopPerformer,
  Recommendation,
  DiversificationTip,
  Transaction,
} from "./types";

export const portfolioSummary: PortfolioSummary = {
  totalValue: 125430.5,
  totalProfitLoss: 12830.1,
  realizedPnl: 0,
  dailyChange: -1567.88,
  dailyChangePercentage: -1.25,
};

export const assets: Asset[] = [
  {
    id: "1",
    name: "Bitcoin",
    symbol: "BTC",
    quantity: 1.5,
    avgBuyPrice: 28533.33,
    currentPrice: 30000,
    value: 45000,
    pl: 5200,
    plPercentage: 5.2,
    assetClass: "crypto",
    exchange: "binance",
  },
  {
    id: "2",
    name: "Ethereum",
    symbol: "ETH",
    quantity: 10.2,
    avgBuyPrice: 2725.49,
    currentPrice: 3000,
    value: 30600,
    pl: 2800,
    plPercentage: 3.8,
    assetClass: "crypto",
    exchange: "binance",
  },
  {
    id: "3",
    name: "Solana",
    symbol: "SOL",
    quantity: 150,
    avgBuyPrice: 107.67,
    currentPrice: 100,
    value: 15000,
    pl: -1150.7,
    plPercentage: -7.1,
    assetClass: "crypto",
    exchange: "okx",
  },
  {
    id: "4",
    name: "EUR/USD",
    symbol: "EURUSD",
    quantity: 10000,
    avgBuyPrice: 1.05,
    currentPrice: 1.085,
    value: 10850,
    pl: 350,
    plPercentage: 3.3,
    assetClass: "forex",
    exchange: "metatrader",
  },
  {
    id: "5",
    name: "GBP/USD",
    symbol: "GBPUSD",
    quantity: 5000,
    avgBuyPrice: 1.294,
    currentPrice: 1.27,
    value: 6350,
    pl: -120,
    plPercentage: -1.9,
    assetClass: "forex",
    exchange: "metatrader",
  },
  {
    id: "6",
    name: "Gold",
    symbol: "XAU",
    quantity: 5,
    avgBuyPrice: 1956.1,
    currentPrice: 2046.1,
    value: 10230.5,
    pl: 450.5,
    plPercentage: 1.5,
    assetClass: "commodities",
    exchange: "metatrader",
  },
  {
    id: "7",
    name: "Silver",
    symbol: "XAG",
    quantity: 100,
    avgBuyPrice: 23,
    currentPrice: 24,
    value: 2400,
    pl: 100,
    plPercentage: 4.3,
    assetClass: "commodities",
    exchange: "metatrader",
  },
  {
    id: "8",
    name: "Cardano",
    symbol: "ADA",
    quantity: 5000,
    avgBuyPrice: 0.44,
    currentPrice: 0.5,
    value: 2500,
    pl: 300,
    plPercentage: 13.6,
    assetClass: "crypto",
    exchange: "kraken",
  },
  {
    id: "9",
    name: "Polkadot",
    symbol: "DOT",
    quantity: 200,
    avgBuyPrice: 7.5,
    currentPrice: 7,
    value: 1400,
    pl: -100,
    plPercentage: -6.7,
    assetClass: "crypto",
    exchange: "mexc",
  },
  {
    id: "10",
    name: "Crude Oil",
    symbol: "WTI",
    quantity: 10,
    avgBuyPrice: 105,
    currentPrice: 110,
    value: 1100,
    pl: 50,
    plPercentage: 4.8,
    assetClass: "commodities",
    exchange: "metatrader",
  },
];

export const exchangeData: ExchangeData[] = [
  {
    name: "Binance",
    id: "binance",
    assets: assets.filter((a) => a.exchange === "binance"),
    totalValue: assets
      .filter((a) => a.exchange === "binance")
      .reduce((sum, a) => sum + a.value, 0),
  },
  {
    name: "OKX",
    id: "okx",
    assets: assets.filter((a) => a.exchange === "okx"),
    totalValue: assets
      .filter((a) => a.exchange === "okx")
      .reduce((sum, a) => sum + a.value, 0),
  },
  {
    name: "MetaTrader",
    id: "metatrader",
    assets: assets.filter((a) => a.exchange === "metatrader"),
    totalValue: assets
      .filter((a) => a.exchange === "metatrader")
      .reduce((sum, a) => sum + a.value, 0),
  },
  {
    name: "MEXC",
    id: "mexc",
    assets: assets.filter((a) => a.exchange === "mexc"),
    totalValue: assets
      .filter((a) => a.exchange === "mexc")
      .reduce((sum, a) => sum + a.value, 0),
  },
  {
    name: "Kraken",
    id: "kraken",
    assets: assets.filter((a) => a.exchange === "kraken"),
    totalValue: assets
      .filter((a) => a.exchange === "kraken")
      .reduce((sum, a) => sum + a.value, 0),
  },
];

export const assetPerformance: AssetPerformance[] = [
  {
    name: "Bitcoin",
    symbol: "BTC",
    color: "#00d9ff",
    data: [
      { day: "Day 1", value: 64500 },
      { day: "Day 2", value: 65200 },
      { day: "Day 3", value: 64800 },
      { day: "Day 4", value: 65100 },
      { day: "Day 5", value: 66200 },
      { day: "Day 6", value: 67100 },
      { day: "Day 7", value: 68500 },
    ],
  },
  {
    name: "Ethereum",
    symbol: "ETH",
    color: "#a855f7",
    data: [
      { day: "Day 1", value: 2900 },
      { day: "Day 2", value: 2950 },
      { day: "Day 3", value: 2920 },
      { day: "Day 4", value: 2980 },
      { day: "Day 5", value: 3010 },
      { day: "Day 6", value: 3050 },
      { day: "Day 7", value: 3100 },
    ],
  },
];

export const plByAssetClass: PLByAssetClass[] = [
  { assetClass: "crypto", profitLoss: 7050, color: "#00d9ff" },
  { assetClass: "forex", profitLoss: 230, color: "#a855f7" },
  { assetClass: "commodities", profitLoss: 600.5, color: "#f59e0b" },
];

export const topPerformers: TopPerformer[] = [
  { name: "Bitcoin", symbol: "BTC", changePercentage: 5.2 },
  { name: "Ethereum", symbol: "ETH", changePercentage: 3.8 },
  { name: "XAU/USD", symbol: "Gold", changePercentage: 1.5 },
];

export const recommendations: Recommendation[] = [
  {
    type: "buy",
    asset: "AAPL",
    reason: "Strong growth potential due to new product launches.",
  },
  {
    type: "hold",
    asset: "GOOGL",
    reason: "Stable performance with consistent market position.",
  },
  {
    type: "sell",
    asset: "NFLX",
    reason: "Declining market share in a competitive landscape.",
  },
];

export const diversificationTips: DiversificationTip[] = [
  {
    type: "success",
    message: "Add Gold to reduce volatility and hedge against inflation.",
  },
  {
    type: "warning",
    message: "Consider investing in emerging markets for higher growth potential.",
  },
];

export const transactions: Transaction[] = [
  {
    id: "1",
    date: "2024-12-25",
    type: "buy",
    asset: "Bitcoin",
    symbol: "BTC",
    quantity: 0.5,
    price: 68500,
    total: 34250,
    exchange: "binance",
  },
  {
    id: "2",
    date: "2024-12-24",
    type: "sell",
    asset: "Ethereum",
    symbol: "ETH",
    quantity: 2.0,
    price: 3100,
    total: 6200,
    exchange: "binance",
  },
  {
    id: "3",
    date: "2024-12-23",
    type: "buy",
    asset: "Gold",
    symbol: "XAU",
    quantity: 2,
    price: 2046,
    total: 4092,
    exchange: "metatrader",
  },
  {
    id: "4",
    date: "2024-12-22",
    type: "transfer",
    asset: "Solana",
    symbol: "SOL",
    quantity: 50,
    price: 100,
    total: 5000,
    exchange: "okx",
  },
  {
    id: "5",
    date: "2024-12-21",
    type: "buy",
    asset: "EUR/USD",
    symbol: "EURUSD",
    quantity: 5000,
    price: 1.085,
    total: 5425,
    exchange: "metatrader",
  },
];

