import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { saveUserProfile, getUserProfile } from "../storage-service.js";
import { fetchMultiplePrices } from "../crypto-service.js";

const composer = new Composer<Ctx>();

// Configure morning summary
composer.callbackQuery("settings:summary", async (ctx) => {
  await ctx.answerCallbackQuery();
  
  await ctx.editMessageText(
    "Set a daily morning summary to get price updates.\n\n" +
    "What time should I send the summary? (e.g., 08:00 for 8 AM)"
  );
  
  await ctx.reply("Enter time (HH:MM):", {
    reply_markup: { force_reply: true, input_field_placeholder: "Enter time (HH:MM)…" }
  });
  
  // Set session state
  ctx.session.onboarding_step = undefined; // Reset any other flow
});

// Handle summary time input
composer.on("message:text", async (ctx, next) => {
  // Only handle if this looks like a time input (HH:MM format)
  const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
  const text = ctx.message.text.trim();
  
  if (!timeRegex.test(text)) {
    return next(); // Not a time, pass to other handlers
  }
  
  // Check if we're expecting this input (based on previous message context)
  // For simplicity, we'll handle all time-like inputs when no other step is active
  if (ctx.session.onboarding_step || ctx.session.alert_step || ctx.session.quiet_hours_step) {
    return next(); // Another flow is active
  }
  
  // Save to user profile
  if (!ctx.from) return;
  
  const userId = ctx.from.id.toString();
  const existingProfile = getUserProfile(userId);
  saveUserProfile(userId, {
    telegramId: userId,
    timezone: existingProfile?.timezone || "UTC",
    preferredCurrency: existingProfile?.preferredCurrency || "USD",
    quietHoursStart: existingProfile?.quietHoursStart,
    quietHoursEnd: existingProfile?.quietHoursEnd,
    summaryTime: text,
  });
  
  await ctx.reply(
    `✅ Morning summary configured!\n\n` +
    `You'll receive a daily summary at ${text} in your timezone.\n\n` +
    "Tap a button below to continue.",
    { reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]) }
  );
});

// Generate and send morning summary
export async function sendMorningSummary(userId: string): Promise<void> {
  const profile = getUserProfile(userId);
  if (!profile?.summaryTime) return;
  
  const { getWatchlist } = await import("../storage-service.js");
  const watchlist = getWatchlist(userId);
  if (watchlist.length === 0) return;
  
  const tickers = watchlist.map(item => item.ticker);
  const prices = await fetchMultiplePrices(tickers, profile.preferredCurrency);
  
  if (prices.length === 0) return;
  
  const lines = [
    `☀️ Good morning! Here's your daily crypto summary:\n`,
    `💰 Price updates:`,
  ];
  
  for (const price of prices) {
    const change = price.change24h 
      ? (price.change24h >= 0 ? `+${price.change24h}%` : `${price.change24h}%`)
      : "";
    lines.push(`• ${price.ticker}: ${price.price} ${change}`);
  }
  
  lines.push(`\n📊 Market overview:`);
  lines.push(`• Tracked coins: ${watchlist.length}`);
  lines.push(`• Summary time: ${profile.summaryTime}`);
  
  const text = lines.join("\n");
  
  // In production, send via bot API
  // For now, just log
  console.log(`Morning summary for ${userId}:`, text);
}

export default composer;
