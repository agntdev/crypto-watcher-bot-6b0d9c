import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { addAlert, getAlerts } from "../storage-service.js";

const composer = new Composer<Ctx>();

// Start alert management flow
composer.callbackQuery("alerts:manage", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.alert_step = "select_coin";
  
  await ctx.editMessageText("Select a coin to configure alerts:", {
    reply_markup: inlineKeyboard([
      [inlineButton("BTC (Bitcoin)", "alerts:coin:BTC")],
      [inlineButton("ETH (Ethereum)", "alerts:coin:ETH")],
      [inlineButton("SOL (Solana)", "alerts:coin:SOL")],
      [inlineButton("ADA (Cardano)", "alerts:coin:ADA")],
      [inlineButton("Other coin", "alerts:coin:custom")],
      [inlineButton("⬅️ Back to menu", "menu:main")]
    ])
  });
});

// Handle coin selection
composer.callbackQuery(/^alerts:coin:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const ticker = ctx.match[1];
  
  if (ticker === "custom") {
    await ctx.editMessageText("Enter the ticker symbol:");
    await ctx.reply("Type the ticker symbol:", {
      reply_markup: { force_reply: true, input_field_placeholder: "Type ticker symbol…" }
    });
    ctx.session.alert_step = "custom_ticker";
    return;
  }
  
  ctx.session.alert_ticker = ticker;
  ctx.session.alert_step = "alert_type";
  
  await ctx.editMessageText(`Configure alerts for ${ticker}:`, {
    reply_markup: inlineKeyboard([
      [inlineButton("📈 Price threshold", "alerts:type:threshold")],
      [inlineButton("📊 Percent move", "alerts:type:percent_move")],
      [inlineButton("⬅️ Back", "alerts:manage")]
    ])
  });
});

// Handle alert type selection
composer.callbackQuery(/^alerts:type:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const alertType = ctx.match[1] as "threshold" | "percent_move";
  ctx.session.alert_type = alertType;
  ctx.session.alert_step = "set_parameters";
  
  if (alertType === "threshold") {
    await ctx.editMessageText(`Configure alerts for ${ctx.session.alert_ticker}:`);
    await ctx.reply(
      `Set price threshold for ${ctx.session.alert_ticker}:\n\n` +
      "Enter the price level that triggers the alert:",
      { reply_markup: { force_reply: true, input_field_placeholder: "Enter price…" } }
    );
  } else {
    await ctx.editMessageText(`Configure alerts for ${ctx.session.alert_ticker}:`);
    await ctx.reply(
      `Set percent move for ${ctx.session.alert_ticker}:\n\n` +
      "Enter the percentage change that triggers the alert (e.g., 5 for 5%):",
      { reply_markup: { force_reply: true, input_field_placeholder: "Enter percent…" } }
    );
  }
});

// Handle custom ticker input
composer.on("message:text", async (ctx, next) => {
  if (ctx.session.alert_step !== "custom_ticker") return next();
  
  const ticker = ctx.message.text.trim().toUpperCase();
  if (ticker.length < 1 || ticker.length > 10) {
    await ctx.reply("Please enter a valid ticker symbol (1-10 characters).");
    return;
  }
  
  ctx.session.alert_ticker = ticker;
  ctx.session.alert_step = "alert_type";
  
  await ctx.reply(`Configure alerts for ${ticker}:`, {
    reply_markup: inlineKeyboard([
      [inlineButton("📈 Price threshold", "alerts:type:threshold")],
      [inlineButton("📊 Percent move", "alerts:type:percent_move")],
      [inlineButton("⬅️ Back", "alerts:manage")]
    ])
  });
});

// Handle parameter input
composer.on("message:text", async (ctx, next) => {
  if (ctx.session.alert_step !== "set_parameters") return next();
  
  const text = ctx.message.text.trim();
  const value = parseFloat(text);
  
  if (isNaN(value) || value <= 0) {
    await ctx.reply("Please enter a valid positive number.");
    return;
  }
  
  if (ctx.session.alert_type === "threshold") {
    ctx.session.alert_threshold = value;
  } else {
    ctx.session.alert_percent = value;
  }
  
  ctx.session.alert_step = "direction";
  
  await ctx.reply(
    `Alert when ${ctx.session.alert_ticker} price is:`,
    {
      reply_markup: inlineKeyboard([
        [inlineButton("⬆️ Above threshold", "alerts:direction:above")],
        [inlineButton("⬇️ Below threshold", "alerts:direction:below")],
        [inlineButton("⬅️ Back", `alerts:type:${ctx.session.alert_type}`)]
      ])
    }
  );
});

// Handle direction selection
composer.callbackQuery(/^alerts:direction:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.alert_direction = ctx.match[1] as "above" | "below";
  ctx.session.alert_step = "enable";
  
  const condition = ctx.session.alert_direction === "above" ? "rises above" : "falls below";
  const value = ctx.session.alert_type === "threshold" 
    ? `${ctx.session.currency || "USD"} ${ctx.session.alert_threshold}`
    : `${ctx.session.alert_percent}%`;
  
  await ctx.editMessageText(
    `Alert configured:\n\n` +
    `Coin: ${ctx.session.alert_ticker}\n` +
    `Type: ${ctx.session.alert_type === "threshold" ? "Price threshold" : "Percent move"}\n` +
    `Condition: ${condition} ${value}\n\n` +
    "Enable this alert?",
    {
      reply_markup: inlineKeyboard([
        [inlineButton("✅ Enable", "alerts:enable:yes")],
        [inlineButton("❌ Disable", "alerts:enable:no")],
        [inlineButton("⬅️ Back", "alerts:direction:above")]
      ])
    }
  );
});

// Handle enable/disable
composer.callbackQuery(/^alerts:enable:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const enabled = ctx.match[1] === "yes";
  
  // Store alert in persistent storage
  const alertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  addAlert(ctx.from.id.toString(), {
    id: alertId,
    ticker: ctx.session.alert_ticker!,
    type: ctx.session.alert_type!,
    parameters: {
      threshold: ctx.session.alert_threshold,
      percent: ctx.session.alert_percent,
      direction: ctx.session.alert_direction!,
    },
    enabled: enabled,
    createdAt: new Date().toISOString(),
  });
  
  // In real implementation, save alert to persistent storage
  const status = enabled ? "enabled" : "disabled";
  await ctx.editMessageText(
    `✅ Alert ${status}!\n\n` +
    `You'll be notified when ${ctx.session.alert_ticker} ` +
    `${ctx.session.alert_direction === "above" ? "rises above" : "falls below"} ` +
    `${ctx.session.alert_type === "threshold" ? `${ctx.session.currency || "USD"} ${ctx.session.alert_threshold}` : `${ctx.session.alert_percent}%`}.\n\n` +
    "Tap a button below to continue.",
    { reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]) }
  );
  
  // Reset session state
  ctx.session.alert_step = undefined;
  ctx.session.alert_ticker = undefined;
  ctx.session.alert_type = undefined;
  ctx.session.alert_threshold = undefined;
  ctx.session.alert_percent = undefined;
  ctx.session.alert_direction = undefined;
});

export default composer;
