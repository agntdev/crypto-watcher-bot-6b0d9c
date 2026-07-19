import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { fetchPrice, fetchMultiplePrices } from "../crypto-service.js";
import { getWatchlist } from "../storage-service.js";

const composer = new Composer<Ctx>();

// Handle /price command with optional ticker argument
composer.command("price", async (ctx) => {
  const text = ctx.message?.text || "";
  const parts = text.split(/\s+/);
  const ticker = parts.length > 1 ? parts[1].toUpperCase() : undefined;
  
  if (ticker) {
    await showPriceForTicker(ctx, ticker, false);
  } else {
    await showWatchlistPrices(ctx, false);
  }
});

// Handle price:check callback from main menu
composer.callbackQuery("price:check", async (ctx) => {
  await ctx.answerCallbackQuery();
  await showWatchlistPrices(ctx, true);
});

async function showWatchlistPrices(ctx: Ctx, editMessage: boolean) {
  if (!ctx.from) return;
  
  // Fetch watchlist from storage
  const watchlist = getWatchlist(ctx.from.id.toString());
  
  if (watchlist.length === 0) {
    const text = "💰 No coins in your watchlist.\n\nTap ➕ Add Coin to add some cryptocurrencies.";
    if (editMessage) {
      await ctx.editMessageText(text, {
        reply_markup: inlineKeyboard([[inlineButton("➕ Add Coin", "watchlist:add")]])
      });
    } else {
      await ctx.reply(text, {
        reply_markup: inlineKeyboard([[inlineButton("➕ Add Coin", "watchlist:add")]])
      });
    }
    return;
  }
  
  // Fetch real prices from CoinGecko API
  const tickers = watchlist.map(item => item.ticker);
  const prices = await fetchMultiplePrices(tickers, ctx.session.currency || "USD");
  
  if (prices.length === 0) {
    const text = "💰 Couldn't fetch prices right now. Please try again later.";
    if (editMessage) {
      await ctx.editMessageText(text, {
        reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]])
      });
    } else {
      await ctx.reply(text, {
        reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]])
      });
    }
    return;
  }
  
  const lines = prices.map(item => {
    const change = item.change24h 
      ? (item.change24h >= 0 ? `+${item.change24h}%` : `${item.change24h}%`)
      : "";
    return `${item.ticker}: ${item.price} ${change}`;
  });
  
  const text = `💰 Current prices:\n\n${lines.join("\n")}`;
  
  const rows = prices.map(item => [
    inlineButton(`${item.ticker} details`, `price:detail:${item.ticker}`)
  ]);
  rows.push([inlineButton("⬅️ Back to menu", "menu:main")]);
  
  if (editMessage) {
    await ctx.editMessageText(text, { reply_markup: inlineKeyboard(rows) });
  } else {
    await ctx.reply(text, { reply_markup: inlineKeyboard(rows) });
  }
}

async function showPriceForTicker(ctx: Ctx, ticker: string, editMessage: boolean) {
  const priceData = await fetchPrice(ticker, ctx.session.currency || "USD");
  
  if (!priceData) {
    const text = `❌ Couldn't find price for ${ticker}. Check the ticker symbol and try again.`;
    if (editMessage) {
      await ctx.editMessageText(text, {
        reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]])
      });
    } else {
      await ctx.reply(text, {
        reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]])
      });
    }
    return;
  }
  
  const change = priceData.change24h 
    ? (priceData.change24h >= 0 ? `+${priceData.change24h}%` : `${priceData.change24h}%`)
    : "";
  
  const text = 
    `💰 ${ticker} price:\n\n` +
    `Current: ${priceData.price}\n` +
    `24h change: ${change}\n` +
    `Market cap: ${priceData.marketCap || "N/A"}`;
  
  const rows = [
    [inlineButton("🔔 Set alert", `alerts:coin:${ticker}`)],
    [inlineButton("➕ Add to watchlist", `watchlist:add:${ticker}`)],
    [inlineButton("⬅️ Back to menu", "menu:main")]
  ];
  
  if (editMessage) {
    await ctx.editMessageText(text, { reply_markup: inlineKeyboard(rows) });
  } else {
    await ctx.reply(text, { reply_markup: inlineKeyboard(rows) });
  }
}

// Handle ticker detail callback
composer.callbackQuery(/^price:detail:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const ticker = ctx.match[1];
  await showPriceForTicker(ctx, ticker, true);
});

export default composer;
