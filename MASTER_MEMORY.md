# TRADING MASTER MEMORY FILE
**Created:** April 19, 2026
**Last Updated:** April 19, 2026
**Purpose:** Resume trading coaching session in a new conversation
**Instructions:** Upload this file at the start of a new conversation and say "read this and pick up where we left off"

---

## TRADER PROFILE

- **Platform:** Charles Schwab Futures (thinkorswim)
- **GitHub username:** gittmaster
- **Strategy:** Trendline Break Strategy — 60-min charts
- **Instruments:** MGC (micro gold, $10/point), MNQ (micro NQ, $2/point)
- **Skip:** MCL crude oil — net negative across entire dataset

**Two accounts:**
- **Account 1 — 68927454SCHW** — Primary, Gold specialist (MGC)
- **Account 2 — 69559962SCHW** — Secondary, NQ specialist (MNQ)

---

## WEB APP — trendline-trades.vercel.app

- **Live URL:** https://trendline-trades.vercel.app
- **GitHub repo:** https://github.com/gittmaster/trade-log
- **Supabase project:** https://tsfmzgndcsgntortbnku.supabase.co
- **Stack:** React + Supabase + Vercel (free tier all)
- **Local repo path:** C:\Users\lax46\Downloads\trade-log\trade-log

**Environment variables in Vercel:**
- `REACT_APP_SUPABASE_ANON_KEY` — Supabase anon key
- `REACT_APP_ANTHROPIC_API_KEY` — Anthropic API key
- `REACT_APP_PASSWORD` — App login password (added April 19, 2026)

**Supabase storage:**
- Bucket: `trade-charts` — PUBLIC — policy: allow all operations (SELECT, INSERT, UPDATE, DELETE)

**Features built and working:**
- Trade log table with filters: All, A1, A2, MGC, MNQ, A+, A, A-, Wins, Losses, This Week
- This Week filter shows net P&L, win/loss count, win rate in table header
- Stats dashboard — win rate, net P&L, avg winner/loser
- Insight panels by instrument, grade, Safety Line quality, session
- New trade form — auto trade number, chart image upload to Supabase storage
- Edit trade — ✎ button pre-fills entire form
- View chart — 📷 button opens fullscreen modal (only shows if chart uploaded)
- AI chat — 🤖 FAB button bottom right, expandable with ⊞ button
- Export CSV — ↓ Export CSV button downloads all trades with today's date in filename
- Sortable columns — click any column header, arrow shows sort direction
- Exit reason defaults to blank — must select before saving
- **Password login screen — NEW April 19** — Login.js added, App.js updated with auth gate

**Source files:**
- `src/App.js` — main app (updated April 19 with Login import + auth state)
- `src/Login.js` — NEW file added April 19, password screen component
- `src/AIChat.js` — AI chat panel
- `src/supabase.js` — Supabase client
- `src/seedData.js` — historical trade seed data

**PENDING as of April 19 — needs git push:**
The Login.js and updated App.js were provided to the user as copy-paste content.
User needs to run:
```
git add src/Login.js src/App.js
git commit -m "add password login screen"
git push origin main
```
If already pushed, the app at trendline-trades.vercel.app will show a dark login screen with 📈 icon before loading the app.

**Supabase table schema — trades:**
```sql
id, trade_number, date, time, account, symbol, direction, entry, exit_price,
stop, target, exit_reason, al_strength, al_touches, al_age, sl_quality,
sl_touches, sl_age, sl_price, grade, session, yellow_levels, confirmations,
notes, chart_url, pnl, created_at
```

---

## STRATEGY RULES — COMPLETE

### Action Line (AL) — the trendline that triggers entry
- **★ Strong** = 3+ touches AND 1 week+ data — BOTH required
- **Standard** = under 1 week OR under 3 touches
- **CRITICAL RULE:** AL must actually CROSS before entering — no premature entries on support/resistance alone

### Safety Line (SL) — the opposing trendline where stop is placed
- **★ Strong** = 3+ touches AND 1 week+ data AND low risk distance — ALL required
- **Weak** = 2 touches OR under 1 week — either one drops it

### Trendline Color Convention
- **Red lines** = descending trendlines
- **Green lines** = ascending trendlines
- **Thicker lines** = higher timeframe (HTF)
- **Thinner lines** = 60-min timeframe (trading timeframe)

### Setup Grades
| AL | SL | Grade | Win Rate |
|---|---|---|---|
| ★ Strong | ★ Strong | **A+** | ~80% |
| ★ Strong | Weak | **A** | ~55% |
| Standard | ★ Strong | **A** | ~55% |
| Standard | Weak | **A-** | ~40% |
| Not crossed | Any | **Skip** | net negative |

