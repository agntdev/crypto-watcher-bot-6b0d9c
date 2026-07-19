import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { fetchPrice, searchCoin, isValidTicker } from "../crypto-service.js";
import { addToWatchlist, getWatchlist } from "../storage-service.js";

const composer = new Composer<Ctx>();

// Popular coins for quick selection
const POPULAR_COINS = [
  { ticker: "BTC", name: "Bitcoin" },
  { ticker: "ETH", name: "Ethereum" },
  { ticker: "SOL", name: "Solana" },
  { ticker: "ADA", name: "Cardano" },
  { ticker: "DOT", name: "Polkadot" },
  { ticker: "AVAX", name: "Avalanche" },
  { ticker: "LINK", name: "Chainlink" },
  { ticker: "MATIC", name: "Polygon" },
];

// Show coin selection dialog
composer.callbackQuery("watchlist:add", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.watchlist_add_step = "select_coin";
  
  // Build keyboard with popular coins
  const rows = POPULAR_COINS.map(coin => [
    inlineButton(`${coin.name} (${coin.ticker})`, `watchlist:add:${coin.ticker}`)
  ]);
  rows.push([inlineButton("✏️ Enter custom ticker", "watchlist:add:custom")]);
  rows.push([inlineButton("⬅️ Back to menu", "menu:main")]);
  
  await ctx.editMessageText("Choose a cryptocurrency to add to your watchlist:", {
    reply_markup: inlineKeyboard(rows)
  });
});

// Handle coin selection
composer.callbackQuery(/^watchlist:add:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const ticker = ctx.match[1];
  
  if (ticker === "custom") {
    ctx.session.watchlist_add_step = "custom_ticker";
    await ctx.editMessageText("Enter the ticker symbol (e.g., DOGE, XRP, UNI):");
    await ctx.reply("Type ticker symbol:", {
      reply_markup: { force_reply: true, input_field_placeholder: "Type ticker symbol…" }
    });
    return;
  }
  
  // Confirm addition with price check
  await ctx.editMessageText(`Adding ${ticker} to your watchlist...\n\nFetching current price...`);
  
  // Fetch real price from CoinGecko API
  const priceData = await fetchPrice(ticker, ctx.session.currency || "USD");
  
  if (priceData) {
    // Store in watchlist
    addToWatchlist(ctx.from.id.toString(), {
      ticker: ticker,
      addedAt: new Date().toISOString(),
    });
    
    await ctx.editMessageText(
      `✅ ${ticker} added to your watchlist!\n\n` +
      `Current price: ${priceData.price}\n` +
      `24h change: ${priceData.change24h >= 0 ? `+${priceData.change24h}%` : `${priceData.change24h}%`}\n\n` +
      "Tap a button below to continue.",
      { reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]) }
    );
  } else {
    await ctx.editMessageText(
      `❌ Couldn't find price for ${ticker}. Check the ticker symbol and try again.`,
      { reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]) }
    );
  }
});

// Handle custom ticker input
composer.on("message:text", async (ctx, next) => {
  if (ctx.session.watchlist_add_step !== "custom_ticker") return next();
  
  const ticker = ctx.message.text.trim().toUpperCase();
  if (ticker.length < 1 || ticker.length > 10) {
    await ctx.reply("Please enter a valid ticker symbol (1-10 characters).");
    return;
  }
  
  ctx.session.watchlist_add_step = undefined;
  await ctx.reply(`Adding ${ticker} to your watchlist...`);
  
  const priceData = await fetchPrice(ticker, ctx.session.currency || "USD");
  
  if (priceData) {
    // Store in watchlist
    addToWatchlist(ctx.from.id.toString(), {
      ticker: ticker,
      addedAt: new Date().toISOString(),
    });
    
    await ctx.reply(
      `✅ ${ticker} added to your watchlist!\n\n` +
      `Current price: ${priceData.price}\n` +
      `24h change: ${priceData.change24h >= 0 ? `+${priceData.change24h}%` : `${priceData.change24h}%`}\n\n` +
      "Tap a button below to continue.",
      { reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]) }
    );
  } else {
    await ctx.reply(
      `❌ Couldn't find price for ${ticker}. Check the ticker symbol and try again.`,
      { reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]) }
    );
  }
});

export default composer;
