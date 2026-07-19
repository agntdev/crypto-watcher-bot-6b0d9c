import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { getWatchlist } from "../storage-service.js";

const composer = new Composer<Ctx>();

// Show watchlist from /list command
composer.command("list", async (ctx) => {
  await showWatchlist(ctx);
});

// Show watchlist from main menu button
composer.callbackQuery("watchlist:list", async (ctx) => {
  await ctx.answerCallbackQuery();
  await showWatchlist(ctx, true);
});

async function showWatchlist(ctx: Ctx, editMessage = false) {
  if (!ctx.from) return;
  
  // Fetch watchlist from storage
  const watchlist = getWatchlist(ctx.from.id.toString());
  
  if (watchlist.length === 0) {
    const text = "📋 Your watchlist is empty.\n\nTap ➕ Add Coin to add your first cryptocurrency.";
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
  
  // Fetch real prices for watchlist items
  const tickers = watchlist.map(item => item.ticker);
  const { fetchMultiplePrices } = await import("../crypto-service.js");
  const prices = await fetchMultiplePrices(tickers, ctx.session.currency || "USD");
  
  // Build watchlist display
  const lines = watchlist.map(item => {
    const priceData = prices.find(p => p.ticker === item.ticker);
    const price = priceData ? priceData.price : "Loading...";
    const change = priceData?.change24h 
      ? (priceData.change24h >= 0 ? `+${priceData.change24h}%` : `${priceData.change24h}%`)
      : "";
    const alertStatus = item.displayName ? "🔔" : "🔕";
    return `${alertStatus} ${item.ticker} — ${price} ${change}`;
  });
  
  const text = `📋 Your watchlist:\n\n${lines.join("\n")}\n\nTap a coin to manage its alerts.`;
  
  // Build keyboard with coin buttons
  const rows = watchlist.map(item => [
    inlineButton(`${item.ticker} — Manage`, `watchlist:manage:${item.ticker}`)
  ]);
  rows.push([inlineButton("➕ Add Coin", "watchlist:add")]);
  rows.push([inlineButton("⬅️ Back to menu", "menu:main")]);
  
  if (editMessage) {
    await ctx.editMessageText(text, { reply_markup: inlineKeyboard(rows) });
  } else {
    await ctx.reply(text, { reply_markup: inlineKeyboard(rows) });
  }
}

export default composer;
