import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { saveUserProfile, getUserProfile } from "../storage-service.js";

const composer = new Composer<Ctx>();

// Start quiet hours configuration
composer.callbackQuery("settings:quiet_hours", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.quiet_hours_step = "start";
  
  await ctx.editMessageText(
    "Set quiet hours to pause alerts during specific times.\n\n" +
    "When should quiet hours start? (e.g., 22:00 for 10 PM)"
  );
  
  await ctx.reply("Enter start time (HH:MM):", {
    reply_markup: { force_reply: true, input_field_placeholder: "Enter start time (HH:MM)…" }
  });
});

// Handle start time input
composer.on("message:text", async (ctx, next) => {
  if (ctx.session.quiet_hours_step !== "start") return next();
  
  const text = ctx.message.text.trim();
  const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
  
  if (!timeRegex.test(text)) {
    await ctx.reply("Please enter a valid time in 24-hour format (e.g., 22:00).");
    return;
  }
  
  ctx.session.quiet_hours_start = text;
  ctx.session.quiet_hours_step = "end";
  
  await ctx.reply(
    `Quiet hours start at ${text}.\n\n` +
    "When should quiet hours end? (e.g., 07:00 for 7 AM)",
    {
      reply_markup: { force_reply: true, input_field_placeholder: "Enter end time (HH:MM)…" }
    }
  );
});

// Handle end time input
composer.on("message:text", async (ctx, next) => {
  if (ctx.session.quiet_hours_step !== "end") return next();
  
  const text = ctx.message.text.trim();
  const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
  
  if (!timeRegex.test(text)) {
    await ctx.reply("Please enter a valid time in 24-hour format (e.g., 07:00).");
    return;
  }
  
  ctx.session.quiet_hours_end = text;
  ctx.session.quiet_hours_step = undefined;
  
  // Save to user profile
  const userId = ctx.from.id.toString();
  const existingProfile = getUserProfile(userId);
  saveUserProfile(userId, {
    telegramId: userId,
    timezone: existingProfile?.timezone || "UTC",
    preferredCurrency: existingProfile?.preferredCurrency || "USD",
    quietHoursStart: ctx.session.quiet_hours_start,
    quietHoursEnd: text,
    summaryTime: existingProfile?.summaryTime,
  });
  
  await ctx.reply(
    `✅ Quiet hours configured!\n\n` +
    `Alerts will be paused from ${ctx.session.quiet_hours_start} to ${text} in your timezone.\n\n` +
    "Tap a button below to continue.",
    { reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]) }
  );
});

export default composer;
