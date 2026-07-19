import type { Ctx } from "./bot.js";

export interface WatchlistItem {
  ticker: string;
  displayName?: string;
  customCurrency?: string;
  addedAt: string;
}

export interface Alert {
  id: string;
  ticker: string;
  type: "threshold" | "percent_move";
  parameters: {
    threshold?: number;
    percent?: number;
    direction: "above" | "below";
  };
  enabled: boolean;
  lastFiredTimestamp?: string;
  createdAt: string;
}

export interface AlertEventLog {
  timestamp: string;
  userId: string;
  ticker: string;
  oldPrice: number;
  newPrice: number;
  percentChange: number;
}

export interface UserProfile {
  telegramId: string;
  timezone: string;
  preferredCurrency: string;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  summaryTime?: string;
}

// In-memory storage for demo (replace with Redis/persistent storage in production)
const watchlistStorage = new Map<string, WatchlistItem[]>();
const alertStorage = new Map<string, Alert[]>();
const profileStorage = new Map<string, UserProfile>();

export function getWatchlist(userId: string): WatchlistItem[] {
  return watchlistStorage.get(userId) || [];
}

export function addToWatchlist(userId: string, item: WatchlistItem): void {
  const watchlist = getWatchlist(userId);
  const existing = watchlist.find(w => w.ticker === item.ticker);
  if (!existing) {
    watchlist.push(item);
    watchlistStorage.set(userId, watchlist);
  }
}

export function removeFromWatchlist(userId: string, ticker: string): boolean {
  const watchlist = getWatchlist(userId);
  const index = watchlist.findIndex(w => w.ticker === ticker);
  if (index >= 0) {
    watchlist.splice(index, 1);
    watchlistStorage.set(userId, watchlist);
    return true;
  }
  return false;
}

export function getAlerts(userId: string): Alert[] {
  return alertStorage.get(userId) || [];
}

export function addAlert(userId: string, alert: Alert): void {
  const alerts = getAlerts(userId);
  alerts.push(alert);
  alertStorage.set(userId, alerts);
}

export function updateAlert(userId: string, alertId: string, updates: Partial<Alert>): boolean {
  const alerts = getAlerts(userId);
  const alert = alerts.find(a => a.id === alertId);
  if (alert) {
    Object.assign(alert, updates);
    alertStorage.set(userId, alerts);
    return true;
  }
  return false;
}

export function deleteAlert(userId: string, alertId: string): boolean {
  const alerts = getAlerts(userId);
  const index = alerts.findIndex(a => a.id === alertId);
  if (index >= 0) {
    alerts.splice(index, 1);
    alertStorage.set(userId, alerts);
    return true;
  }
  return false;
}

export function getUserProfile(userId: string): UserProfile | undefined {
  return profileStorage.get(userId);
}

export function saveUserProfile(userId: string, profile: UserProfile): void {
  profileStorage.set(userId, profile);
}

export function isWithinQuietHours(userId: string, now: Date): boolean {
  const profile = getUserProfile(userId);
  if (!profile?.quietHoursStart || !profile?.quietHoursEnd) {
    return false;
  }
  
  const [startHour, startMin] = profile.quietHoursStart.split(':').map(Number);
  const [endHour, endMin] = profile.quietHoursEnd.split(':').map(Number);
  
  const currentHour = now.getHours();
  const currentMin = now.getMinutes();
  const currentTime = currentHour * 60 + currentMin;
  const startTime = startHour * 60 + startMin;
  const endTime = endHour * 60 + endMin;
  
  if (startTime <= endTime) {
    return currentTime >= startTime && currentTime <= endTime;
  } else {
    // Overnight quiet hours (e.g., 22:00 to 07:00)
    return currentTime >= startTime || currentTime <= endTime;
  }
}

export function getActiveUsersCount(): number {
  return profileStorage.size;
}

export function getAlertStats(): { typeCounts: Record<string, number>; topTickers: Record<string, number> } {
  const typeCounts: Record<string, number> = { threshold: 0, percent_move: 0 };
  const topTickers: Record<string, number> = {};
  
  for (const alerts of alertStorage.values()) {
    for (const alert of alerts) {
      typeCounts[alert.type]++;
      topTickers[alert.ticker] = (topTickers[alert.ticker] || 0) + 1;
    }
  }
  
  return { typeCounts, topTickers };
}
