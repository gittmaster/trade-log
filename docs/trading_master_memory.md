# Trading Master Memory File
*Last updated: May 10, 2026*

---

## INSTRUMENTS
- MGC (Micro Gold Futures)
- MNQ (Micro Nasdaq Futures)
- Multiple accounts: A1, A2
- **Trading 1 contract, sometimes 2 — partial profit NOT possible**
- App supports any instrument via custom symbol + multiplier field

---

## COMPLETE STRATEGY (Documented May 1, 2026)

### Entry
- Wait for AL trendline to fully break/cross — never anticipate
- At least ONE side (AL or SL) must have 3+ touches minimum
- Same-day touch does NOT count toward touch total

### Stop Loss
- Initial stop placed AT the SL trendline level
- Trail the stop along the SL as price moves in your favor
- 1-hour timeframe = fake-outs are common, stop needs wiggle room
- **Never move stop to breakeven** — 1-hour fake-outs will shake you out of good trades
- **Never remove stop completely** — Trade 84 lesson, never again

### Target
- Target is ALWAYS the next major S/R level (W/M/4 levels) or HTF trendline confluence
- Must be able to name the specific level before entering — no arbitrary numbers
- Key MGC levels: W($4900), 4($4642.1), W($4600), M($4600), M($4400)

### Intraday SL Management (Discretionary)
- Watch price behavior AT the SL line in real time
- Read: candle pattern + time spent at level + rejection signal
- If price crosses SL but shows rejection candle → can hold, may be fake-out
- If price crosses SL and keeps moving aggressively → real break, exit immediately

### Overnight Hold Rules
- Hard stop at SL — no changes, no discretion
- R:R must be 2:1+ from current price to justify hold
- Know combined max loss before holding — must be acceptable
- If target is at a major W/M level → adds confluence for hold

---

## CORE STRATEGY CONCEPTS

### Action Line (AL)
- The trendline that price must CROSS/BREAK to trigger entry
- AL break = entry signal

### Safety Line (SL)
- The trendline used to place the STOP LOSS
- Stop is placed AT the SL level
- Trail stop along SL as price moves in your favor
- **Tiers matter: Primary > Secondary > Tertiary**

### Trendline Tiers
| Tier | Reliability | Notes |
|---|---|---|
| **Primary** | Highest | Main trendline, most touches, oldest |
| **Secondary** | Medium | Supporting trendline |
| **Tertiary** | Lowest | –$460 in April, weakest signal |

### ⚠️ TERTIARY SL CROSS = EXIT SIGNAL
**When price closes a 1-hour candle through the Tertiary SL while in a trade → EXIT IMMEDIATELY**

### Grading System
| Grade | AL | SL |
|---|---|---|
| **A+** | ★ Strong | ★ Strong |
| **A** | Standard | ★ Strong |
| **A-** | Standard | Weak |

### Line Strength Classification
| Strength | Touches | Age |
|---|---|---|
| **★ Strong** | 3+ touches | 1 week+ |
| **Standard** | 2 touches | Less than 1 day |
| **Weak** | 2 touches | Less than 1 week |

---

## STRATEGY DEFINITIONS (AL/SL Combination Based)

Four strategies defined by AL/SL touch count and age. Auto-assigned by the app.

**Assignment logic:**
- AL strong = `al_touches >= 3` AND `al_age === '1wk+'`
- SL strong = `sl_touches >= 3` AND `sl_age === '1wk+'`

| Strategy ID | Icon | Name | AL | SL | Color |
|---|---|---|---|---|---|
| `strat-aplus-prime` | ⭐ | A+ Prime | Strong | Strong | Green |
| `strat-strong-al-weak-sl` | 📈 | Strong AL / Weak SL | Strong | Weak | Blue |
| `strat-weak-al-strong-sl` | 🛡️ | Weak AL / Strong SL | Weak | Strong | Amber |
| `strat-both-weak` | ⚠️ | Both Weak | Weak | Weak | Red |

**Historical performance:**
| Strategy | Result |
|---|---|
| A+ Prime (3+t 1wk+ both sides) | +$3,311 · 88% WR ✅ |
| Strong AL / Weak SL | +$1,090–$1,173 ✅ |
| Weak AL / Strong SL | +$959 ✅ |
| Both Weak | –$228 to –$1,136 ❌ |

---

## CRITICAL RULES

### Entry Rules
1. Wait for AL to fully break/cross before entering — never anticipate
2. At least ONE side (AL or SL) must have 3+ touches minimum
3. Same-day touch does NOT count toward touch count
4. If the confirming touch happened today → downgrade that line's strength
5. **LONG trades require A+ grade minimum — longs are net –$1,736 all-time**
6. **No trades on Thursday unless A+ grade — Thursday is only losing day (–$1,210)**
7. **After any loss → mandatory 30-minute break before next entry**
8. **Best trading window is 09:00–13:00 EST (+$2,886)**

### Exit Rules
1. **Tertiary SL cross on 1-hour close → EXIT. No exceptions.**
2. **Aggressive move through Primary/Secondary SL → EXIT. Don't wait for candle close.**
3. **Slow/rejected move through SL → can hold, watch next candle**
4. Target must be a named level — W/M/4 or HTF trendline confluence
5. Cannot do partial profit (1 contract) — stop management is the ONLY tool

### Session Rules
| Session | Window | Rule |
|---|---|---|
| Pre-open / Morning | 07:00–15:00 EST | ✅ Best entries |
| Late session dead zone | 15:00–19:00 EST | ❌ No new entries |
| Overnight carry | 19:00–23:00 EST | ✅ Valid hold window |
| Dead zone | 23:00–07:00 EST | ❌ No entries |