### Session Windows (EST)
- **TAKE:** 07:00–09:00 Pre-open, 09:00–11:00 Open, 19:00–23:00 Overnight carry
- **AVOID:** 15:00–19:00 late session, 23:00–07:00 dead zone (hard rule, no exceptions)

### Entry Checklist — all must pass
1. AL actually crossed? (No = skip, no exceptions)
2. R:R minimum 1.5:1 (reward must be 1.5× risk)
3. Session in valid window?
4. No apex compression (3+ lines converging = wait for break first)
5. SL identified and quality assessed?

### Yellow Horizontal Lines
- Weekly (W), Daily (D), Monthly (M), 4-hour (4) levels
- Act as S/R for entry confluence and profit targets
- Not a substitute for AL cross

---

## FULL TRADE LOG — ALL 72 TRADES

### Trades 1–49 (March 1 – March 27, 2026)
| # | Date | Acct | Sym | Dir | Grade | AL | SL | P&L | Result |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 3/3 | A1 | MGC | Short | A | Std | Weak | $0 | Stop |
| 2 | 3/3 | A1 | MNQ | Long | A- | Std | Weak | –$301 | Stop |
| 3 | 3/3 | A1 | MGC | Long | A | Std | Weak | +$102 | Target |
| 4 | 3/4 | A1 | MNQ | Short | A- | Std | Weak | –$38 | Stop |
| 5 | 3/4 | A1 | MGC | Long | A- | Std | Weak | –$366 | Stop |
| 6 | 3/6 | A1 | MGC | Long | A+ | ★1wk+ | ★3+ | +$510 | Target |
| 7 | 3/5 | A1 | MCL | Long | A | Std | Weak | +$272 | Target |
| 8 | 3/9 | A1 | MNQ | Short | A- | Std | Weak | –$37 | Stop |
| 9 | 3/9 | A1 | MNQ | Long | A | Std | ★3+ | +$516 | Target |
| 10 | 3/9 | A1 | MGC | Long | A+ | ★1wk+ | ★3+ | +$549 | Target |
| 11 | 3/11 | A1 | MGC | Short | A- | Std | Weak | –$176 | Stop |
| 12 | 3/11 | A1 | MGC | Short | A+ | ★1wk+ | ★3+ | +$477 | Target |
| 13 | 3/12 | A1 | MGC | Short | A | Std | ★3+ | +$477 | Target |
| 14 | 3/13 | A1 | MGC | Long | A | Std | ★3+ | –$598 | Stop |
| 15 | 3/13 | A1 | MCL | Long | A- | Std | Weak | –$237 | Stop |
| 16 | 3/1 | A2 | MCL | Long | A | Std | Weak | +$311 | Target |
| 17 | 3/2 | A2 | MNQ | Short | A+ | ★1wk+ | ★3+ | +$684 | Target |
| 18 | 3/3 | A2 | MNQ | Short | A- | Std | Weak | –$111 | Stop |
| 19 | 3/4 | A2 | MCL | Long | A- | Std | Weak | –$79 | Stop |
| 20 | 3/4 | A2 | MCL | Long | A- | Std | Weak | +$100 | Target |
| 21 | 3/4 | A2 | MNQ | Short | A- | Std | Weak | –$133 | Stop |
| 22 | 3/4 | A2 | MNQ | Short | A+ | ★1wk+ | ★3+ | +$639 | Target |
| 23 | 3/8 | A2 | MNQ | Long | A+ | ★1wk+ | ★3+ | +$400 | Target |
| 24 | 3/9 | A2 | MNQ | Short | A- | Std | Weak | –$334 | Stop |
| 25 | 3/10 | A2 | MGC | Long | A- | Std | Weak | –$18 | Manual |
| 26 | 3/10 | A2 | MCL | Long | A- | Std | Weak | –$54 | Stop |
| 27 | 3/11 | A2 | MNQ | Short | A- | Std | Weak | –$39 | Stop |
| 28 | 3/11 | A2 | MNQ | Short | A+ | ★1wk+ | ★3+ | +$409 | Target |
| 29 | 3/12 | A2 | MCL | Long | A- | Std | Weak | –$356 | Stop |
| 30 | 3/13 | A2 | MNQ | Long | A | Std | ★3+ | –$601 | Stop |
| 31 | 3/13 | A2 | MCL | Long | A+ | ★1wk+ | ★3+ | –$357 | Stop |
| 32 | 3/15 | A1 | MGC | Short | A | Std | Weak | –$12 | Stop |
| 33 | 3/15 | A1 | MGC | Long | A- | Std | Weak | –$282 | Stop |
| 34 | 3/16 | A1 | MNQ | Short | A- | Std | Weak | +$97 | Manual |
| 35 | 3/17 | A1 | MGC | Long | A | Std | ★3+ | –$250 | Manual |
| 36 | 3/18 | A1 | MGC | Short | A | ★1wk+ | Weak | +$934 | Target |
| 37 | 3/18 | A2 | MNQ | Short | A- | Std | Weak | +$157 | Target |
| 38 | 3/18 | A2 | MNQ | Short | A- | Std | Weak | +$307 | Manual |
| 39 | 3/18 | A1 | MGC | Long | A- | Std | Weak | –$45 | Manual |
| 40 | 3/18 | A1 | MGC | Long | A | Std | Weak | –$490 | Stop |
| 41 | 3/19 | A1 | MGC | Short | A- | Std | ★3+ | +$450 | Target |
| 42 | 3/19 | A2 | MNQ | Short | A | ★1wk+ | Weak | +$195 | Target |
| 43 | 3/24 | A2 | MNQ | Short | A- | Std | Weak | +$482 | Target |
| 44 | 3/24 | A1 | MGC | Short | A | Std | ★3+ | –$571 | Stop |
| 45 | 3/25 | A2 | MNQ | Short | A- | Std | Weak | –$426 | Stop |
| 46 | 3/25 | A1 | MGC | Long | A | ★1wk+ | Weak | –$684 | Stop |
| 47 | 3/26 | A2 | MNQ | Short | A | ★1wk+ | Weak | –$131 | Stop |
| 48 | 3/26 | A1 | MGC | Short | A- | Std | Weak | –$260 | Stop |
| 49 | 3/27 | A1 | MGC | Long | A | ★1wk+ | ★3+ | +$420 | Manual |

