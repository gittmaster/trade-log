# Trading Master Memory
**Last updated: May 21, 2026 (Session 2)**

---

## TRADER PROFILE
- Trader: lax46
- Instruments: MGC (micro gold), MNQ (micro NQ), MCL (micro crude), MYM (micro Dow)
- Accounts: A1 (68927454SCHW) and A2 (69559962SCHW) — Schwab/TOS
- Strategy: AL/SL Trendline Break on 60-min charts
- Web App: https://trendline-trades.vercel.app
- GitHub: https://github.com/gittmaster/trade-log
- Supabase URL: https://tsfmzgndcsgntortbnku.supabase.co

---

## STRATEGY QUICK REFERENCE

### Line Strength
| Strength | Touches | Age |
|---|---|---|
| ★ Strong | 3+ | 1 week+ |
| Standard | 2 | < 1 day |
| Weak | 2 | < 1 week |

### Grading Matrix (CORRECT DEFINITIONS)
| Grade | Definition |
|---|---|
| A+ | BOTH sides: 3+ touches AND 1wk+ |
| A  | ONE side strong (3+ touches, 1wk+), other side weak |
| A- | BOTH sides weak (<3 touches or <1wk) |
| SKIP | Neither side qualifies |

### Session Windows (EST)
- 07:00–15:00 Morning ✅
- 15:00–19:00 Late Zone ❌ No new entries
- 19:00–23:00 Overnight ✅
- 23:00–07:00 Dead Zone ❌

### Multipliers
- MGC: $10/point
- MNQ: $2/point
- MYM: $0.50/point
- MCL: $100/point

---

## STRATEGIES (strategy_id slugs in trades table)
| Slug | Name | Description |
|---|---|---|
| strat-aplus-prime | A+ Prime | AL 3+ touches 1wk+ · SL 3+ touches 1wk+ |
| strat-strong-al-weak-sl | Strong AL / Weak SL | AL 3+ touches 1wk+ · SL <3 touches or <1wk |
| strat-weak-al-strong-sl | Weak AL / Strong SL | AL <3 touches or <1wk · SL 3+ touches 1wk+ |
| strat-both-weak | Both Weak | AL <3 touches or <1wk · SL <3 touches or <1wk |
| strat-unassigned | Unassigned | Trades not tagged to a strategy |

**IMPORTANT:** strategy_id is stored as TEXT SLUG — NOT numeric id.

---

## KEY BEHAVIORAL RULES (from 112-trade data analysis)

### Active Rules
1. **STOP ALL A- TRADES** — 63 A- trades = -$2,566 total. Decided May 21.
2. **Minimum 1.5:1 R:R** — sub-1.5 cost -$834
3. **Sweet spot R:R = 2:1–2.9** — 62% WR. 3:1+ only 25% WR (targets too far)
4. **Log stop and target on EVERY trade** — 55/112 had no R:R data
5. **No early exits** — avg target hit = +$412 when held
6. **Never remove stop**
7. **Same-day touch = doesn't count**
8. **Only double up (both accounts) on A+ Prime setups**

### Data-Confirmed Insights
- A+ trades: 89% WR, +$3,311 — the real edge
- A trades: 51% WR, +$200 — take these
- A- trades: 37% WR, -$2,566 — STOPPED
- SL age 1wk+: 57% WR vs 32% for <1wk
- Target hit rate: only 23% overall
- Hold time pattern: ALL wins were 14h+ hold. Losses mostly under 22h.

---

## KEY PRICE LEVELS — MGC
- W($4900) — Weekly resistance ceiling
- 4($4642.1) — Key intermediate level
- W($4600) — Weekly support floor
- M($4600) — Monthly support
- M($4400) — Deep monthly support

---

## WEB APP — trendline-trades.vercel.app

### Tech Stack
- Frontend: React (Create React App)
- Backend: Supabase (PostgreSQL)
- Hosting: Vercel
- Repo: github.com/gittmaster/trade-log

### File Structure
```
src/
  App.js                         — global state, toolbar, applyFilters(), tosData state
  App.css
  AIChat.js
  supabase.js
  seedData.js
  Login.jsx
  components/
    DateRangePicker.jsx
    FilterBar.jsx                 — two-column purple panel, Dashboard only
    TOSUploader.jsx               — parses TOS CSV, auto-detects A1/A2, Analysis page only
    TradeReviewChart.jsx          — trade review card, MFE/MAE input, 4-point P&L chart
  pages/
    Dashboard.jsx                 — stats, insight cards, progress calendar
    Reports.jsx                   — P&L charts, by-strategy
    Analysis.jsx                  — NEW: TOS statement analysis with 5 charts
    TradeView.jsx                 — trade table, key levels, trade form
    Strategies.jsx                — strategy management
```

### Sidebar Navigation Order
Dashboard → Reports → Analysis → Trade View → Strategies → AI Chat

### Supabase Tables
| Table | Purpose |
|---|---|
| `trades` | All trade records |
| `strategies` | Strategy definitions |
| `tos_trade_data` | TOS fill data — mfe, mae, pnl_points, checkpoints |

### trades table — key columns
- strategy_id — text slug
- exit_time, exit_date — separate fields
- mfe_price — best price reached (numeric, nullable)
- mae_price — worst price reached (numeric, nullable)

---

## COMPONENT DETAILS

