import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { getActiveUsersCount, getAlertStats } from "../storage-service.js";

const composer = new Composer<Ctx>();

// Admin analytics command (owner only)
composer.command("admin", async (ctx) => {
  // In production, check if user is admin
  const isAdmin = ctx.from?.id === 123456789; // Replace with real admin check
  
  if (!isAdmin) {
    await ctx.reply("⛔ This command is for administrators only.");
    return;
  }
  
  await showAdminAnalytics(ctx);
});

// Admin analytics from main menu button (owner only)
composer.callbackQuery("admin:analytics", async (ctx) => {
  await ctx.answerCallbackQuery();
  
  // In production, check if user is admin
  const isAdmin = ctx.from?.id === 123456789; // Replace with real admin check
  
  if (!isAdmin) {
    await ctx.reply("⛔ This feature is for administrators only.");
    return;
  }
  
  await showAdminAnalytics(ctx, true);
});

async function showAdminAnalytics(ctx: Ctx, editMessage = false) {
  const activeUsers = getActiveUsersCount();
  const stats = getAlertStats();
  
  const lines = [
    `📊 Admin Analytics\n`,
    `👥 Active users: ${activeUsers}`,
    `\n🔔 Alert statistics:`,
    `• Threshold alerts: ${stats.typeCounts.threshold}`,
    `• Percent move alerts: ${stats.typeCounts.percent_move}`,
    `\n📈 Top tracked coins:`,
  ];
  
  // Sort top tickers by count
  const sortedTickers = Object.entries(stats.topTickers)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);
  
  if (sortedTickers.length > 0) {
    for (const [ticker, count] of sortedTickers) {
      lines.push(`• ${ticker}: ${count} alerts`);
    }
  } else {
    lines.push("• No alerts configured yet");
  }
  
  const text = lines.join("\n");
  
  const rows = [
    [inlineButton("🔄 Refresh", "admin:refresh")],
    [inlineButton("⬅️ Back to menu", "menu:main")]
  ];
  
  if (editMessage) {
    await ctx.editMessageText(text, { reply_markup: inlineKeyboard(rows) });
  } else {
    await ctx.reply(text, { reply_markup: inlineKeyboard(rows) });
  }
}

// Refresh admin analytics
composer.callbackQuery("admin:refresh", async (ctx) => {
  await ctx.answerCallbackQuery();
  await showAdminAnalytics(ctx, true);
});

export default composer;