### Trades 50–72 (March 31 – April 9, 2026)
| # | Date | Time | Acct | Sym | Dir | Grade | P&L | Notes |
|---|---|---|---|---|---|---|---|---|
| 50 | 3/31 | 09:38 | A2 | MNQ | Short | A- | +$158 | Manual |
| 51 | 3/31 | 09:40 | A1 | MGC | Short | A- | +$92 | Manual — slow price |
| 52 | 3/31 | 20:42 | A1 | MNQ | Long | A- | +$252 | Daily yellow bounce |
| 53 | 4/1 | 12:38 | A2 | MNQ | Long | A- | +$335 | Target hit |
| 54 | 4/1 | 12:38 | A1 | MGC | Long | A+ | +$272 | Both ★Strong, daily yellow crossed |
| 55 | 4/2 | 11:20 | A1 | MGC | Long | A | +$57 | Manual — slow |
| 56 | 4/2 | 11:45 | A2 | MNQ | Long | A- | +$13 | Manual — scratched |
| 57 | 4/2 | 14:34 | A1 | MGC | Short | A | –$393 | Stop — SL 5t 30d exceptional |
| 58 | 4/2 | 21:05 | A1 | MGC | Short | A | +$309 | Target — SL 4t 29d |
| 59 | 4/2 | 21:05 | A2 | MNQ | Short | A- | +$452 | News catalyst, manual near yellow |
| 60 | 4/3 | 22:02 | A1 | MNQ | Short | A | +$102 | Good Friday, HTF+yellow confluence |
| 61 | 4/3 | 21:58 | A2 | MNQ | Short | A | +$108 | Good Friday, HTF red line confluence |
| 62 | 4/5 | — | A1 | MGC | Short | A | $0 | Breakeven |
| 63 | 4/6 | — | A1 | MGC | Long | A- | +$6 | Manual — scratched slow |
| 64 | 4/6 | — | A2 | MNQ | Short | A | –$121 | AL 2t <1day, SL 3t 19d |
| 65 | 4/6 | 21:40 | A1 | MGC | Long | A- | –$199 | AL NOT CROSSED — premature entry |
| 66 | 4/6 | 13:08 | A1 | MNQ | Short | A- | –$176 | Competing green line apex — hit target next day |
| 67 | 4/6 | 21:48 | A1 | MGC | Short | A | –$327 | AL ★Strong 4t 14d, SL weak <1wk |
| 68 | 4/7 | 21:00 | A1 | MGC | Short | A | +$82 | Left +$998 on table — closed early |
| 69 | 4/8 | 08:22 | A1 | MGC | Short | A | –$251 | R:R 1.08:1 too tight, scratched |
| 70 | 4/8 | 09:40 | A1 | MGC | Short | A | +$549 | Psychology — closed early, target hit after |
| 71 | 4/9 | 14:10 | A2 | MNQ | Short | A- | –$225 | AL NOT CROSSED — weekly resistance only |
| 72 | 4/9 | 09:48 | A2 | MNQ | Long | A | –$346 | R:R 0.91:1 negative, SL 2 days old |

---

## WEEKLY PERFORMANCE SUMMARY

