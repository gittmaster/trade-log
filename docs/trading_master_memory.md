# Trading Master Memory
**Last updated: May 21, 2026**

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

**IMPORTANT:** strategy_id is stored as TEXT SLUG in trades table — NOT numeric id.
FilterBar and TradeView both match on slug directly.

---

## KEY BEHAVIORAL RULES (from 112-trade data analysis May 21, 2026)

### Rules Already In Place
1. **No early exits** — avg target hit = +$412 when held to target
2. **Never remove stop** — manual management cost –$596 on one trade
3. **Same-day touch = doesn't count** — hard rule
4. **Neither side has 4 touches** — hard skip

### NEW RULES DECIDED MAY 21, 2026
5. **STOP ALL A- TRADES** — 63 A- trades = -$2,566 total (-$41/trade avg). Skipping them would have tripled P&L.
6. **Minimum 1.5:1 R:R** — sub-1.5 trades cost -$834, mostly A- anyway
7. **Sweet spot R:R = 2:1–2.9** — 62% WR in this bucket. 3:1+ only 25% WR (targets too far)
8. **Log stop and target on EVERY trade** — 55/112 trades had no R:R data (flying blind)

### Data-Confirmed Insights
- A+ trades: 89% WR, +$3,311 on just 8 trades — the real edge
- A trades: 51% WR, +$200 — take these
- A- trades: 37% WR, -$2,566 — STOP taking these
- Both Weak strategy: 55% of all trades, -$2,186 — the biggest leak
- SL age 1wk+: 57% WR vs 32% WR for <1wk — SL age matters massively
- Target hit rate: only 23% overall (1 in 4 trades reaches target)
- When target IS hit: 100% WR, +$11,300 — hold to target

### Stop Placement Problem
- May 2026: A1 got stopped at 4577 on May 3 MGC long (-$333)
- A2 held through same dip, exited at 4727 (+$1,126)
- Same entry, $1,459 difference — stops too tight, getting shaken at lows
- Recommendation: breakeven rule once up 1R, partial exit at 1.5R

### Doubling Up (Both Accounts)
- Only double up on A+ Prime setups
- A+/strong A doubled: +$1,964 combined
- A-/weak doubled: -$1,917 combined
- Rule: single account on A and below

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
  App.js                         — main app, global state, toolbar, applyFilters()
  App.css                        — global styles
  AIChat.js                      — floating AI chat panel
  supabase.js                    — Supabase client
  seedData.js                    — seed trades
  Login.jsx                      — login page
  components/
    DateRangePicker.jsx           — date range picker
    FilterBar.jsx                 — two-column purple filter panel (Dashboard only)
    TOSUploader.jsx               — TOS account statement uploader (Trade View)
    TradeReviewChart.jsx          — trade review card with real P&L chart
  pages/
    Dashboard.jsx                 — stats, insight cards, progress calendar
    Reports.jsx                   — P&L charts, by-strategy breakdown
    TradeView.jsx                 — full trade table, key levels, trade form
    Strategies.jsx                — strategy management
```

### Supabase Tables
| Table | Purpose |
|---|---|
| `trades` | All trade records |
| `strategies` | Strategy definitions (id bigint, name text, description text) |
| `tos_trade_data` | TOS fill data per trade — mfe, mae, pnl_points, checkpoints |

### trades table columns (key ones)
- strategy_id — text slug (strat-aplus-prime etc)
- exit_time, exit_date — separate exit time and date fields
- mfe_price — best price reached (numeric, nullable) — NEW May 21
- mae_price — worst price reached (numeric, nullable) — NEW May 21

### FilterBar
- Lives in App.js toolbar, only shows on Dashboard page
- Categories: General | Day & Time | Strategy | Insights
- General: Instrument, Intraday/Multiday, Open/Closed, Reviewed, Side, Status, Trade Rating
- Day & Time: Session window, Day of week, Hour block
- Strategy: hardcoded slugs (no Supabase call)
- Insights: Grade, Direction, Exit Reason
- applyFilters() in App.js applies to dashboardTrades

### TOSUploader (Trade View)
- Single drop zone, accepts MULTIPLE files at once (Ctrl+click both)
- Auto-detects A1 (account ending 7454) vs A2 (account ending 9962)
- Parses fills → round trips → matches to journal by symbol+direction+entry price
- Extracts OCO stop prices from order history
- Saves to tos_trade_data table + localStorage backup
- Shows combined results (A1 + A2 + COMBINED row)

### TradeReviewChart (click Review on any trade row)
- No fake estimated curves — only real data
- Shows: price outcome bar (stop/entry/exit/target on linear scale)
- Stats: Entry, Exit, Stop, Target, R:R, % of target captured, Left on Table
- MFE/MAE input fields: enter best/worst price manually → live SVG chart draws
- Chart is 4-point: Entry(0) → MAE/MFE → MFE/MAE → Exit (real prices only)
- Save button stores mfe_price + mae_price to Supabase trades table
- Close Review button: full-width at bottom of card
- Colored border: green for wins, red for losses

### WEB APP CHANGELOG
| Date | Feature |
|---|---|
| Apr 2026 | Initial app — trade log, Supabase, login |
| May 1 | AL/SL tier tracking |
| May 9 | **Major rewrite v2** — multi-page, sidebar nav |
| May 9 | Dashboard, Reports, Trade View, Strategies pages |
| May 9 | strategy_id text slug system |
| May 19 | exit_time, Trade Duration in Reports, UI brightness |
| May 20 | FilterBar two-column panel on Dashboard toolbar |
| May 20 | strategies hardcoded in FilterBar + TradeView (no Supabase) |
| May 21 | exit_date field added to trade form |
| May 21 | TOSUploader — multi-file, auto-detects A1/A2 by account number |
| May 21 | tos_trade_data Supabase table created |
| May 21 | TradeReviewChart — real price outcome bar + MFE/MAE input |
| May 21 | PnLChart — real 4-point SVG chart from entered MFE/MAE prices |
| May 21 | mfe_price + mae_price columns added to trades table |
| May 21 | Fixed: mfe_price/mae_price empty string → null in buildPayload |
| May 21 | Fixed: FilterBar checkboxes clickable (div onClick vs label) |
| May 21 | Fixed: strategy matching by slug text not numeric id |

---

## TRADE ANALYSIS SUMMARY (112 trades, Mar–May 2026)
- Net P&L: +$945 (barely positive)
- Win Rate: 46%
- Avg Winner: +$332 | Avg Loser: -$267
- Target hit rate: 23% (1 in 4 trades)
- Last 20 trades: 25% WR, -$2,882 (May has been brutal)
- May 2026 both accounts: -$3,983 combined, 21% WR

### If New Rules Applied Retroactively
- Stop A- trades: +$2,566 recovered
- Drop sub-1.5 R:R: +$834 recovered
- New net would be: +$4,345 on same period

---

## POLYGON.IO API KEY
- Key: 2U0mWxCYpbT2flccgpWlvV_EYP4wnaxL
- Status: Free tier — does NOT cover futures (MGC, MNQ)
- Futures data requires $29/month Starter plan
- Not currently used in app

---

## ACTIVE TRADES
None logged at end of last session.

---

## RESUME INSTRUCTIONS
1. Upload this file at the start of a new conversation
2. Say "resume trading master memory"
3. I will confirm memory loaded and ask about any open trades