### FilterBar (Dashboard toolbar)
- Two-column purple panel
- Categories: General | Day & Time | Strategy | Insights
- Hardcoded strategy slugs (no Supabase call)
- applyFilters() in App.js → dashboardTrades

### TOSUploader (Analysis page)
- Single drop zone, accepts multiple files at once
- Auto-detects A1 (acct ending 7454) vs A2 (acct ending 9962)
- Parses: fills → round trips, OCO stops → stop_dist, ADJ rows → checkpoints, BAL rows → equity curve
- Round trip fields: symbol, direction, entry, exit, pnl, duration_hrs, stop_dist, tos_stop, checkpoints, comm
- Saves to tos_trade_data Supabase table + localStorage backup
- onComplete(parsed) callback fires with: roundTrips, cashBalances, period, account, adjRows, plRows

### Analysis Page (NEW — May 21 Session 2)
- Located at: src/pages/Analysis.jsx
- tosData state lives in App.js (persists across tab switches)
- Passed as props: tosData, setTosData, dateRange, filteredTrades
- filteredTrips = useMemo filtering tosData.trips by dateRange.start/end
- filteredEquity = useMemo filtering cashBalances by dateRange
- useMemo deps use .getTime() not Date object (critical for reactivity)
- ChartCanvas uses cancelled ref to prevent setTimeout race condition
- Chart.js loaded once via script tag with id="chartjs-cdn"
- 5 charts: equity curve, P&L by symbol, stop distance scatter, hold time scatter (log2 x-axis), multiday journeys

### TradeReviewChart (Trade View — click Review)
- No fake curves — real data only
- Price outcome bar: stop/entry/exit/target on linear scale
- MFE/MAE manual input → live 4-point P&L chart
- 4-point path: Entry(0) → MAE/MFE → MFE/MAE → Exit
- Save stores to trades.mfe_price + trades.mae_price
- Close button: full-width at bottom
- Green border = win, red border = loss

### TradeView Table Columns (after cleanup)
`# · Date · Time · Acct · Symbol · Dir · Entry · Exit · P&L · Result · Session · Strategy · Chart · Review · Edit · Del`
- Removed: Grade, AL, AL Tier, SL, SL Tier columns
- Removed: A+/A/A- grade filter pills
- Removed: Tier filter row

### Dashboard (after cleanup)
- Removed: By Tier (AL/SL) insight card
- Calendar: no nav buttons — follows global date range automatically

---

## WEB APP CHANGELOG
| Date | Feature |
|---|---|
| Apr 2026 | Initial app — trade log, Supabase, login |
| May 1 | AL/SL tier tracking |
| May 9 | Major rewrite v2 — multi-page sidebar nav |
| May 19 | exit_time, Trade Duration, UI brightness |
| May 20 | FilterBar two-column panel on Dashboard |
| May 21 AM | exit_date field, TOSUploader, tos_trade_data table |
| May 21 AM | TradeReviewChart — MFE/MAE input + 4-point chart |
| May 21 AM | mfe_price + mae_price columns in trades table |
| May 21 PM | Remove Grade/AL/SL cols from TradeView table |
| May 21 PM | Remove A+/A/A- grade filter pills from TradeView |
| May 21 PM | Remove By Tier card from Dashboard |
| May 21 PM | Remove calendar nav — follows global date range |
| May 21 PM | Fix TradeView global filter (was bypassed with all trades) |
| May 21 PM | Analysis page added to sidebar (between Reports and Trade View) |
| May 21 PM | TOSUploader moved from TradeView to Analysis page |
| May 21 PM | Analysis: 5 Chart.js charts from TOS data |
| May 21 PM | Analysis: tosData in App.js — persists across tab switches |
| May 21 PM | Analysis: useMemo with .getTime() deps for date filter reactivity |
| May 21 PM | Analysis: ChartCanvas cancelled ref fixes setTimeout race condition |
| May 21 PM | TOSUploader: duration_hrs + stop_dist added to round trips |
| May 21 PM | TOSUploader: cashBalances parsed for equity curve |
| May 21 PM | Hold time chart: log2 x-axis to prevent compression |

---

## TRADE ANALYSIS SUMMARY (112 trades, Mar–May 2026)
- Net P&L: +$945 (barely positive)
- Win Rate: 46% | Avg Winner: +$332 | Avg Loser: -$267
- Target hit rate: 23%
- May 2026 both accounts: -$3,983, 21% WR

### TOS A1 Account Analysis (Apr 22 – May 21)
- 19 trades | 37% WR | Net: -$1,054 | Commissions: -$88
- Equity dropped from $9,483 to $3,661 in May 5–8
- Hold time pattern confirmed: all wins 14h+, losses mostly <22h
- Stop distance: tight stops (<5pts) = losses consistently

### If New Rules Applied Retroactively
- Stop A- trades: +$2,566 recovered
- Drop sub-1.5 R:R: +$834 recovered
- New net: +$4,345 on same period

---

## POLYGON.IO API KEY
- Key: 2U0mWxCYpbT2flccgpWlvV_EYP4wnaxL
- Status: Free tier — does NOT cover futures
- Not currently used in app

---

## ACTIVE TRADES
None logged at end of last session.

---

## RESUME INSTRUCTIONS
1. Upload this file at start of new conversation
2. Say "resume trading master memory"
3. I will confirm memory loaded and ask about open trades