| Week | Trades | Winners | Losers | Win Rate | Net P&L |
|---|---|---|---|---|---|
| 3/1–3/13 | 31 | ~17 | ~14 | 55% | +$2,100 |
| 3/15–3/19 | 10 | ~6 | ~4 | 60% | +$200 |
| 3/24–3/26 | 6 | 1 | 5 | 17% | –$1,590 |
| 3/27 | 1 | 1 | 0 | 100% | +$420 |
| 3/31–4/3 | 13 | 12 | 1 | 92% | +$1,757 |
| 4/6–4/9 | 9 | 2 | 7 | 22% | –$1,063 |
| **TOTAL** | **72** | | | | **~+$1,824** |

---

## KEY ANALYTICAL FINDINGS

### Win rates by grade (all 72 trades)
- **A+:** ~80% win rate
- **A:** ~55% win rate
- **A-:** ~40% win rate (net negative when both AL and SL weak)

### Most important patterns
1. **★ Strong Safety Line = single biggest differentiator** — all major winning streaks had it
2. **Dead zone 23:00–07:00 = consistent losses** — never enter
3. **Late session 15:00–19:00 = avoid** — multiple losses
4. **AL not crossed = skip** — Trades 65 and 71 both lost, combined –$424
5. **R:R below 1.5:1 = skip** — Trades 69 and 72 both negative
6. **Overnight carry + ★Strong SL** = highest win rate combo
7. **HTF line break** = biggest moves (Trade 36 +$934, Trade 17 +$684)
8. **Psychology — early exits** — Trades 66, 68, 70 all hit target after manual close

### Account comparison
- Both accounts profitable overall
- A1 has more trades and larger wins/losses
- A2 tends toward more disciplined entries

---

## LESSONS LEARNED (CRITICAL)

1. **AL must cross** — no entry on support/resistance alone, ever
2. **SL age required** — 4 touches under 1 week = Weak, age cannot be substituted
3. **R:R minimum 1.5:1** — below this skip regardless of line quality
4. **Hold to stop or target** — only manual exit when competing trendline appears or dead price action
5. **Psychology** — prior losses cause early exits on valid setups. Mechanical rules prevent this
6. **Apex compression** — 3+ lines converging = skip, wait for break, trade the retest
7. **Session discipline** — same setup in dead zone loses, same setup in open session wins
8. **HTF red line break** = enter immediately, biggest moves

---

## CHART BIAS — Week of April 14, 2026

### MNQ 4H (last read April 13)
- Price: ~25,282
- **Broke above HTF red descending line** on 4/10 — major bullish breakout
- Two steep green ascending lines as dynamic support
- Yellow levels: W(25200), W(24900), W(24400), M(24000)
- **Bias: Bullish** — watch 25200 as support floor
- Long setup: pull back to green ascending line + hold 25200 → long targeting 25300+
- Short setup: fail at 25200 + red line acts as resistance → short toward 24900

### MGC 4H (last read April 13)
- Price: ~4,788
- **Apex compression** between red descending line and green ascending line at W(4850)
- Yellow levels: W(5000), W(4850), D(4673), W(4600), M(4403)
- **Bias: Wait for apex resolution**
- Long: Break above 4850 + red line → target W(5000)
- Short: Green line breaks → target D(4673) then W(4600)
- Do NOT enter until one line breaks decisively

---

## DOCUMENTS CREATED
- TradeSetupReference_v2.docx
- CheatSheet_v2.docx
- NextWeek_TradingPlaybook.docx
- MGC_TradePlan.docx
- MNQ_TradePlan.docx
- DailyCheatSheet.docx
- TrendlineBreakAlerts.ts (ThinkScript)
- TradeTemplate_v3.docx
- SetupGrades.docx
- MASTER_MEMORY.md — this file, stored in GitHub repo root

---

## GRADING QUICK REFERENCE (print this)

**Step 1 — Grade Action Line:**
- 3+ touches AND 1 week+ = ★ Strong
- Anything else = Standard

**Step 2 — Grade Safety Line:**
- 3+ touches AND 1 week+ = ★ Strong
- Either missing = Weak

**Step 3 — Setup grade:**
- ★Strong + ★Strong = A+
- ★Strong + Weak = A
- Standard + ★Strong = A
- Standard + Weak = A-
- AL not crossed = Skip

**Step 4 — Final checklist:**
| Check | Required |
|---|---|
| AL crossed? | Yes — hard rule |
| R:R | 1.5:1 minimum |
| Session | 07-11 EST or 19-23 EST |
| Apex? | No — wait for break |
| Dead zone? | No entries 23-07 EST |
| Late session? | No entries 15-19 EST |

---

## HOW TO RESUME THIS SESSION

When starting a new conversation:
1. Upload this file
2. Say: "read this and pick up where we left off"
3. Share any new charts or trades since April 9, 2026

The AI coach will have full context of your 72 trades, strategy rules, web app, lessons learned, and chart bias immediately.
