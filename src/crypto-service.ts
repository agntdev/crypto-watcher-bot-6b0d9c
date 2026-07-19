import type { Ctx } from "./bot.js";

export interface PriceData {
  ticker: string;
  price: string;
  change24h: number;
  marketCap: string;
  volume24h: string;
  lastUpdated: string;
}

export interface CoinGeckoPrice {
  [coinId: string]: {
    [currency: string]: {
      usd: number;
      eur: number;
      gbp: number;
      btc: number;
      eth: number;
    };
  };
}

// Map common tickers to CoinGecko IDs
const TICKER_TO_COINGECKO: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  ADA: "cardano",
  DOT: "polkadot",
  AVAX: "avalanche-2",
  LINK: "chainlink",
  MATIC: "matic-network",
  DOGE: "dogecoin",
  XRP: "ripple",
  UNI: "uniswap",
  LTC: "litecoin",
  BNB: "binancecoin",
  TRX: "tron",
  SHIB: "shiba-inu",
  ATOM: "cosmos",
  FIL: "filecoin",
  APT: "aptos",
  ARB: "arbitrum",
};

const COINGECKO_TO_TICKER: Record<string, string> = {};
for (const [ticker, id] of Object.entries(TICKER_TO_COINGECKO)) {
  COINGECKO_TO_TICKER[id] = ticker;
}

// CoinGecko free API rate limit: 10-30 calls/minute
const COINGECKO_BASE_URL = "https://api.coingecko.com/api/v3";

export async function fetchPrice(
  ticker: string,
  currency: string = "usd"
): Promise<PriceData | null> {
  try {
    const coinId = TICKER_TO_COINGECKO[ticker.toUpperCase()];
    if (!coinId) {
      return null;
    }

    const response = await fetch(
      `${COINGECKO_BASE_URL}/simple/price?ids=${coinId}&vs_currencies=${currency}&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`
    );

    if (!response.ok) {
      console.error(`CoinGecko API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const coinData = data[coinId];
    if (!coinData) {
      return null;
    }

    const price = coinData[currency];
    const change24h = coinData[`${currency}_24h_change`];
    const marketCap = coinData[`${currency}_market_cap`];
    const volume24h = coinData[`${currency}_24h_vol`];

    return {
      ticker: ticker.toUpperCase(),
      price: formatPrice(price, currency),
      change24h: change24h ? parseFloat(change24h.toFixed(2)) : 0,
      marketCap: formatMarketCap(marketCap),
      volume24h: formatMarketCap(volume24h),
      lastUpdated: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`Error fetching price for ${ticker}:`, error);
    return null;
  }
}

export async function fetchMultiplePrices(
  tickers: string[],
  currency: string = "usd"
): Promise<PriceData[]> {
  try {
    const coinIds = tickers
      .map((t) => TICKER_TO_COINGECKO[t.toUpperCase()])
      .filter(Boolean)
      .join(",");

    if (!coinIds) {
      return [];
    }

    const response = await fetch(
      `${COINGECKO_BASE_URL}/simple/price?ids=${coinIds}&vs_currencies=${currency}&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`
    );

    if (!response.ok) {
      console.error(`CoinGecko API error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const results: PriceData[] = [];

    for (const ticker of tickers) {
      const coinId = TICKER_TO_COINGECKO[ticker.toUpperCase()];
      if (!coinId || !data[coinId]) continue;

      const coinData = data[coinId];
      const price = coinData[currency];
      const change24h = coinData[`${currency}_24h_change`];
      const marketCap = coinData[`${currency}_market_cap`];
      const volume24h = coinData[`${currency}_24h_vol`];

      results.push({
        ticker: ticker.toUpperCase(),
        price: formatPrice(price, currency),
        change24h: change24h ? parseFloat(change24h.toFixed(2)) : 0,
        marketCap: formatMarketCap(marketCap),
        volume24h: formatMarketCap(volume24h),
        lastUpdated: new Date().toISOString(),
      });
    }

    return results;
  } catch (error) {
    console.error("Error fetching multiple prices:", error);
    return [];
  }
}

function formatPrice(price: number, currency: string): string {
  if (price >= 1000) {
    return price.toLocaleString("en-US", { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    });
  } else if (price >= 1) {
    return price.toFixed(2);
  } else {
    return price.toFixed(4);
  }
}

function formatMarketCap(value: number): string {
  if (value >= 1e12) {
    return `$${(value / 1e12).toFixed(2)}T`;
  } else if (value >= 1e9) {
    return `$${(value / 1e9).toFixed(2)}B`;
  } else if (value >= 1e6) {
    return `$${(value / 1e6).toFixed(2)}M`;
  } else {
    return `$${value.toLocaleString()}`;
  }
}

// Search for coins by ticker or name
export async function searchCoin(query: string): Promise<{ id: string; symbol: string; name: string }[]> {
  try {
    const response = await fetch(
      `${COINGECKO_BASE_URL}/search?query=${encodeURIComponent(query)}`
    );

    if (!response.ok) {
      console.error(`CoinGecko search error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    return data.coins.slice(0, 5).map((coin: any) => ({
      id: coin.id,
      symbol: coin.symbol.toUpperCase(),
      name: coin.name,
    }));
  } catch (error) {
    console.error("Error searching coins:", error);
    return [];
  }
}

// Check if a ticker exists
export async function isValidTicker(ticker: string): Promise<boolean> {
  const coinId = TICKER_TO_COINGECKO[ticker.toUpperCase()];
  if (!coinId) return false;
  
  const price = await fetchPrice(ticker);
  return price !== null;
}