---

## BIGGEST BEHAVIORAL MISTAKES

1. **Ignoring Tertiary SL Cross** — Trades 91 & 92: +$1,000 → –$560 swing
2. **Closing Winners Too Early** — Let target work unless SL cross or session rule
3. **Taking A- with Weak SL** — –$1,001 across 35 trades
4. **Same-Day SL Touch** — Last touch must be at least 1 day old
5. **Removing Stop Completely** — Trade 84, never again
6. **Trading Longs** — Net –$1,736 all-time; only at A+ grade
7. **Revenge Trading** — 44 trades: 39% WR, –$1,052; mandatory 30-min break after loss
8. **Trading Thursday** — 18 trades, 44% WR, –$1,210; A+ only
9. **Outside 09:00–15:00** — Late session + dead zone combined: –$1,434

---

## TRADE STATISTICS

### All-time (93 trades, Mar 1 – Apr 30, 2026)
| Metric | Value |
|---|---|
| Total trades | 93 |
| Overall P&L | +$4,217 (est.) |
| Win rate | 50% |
| Avg win | +$312 |
| Avg loss | –$272 |

### Direction Bias (All-time)
| Direction | Trades | WR | P&L |
|---|---|---|---|
| Short | 49 | 51% | **+$4,820** ✅ |
| Long | 40 | 45% | **–$1,736** ❌ |

### Day of Week (All-time)
| Day | Trades | WR | P&L |
|---|---|---|---|
| Mon | 12 | 42% | +$734 |
| Tue | 18 | 50% | +$745 |
| Wed | 25 | 48% | +$1,696 |
| **Thu** | **18** | **44%** | **–$1,210** ❌ |
| Fri | 12 | 58% | +$1,007 |

### Time of Day (All-time)
| Window | Trades | WR | P&L |
|---|---|---|---|
| 07–09 Pre-open | 9 | 56% | +$407 |
| **09–11 Open** | **17** | **53%** | **+$1,768** ✅ |
| **11–13 Mid-AM** | **17** | **59%** | **+$1,118** ✅ |
| 13–15 Mid-PM | 9 | 44% | +$722 |
| 15–19 Late | 11 | 27% | –$944 ❌ |
| 19–23 Overnight | 23 | 52% | +$625 |
| 23–07 Dead | 2 | 0% | –$490 ❌ |

---

## ACTIVE TRADES LOG
*No active trades as of May 10, 2026.*

---

## KEY LEVELS — MGC
- W($4900) — Weekly resistance ceiling
- 4($4642.1) — Key intermediate level
- W($4600) — Weekly support floor
- M($4600) — Monthly support (converges with HTF green ascending line)
- M($4400) — Deep monthly support

---

## NOTES FOR NEXT SESSION
- All 93 trades auto-assigned to strategies via ⚡ Auto-assign on Strategies page
- `strategy_id` column added to Supabase `trades` table (SQL: `ALTER TABLE trades ADD COLUMN IF NOT EXISTS strategy_id text;`)
- New trades require strategy selection before logging
- Continue logging all trades at trendline-trades.vercel.app

---

## WEB APP CHANGELOG
| Date | Feature |
|---|---|
| Apr 2026 | Initial app built — trade log, Supabase backend, login |
| May 1, 2026 | Added AL/SL tier tracking (Primary/Secondary/Tertiary) |
| May 1, 2026 | Added weekly/monthly progress chart with Chart.js |
| May 2, 2026 | Made Progress + Key Levels sections collapsible |
| May 2, 2026 | Added pagination to trade table — 25 trades per page |
| May 4, 2026 | Key Levels panel — symbol tabs, clear button |
| May 9, 2026 | **Major rewrite — multi-page app v2** |
| May 9, 2026 | Sidebar navigation: Dashboard, Reports, Trade View, Strategies |
| May 9, 2026 | Global date range picker (dual-month calendar + presets) + Account filter |
| May 9, 2026 | Dashboard — stats, insight cards, progress calendar (default expanded) |
| May 9, 2026 | Reports — Overview tab: cumulative + daily P&L charts, daily/weekly/monthly toggle |
| May 9, 2026 | Reports — By Strategy tab: comparison table, win rate chart, P&L chart, donut, long/short breakdown |
| May 9, 2026 | Trade View — full trade table showing ALL trades (not date filtered), strategy filter pills |
| May 9, 2026 | Trade View — Key Levels & Pre-Trade Check moved here |
| May 9, 2026 | Strategies page — 4 AL/SL strategies pre-built, ⚡ Auto-assign all trades button |
| May 9, 2026 | Strategies page — bulk trade assignment panel with manual assign/unassign |
| May 9, 2026 | Strategy field mandatory on trade form — cannot log without selecting strategy |
| May 9, 2026 | ⚠️ No Strategy badge + warning banner on trades without strategy |
| May 9, 2026 | Added `strategy_id` column to Supabase trades table |
| May 9, 2026 | AI Chat floating button — 🤖 green with shadow, embedded mode inside panel |
| May 9, 2026 | Progress calendar — default expanded, shows on Dashboard |
| May 9, 2026 | P&L values shown as inline labels on daily bar chart |
| May 9, 2026 | Weekly/Monthly toggle on P&L charts |
| May 10, 2026 | Sidebar nav — font-size 14px, font-weight 500, brighter color |
| May 10, 2026 | Dashboard stat cards — values font-size 22px, font-weight 600 |
| May 10, 2026 | Reports metric cards — values font-size 17px, font-weight 600, uppercase labels |
| May 10, 2026 | Reports section titles — font-weight 600 |
