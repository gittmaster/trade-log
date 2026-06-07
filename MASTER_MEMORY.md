# Trading Master Memory
Last updated: June 07, 2026

---

## Active Trades
None open as of end of session June 7, 2026.

---

## App Status
- **Live URL:** trendline-trades.vercel.app
- **Stack:** React (CRA) + Supabase
- **Repo:** github.com/gittmaster/trade-log
- **Version:** v2.0

---

## Trade Statistics (as of June 7, 2026)
- Total trades: 136
- Net P&L: ~+$1,800 (journal) / broker TOS varies by account
- Win rate: ~46%
- Accounts: A1 (68927454SCHW), A2 (69559962SCHW)

---

## Week of June 2–5, 2026 — Performance Review
- **Net: -$3,755 | 10 trades | 0% win rate**
- 9 of 10 trades were A- (broke the A- ban decided May 21)
- June 5: 3 trades in one day totaling -$2,014 — confirmed revenge trading in notes
- Stop removed twice (June 4 -$1,225, June 5 -$1,301) — both MGC longs, no AL cross
- Doubled both accounts on 3 A- setups this week

---

## Key Behavioral Insights (from 136-trade data analysis)

### Stop Removal — The Real Numbers
- **5 stop removals total → -$3,164**
- **2 actual fakeouts (stop hit, price reversed) → -$527**
- Cost of avoiding fakeouts: 6x more than the fakeouts themselves
- All 5 stop removals were MGC longs in pre-market/pre-open during a downtrend
- Pattern: entered at SL without AL cross, went up ~$200, removed stop hoping for bigger move, reversed hard

### Buying at SL Without AL Cross
- 4 trades, 0% win rate, -$3,238 total, avg -$810
- This is an experiment that has definitively failed — zero wins across all attempts
- Every note on these trades ends with "should have waited for AL"

### Same Setup Both Accounts (Doubling)
- 15 instances total — **10 losses, 5 wins, net -$656**
- 10 of 15 were A- grade — doubling on worst setups, not best
- A+ doubles: only 2 trades, 50% WR, -$126 net
- Worst doubles all occurred during emotional states: revenge trading, bounce plays, borderline setups
- Rule confirmed: **Only double (both accounts) on A+ Prime setups**

### Early Exit Leak
- 9 trades where notes confirm target was hit after manual close
- Avg target hit when held = +$412
- Psychology-driven closes after prior losses are the #1 source of missed profit

### Fakeout Fear vs Reality
- Fakeouts are real but rare (1.5% of trades)
- The stop IS the edge — it keeps -$200 from becoming -$1,300
- Mindset shift: stop is not there to be right, it's there to keep you in the game
- When tempted to remove stop → move to breakeven instead

---

## Behavioral Rules (Active)
1. **STOP ALL A- TRADES** — 136 trades, consistent net negative. Decided May 21, reconfirmed June 7.
2. **Never remove stop** — 5 removals = -$3,164. Move to breakeven if needed, never remove.
3. **Never buy at SL without AL cross** — 0% win rate across 4 attempts, avg -$810
4. **Only double both accounts on A+ Prime** — 10/15 doubles were A-, all losing
5. **Never exit early** — avg target = +$412 when held. Close only at target or stop.
6. **Same-day touch = doesn't count** toward touch total
7. **4-Touch Rule** — at least one side must have 4 touches, no exceptions
8. **Minimum 1.5:1 R:R** — sub-1.5 cost -$834 historically
9. **Sweet spot R:R = 2:1–2.9** — 62% WR. 3:1+ drops to 25% WR (targets too far)

---

## Mindset Pattern to Watch
**The Removal Sequence** — happens every time:
1. Take a loss or slow trade
2. Feel need to recover
3. Enter without AL (or weak setup)
4. Trade goes against you
5. Start negotiating with market — "this is a fakeout, it always bounces here"
6. Remove stop to give it room
7. It doesn't bounce

**The size-up trap** — you double on both accounts when you're most emotional (after a loss, on bounce plays). You almost never double on A+ confirmed setups. This is the reverse of correct position sizing.

---

## Key Price Levels — MGC
- W($4900) — Weekly resistance ceiling
- W($4600) — Weekly support floor
- M($4600) — Monthly support
- 4($4642.1) — Key intermediate level

---

## Pages / Features Built
- **Atlas AI Home** — default landing page, gold theme, inline chat, stats, quick prompts, recommended focus cards
- **Dashboard** — stats, insight cards, progress calendar with day-click trade detail panel
- **Reports** — cumulative + daily P&L charts, by strategy, by day of week
- **Trade View** — full trade table, MFE/MAE fields in new trade form, strategy filter pills, Key Levels widget
- **Strategies** — 4 AL/SL strategies, auto-assign
- **Analysis** — TOS statement import, 5 charts, TOS daily P&L calendar, AI Analysis tab, strategy/MFE/MAE editable in day modal
- **Floating AI Chat** (💬) — on all pages except Analysis
- **TradeReviewChart** — running P&L path chart, money left on table analysis

---

## Recent App Changes (June 2026)
- Dashboard calendar day cells → clickable → slide-in trade detail panel with P&L curve + stats
- Dashboard trade detail panel → click trade row → sub-panel with running P&L chart + chart image
- Dashboard calendar → month nav arrows + This month button
- Analysis TOS calendar → centered modal on day click with strategy dropdown + MFE/MAE inputs (saves to Supabase)
- Analysis equity curve → sums both accounts by date (no duplicate points)
- Analysis June data fix → uses statement period end date for month detection
- All AI chats → markdown table rendering + formatting rules in system prompt
- Atlas AI → recommended focus cards (4 quick analysis prompts)
- TradeReviewChart → running P&L path chart now renders
- MFE/MAE fields added to new trade form in TradeView
- TOSUploader drag/drop fix → onDragLeave uses relatedTarget

---

## Key Files & Locations
```
src/App.js                         — main app, routing, sidebar
src/pages/AtlasHome.jsx            — Atlas AI home
src/pages/Analysis.jsx             — TOS analysis + AI chat
src/pages/TradeView.jsx            — trade log + new trade form
src/pages/Dashboard.jsx            — dashboard + day detail panels
src/pages/Reports.jsx              — reports
src/pages/Strategies.jsx           — strategies
src/AIChat.js                      — floating AI chat
src/components/TOSUploader.jsx     — TOS CSV parser
src/components/TOSParser.js        — TOS parsing logic
src/components/TradeReviewChart.jsx — review panel + running P&L
src/supabase.js                    — Supabase client
```

---

## Environment Variables (Vercel)
- `REACT_APP_ANTHROPIC_API_KEY` — All Environments ✅
- `REACT_APP_SUPABASE_ANON_KEY` — All Environments ✅
- `REACT_APP_PASSWORD` — Production and Preview ✅

---

## Deployment Workflow
```powershell
cd "C:\Users\lax46\Downloads\trade-log\trade-log"
Copy-Item "$env:USERPROFILE\Downloads\<file>" -Destination "src\<path>\<file>" -Force
git add src/<path>/<file>
git commit -m "<message>"
git push
```

**Important:** Always use Claude's output file, not the local repo version — local repo may be missing injected functions.

---

## Resume Instructions
1. Upload this file at start of new conversation
2. Say "resume trading master memory"
3. Confirm active trades, then proceed
