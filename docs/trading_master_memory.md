# Trading Master Memory
**Last updated: May 20, 2026**

---

## TRADER PROFILE
- Trader: lax46
- Instruments: MGC (micro gold), MNQ (micro NQ), MCL (micro crude), MYM (micro Dow)
- Accounts: A1 and A2 (Schwab)
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

### Grading Matrix
| Grade | AL | SL |
|---|---|---|
| A+ | ★ Strong | ★ Strong |
| A  | Standard | ★ Strong (or reverse) |
| A- | Standard | Weak |
| SKIP | Neither has 4 touches | — |

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

---

## KEY BEHAVIORAL RULES (from 99-trade history)
1. **No early exits** — avg target hit = +$412 when held
2. **Never remove stop** — Trade 84 cost –$596 from manual management
3. **Same-day touch = doesn't count** — caused failures in trades 73 and 84
4. **A- with Weak SL** — 35 trades, –$1,001 total. Flag every time.
5. **Neither side has 4 touches** — hard skip, no exceptions

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
  App.js                        — main app, global state, toolbar
  App.css                       — global styles
  AIChat.js                     — floating AI chat panel
  supabase.js                   — Supabase client
  seedData.js                   — seed trades
  Login.jsx                     — login page
  components/
    DateRangePicker.jsx          — date range picker
    FilterBar.jsx                — two-column filter panel (NEW May 20)
  pages/
    Dashboard.jsx                — stats, insight cards, progress calendar
    Reports.jsx                  — P&L charts, by-strategy breakdown
    TradeView.jsx                — full trade table, key levels
    Strategies.jsx               — strategy management
```

### Supabase Tables
- `trades` — all trade records
- `strategies` — strategy definitions (id bigint, name text, description text)

### WEB APP CHANGELOG
| Date | Feature |
|---|---|
| Apr 2026 | Initial app built — trade log, Supabase backend, login |
| May 1 | AL/SL tier tracking (Primary/Secondary/Tertiary) |
| May 1 | Weekly/monthly progress chart with Chart.js |
| May 2 | Progress + Key Levels sections collapsible |
| May 2 | Pagination — 25 trades per page |
| May 4 | Key Levels panel — symbol tabs, clear button |
| May 9 | **Major rewrite — multi-page app v2** |
| May 9 | Sidebar nav: Dashboard, Reports, Trade View, Strategies |
| May 9 | Global date range picker + Account filter |
| May 9 | Dashboard — stats, insight cards, progress calendar |
| May 9 | Reports — cumulative + daily P&L charts, by-strategy tab |
| May 9 | Trade View — full table, strategy filter pills, Key Levels |
| May 9 | Strategies page — 4 AL/SL strategies, auto-assign, bulk assign |
| May 9 | strategy_id column added to trades table |
| May 19 | exit_time field added to trade form |
| May 19 | Reports — Trade Duration section added |
| May 19 | Global UI brightness pass — all dull text brightened |
| May 19 | Aggregate/stat values bolded across all pages |
| May 20 | **FilterBar — two-column purple panel added to toolbar** |
| May 20 | FilterBar lives in App.js toolbar (shows only on Dashboard) |
| May 20 | Filter categories: General, Day & Time, Strategy, Insights |
| May 20 | General: Instrument, Intraday/Multiday, Open/Closed, Reviewed, Side, Status, Trade Rating |
| May 20 | Day & Time: Session window, Day of week, Hour block |
| May 20 | Strategy: filters by strat-* slug matching trades.strategy_id |
| May 20 | Insights: Grade, Direction, Exit Reason |
| May 20 | applyFilters() in App.js — all filter logic centralized |
| May 20 | strategies hardcoded in FilterBar (no Supabase dependency) |

### IMPORTANT: strategy_id is stored as TEXT SLUG in trades table
- `strat-aplus-prime`
- `strat-strong-al-weak-sl`
- `strat-weak-al-strong-sl`
- `strat-both-weak`
- `strat-unassigned`
FilterBar matches on slug directly — NOT on numeric Supabase id.

---

## ACTIVE TRADES
None logged at end of last session.

---

## RESUME INSTRUCTIONS
1. Upload this file at the start of a new conversation
2. Say "resume trading master memory"
3. I will confirm memory loaded and ask about any open trades
