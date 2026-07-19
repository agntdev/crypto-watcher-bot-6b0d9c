import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { mainMenuKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { saveUserProfile, getUserProfile } from "../storage-service.js";

// Register main menu items for features
registerMainMenuItem({ label: "➕ Add Coin", data: "watchlist:add", order: 10 });
registerMainMenuItem({ label: "📋 My watchlist", data: "watchlist:list", order: 20 });
registerMainMenuItem({ label: "🔔 Manage alerts", data: "alerts:manage", order: 30 });
registerMainMenuItem({ label: "💰 Price check", data: "price:check", order: 40 });
registerMainMenuItem({ label: "🌙 Quiet hours", data: "settings:quiet_hours", order: 50 });
registerMainMenuItem({ label: "☀️ Daily summary", data: "settings:summary", order: 60 });
registerMainMenuItem({ label: "📊 Admin", data: "admin:analytics", order: 100 });

const composer = new Composer<Ctx>();

const WELCOME = "👋 Welcome to Crypto Watcher!\n\nI'll help you track cryptocurrency prices and set alerts. Tap a button below to get started.";

composer.command("start", async (ctx) => {
  // Check if user has completed onboarding
  if (!ctx.session.timezone || !ctx.session.currency) {
    // Start onboarding flow
    ctx.session.onboarding_step = "timezone";
    await ctx.reply("First, let's set up your preferences.\n\nWhat timezone are you in? (e.g., UTC, US/Eastern, Europe/London)", {
      reply_markup: { force_reply: true, input_field_placeholder: "Type your timezone…" }
    });
    return;
  }
  await ctx.reply(WELCOME, { reply_markup: mainMenuKeyboard() });
});

// Handle onboarding text input
composer.on("message:text", async (ctx, next) => {
  if (!ctx.session.onboarding_step) return next();

  const text = ctx.message.text.trim();

  if (ctx.session.onboarding_step === "timezone") {
    // Simple validation - accept any non-empty string
    if (text.length < 2) {
      await ctx.reply("Please enter a valid timezone (e.g., UTC, US/Eastern).");
      return;
    }
    ctx.session.timezone = text;
    ctx.session.onboarding_step = "currency";
    await ctx.reply("Got it! What currency do you prefer for prices? (e.g., USD, EUR, GBP)", {
      reply_markup: { force_reply: true, input_field_placeholder: "Type your currency…" }
    });
    return;
  }

  if (ctx.session.onboarding_step === "currency") {
    if (text.length < 2 || text.length > 5) {
      await ctx.reply("Please enter a valid currency code (e.g., USD, EUR, GBP).");
      return;
    }
    ctx.session.currency = text.toUpperCase();
    ctx.session.onboarding_step = "tour";
    
    // Save user profile to persistent storage
    const userId = ctx.from.id.toString();
    saveUserProfile(userId, {
      telegramId: userId,
      timezone: ctx.session.timezone!,
      preferredCurrency: ctx.session.currency,
    });
    
    await ctx.reply(
      `Great! You're all set with ${ctx.session.timezone} timezone and ${ctx.session.currency} currency.\n\n` +
      "Here's what I can do:\n" +
      "• Add coins to your watchlist\n" +
      "• Set price alerts (threshold or percent move)\n" +
      "• Check prices anytime\n" +
      "• Configure quiet hours to avoid alerts at night\n\n" +
      "Tap a button below to continue.",
      { reply_markup: mainMenuKeyboard() }
    );
    ctx.session.onboarding_step = undefined;
    return;
  }

  // If not in onboarding, pass to other handlers
  return next();
});

// "Back to menu" — re-render the main menu in place from any sub-view.
composer.callbackQuery("menu:main", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(WELCOME, { reply_markup: mainMenuKeyboard() });
});

export default composer;
