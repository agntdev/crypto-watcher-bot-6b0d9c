# Crypto Watcher Bot — Bot specification

**Archetype:** custom

**Voice:** professional and concise — write every user-facing message, button label, error, and empty state in this voice.

A Telegram bot for managing private cryptocurrency watchlists with price threshold and percent-move alerts, on-demand price checks, and customizable quiet hours. Includes admin analytics for the bot owner to monitor active users and alert statistics.

> This is the complete contract for the bot. Implement EVERY entry point, flow, feature, integration, and edge case below. The completeness review checks the bot against this document after each build pass.

## Primary audience

- Individual Telegram users interested in crypto price tracking
- Bot administrator for analytics and monitoring

## Success criteria

- Users can add/remove coins to watchlists with confirmation
- Price alerts fire according to configured thresholds and cooldown rules
- Quiet hours block proactive alerts during specified local time ranges
- Admin view shows active users and top-fired alerts

## Entry points

Every feature must be reachable from the bot's command/button surface (button-first; only /start and /help are slash commands).

- **/start** (command, actor: user, command: /start) — Open onboarding flow with timezone/currency setup
- **/list** (command, actor: user, command: /list) — Show current watchlist with status indicators
- **/price** (command, actor: user, command: /price) — Show price for specified ticker or full watchlist
- **Add Coin** (button, actor: user, callback: watchlist:add) — Open coin selection dialog with popular tickers
- **Manage Alerts** (button, actor: user, callback: alerts:manage) — Configure threshold/percent-move alerts per coin
- **Set Quiet Hours** (button, actor: user, callback: settings:quiet_hours) — Configure local time range for alert suppression

## Flows

### Onboarding
_Trigger:_ /start

1. Request timezone selection
2. Set preferred currency
3. Offer quick tour explanation

_Data touched:_ user_profile

### Watchlist Management
_Trigger:_ watchlist:add

1. Show popular coin buttons
2. Handle custom ticker input
3. Confirm coin addition with price check

_Data touched:_ watchlist_item

### Alert Configuration
_Trigger:_ alerts:manage

1. Select coin
2. Choose alert type (threshold/percent-move)
3. Set parameters and direction
4. Enable/disable alert

_Data touched:_ alert

### Morning Summary
_Trigger:_ scheduled_event

1. Generate summary of price changes
2. Include queued alerts from quiet hours
3. Send at user-configured local time

_Data touched:_ alert_event_log

### Price Check
_Trigger:_ /price

1. Parse ticker argument
2. Fetch current price data
3. Show price with percent change over configured windows

_Data touched:_ price_feed

## Data entities

Durable data (must survive a restart) uses the toolkit's persistent store, never in-memory maps.

- **user_profile** _(retention: persistent)_ — User-specific settings including timezone, currency, quiet hours, and summary preferences
  - fields: telegram_id, timezone, preferred_currency, quiet_hours_start, quiet_hours_end, summary_time
- **watchlist_item** _(retention: persistent)_ — Cryptocurrency ticker being tracked with custom display name and currency
  - fields: ticker_symbol, display_name, custom_currency
- **alert** _(retention: persistent)_ — User-configured alert rules with parameters and cooldown tracking
  - fields: type, parameters, direction, enabled, last_fired_timestamp
- **alert_event_log** _(retention: persistent)_ — Record of all fired alerts for statistics and summary generation
  - fields: timestamp, user_id, ticker, old_price, new_price, percent_change
- **owner_analytics** _(retention: persistent)_ — Aggregated statistics for admin view
  - fields: total_users, active_users_30d, alert_type_counts, top_fired_tickers

## Integrations

- **Telegram** (required) — User interactions, alert delivery, and admin commands
- **Crypto Price Feed** (required) — Market price data for alert triggering and price checks
Call external APIs against their real contract (correct endpoints, ids, params); credentials from env. Do not fake responses.

## Owner controls

- Admin command to view active users and alert statistics
- Configurable default cooldown periods
- Price feed reliability monitoring

## Notifications

- Direct message alerts for price thresholds/changes
- Daily morning summary with watchlist updates
- Admin notifications for price feed failures

## Permissions & privacy

- All user data stored privately with no sharing
- Local timezone used for quiet hours and summaries
- Price data only stored for reliability checks

## Edge cases

- Price feed outages with retry logic and user notifications
- Alert de-duplication during cooldown periods
- Typos in ticker symbols with resolution suggestions
- Alert queuing during quiet hours

## Required tests

- Verify alert suppression during configured quiet hours
- Test cooldown period enforcement after alert fires
- Validate morning summary includes queued alerts
- Confirm price check command works with and without ticker arguments

## Assumptions

- Default currency is USD for all price displays
- 1-hour lookback window for percent-move alerts
- 6-hour default cooldown period for alerts
- Morning summary disabled by default until user configures time
