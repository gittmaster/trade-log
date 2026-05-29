# Trading Master Memory
Last updated: May 28, 2026

---

## Active Trades
None open as of end of session May 28, 2026.

---

## App Status
- **Live URL:** trendline-trades.vercel.app
- **Stack:** React (Vite/CRA) + Supabase
- **Repo:** github.com/gittmaster/trade-log
- **Version:** v2.0

---

## Trade Statistics (as of May 28, 2026)
- Total trades: 122
- Net P&L: +$2,448 (TOS broker statements show +$5,598 across 128 trades)
- Win rate: ~48–64% depending on filter
- Accounts: A1, A2

---

## Pages / Features Built
- **Atlas AI Home** — default landing page, gold theme, inline chat (no floating panel), stats, quick prompts
- **Dashboard** — stats, insight cards, progress calendar
- **Reports** — cumulative + daily P&L charts, by strategy, by day of week
- **Trade View** — full trade table, strategy filter pills, Key Levels widget, alternating row colors
- **Strategies** — 4 AL/SL strategies, auto-assign
- **Analysis** — TOS statement import, charts (equity curve, P&L by symbol, stop distance, hold time, multiday), AI Analysis tab with inline chat (📈 icon, separate from floating bot)
- **Floating AI Chat** (💬 green button) — on all pages except Analysis

---

## Recent Changes (May 28, 2026)
1. **Atlas AI Home page** — new default landing page with gold theme, inline chat, stats row, quick prompts, shrinks to header when chat opens
2. **Analysis AI Chat tab** — separate from floating bot, reads TOS data as context, uses `REACT_APP_ANTHROPIC_API_KEY` (process.env), `anthropic-dangerous-direct-browser-access: true`
3. **TOS AI context enriched** — hold time winners vs losers, month-over-month with hold times, all 128 trades sent as context, long/short breakdown
4. **New Trade form** — all defaults removed, must touch every field; entry date/time + exit date/time auto-fill to today + current EST time
5. **Required field validation** — red outline + "required" label on all empty fields when Log Trade clicked, scrolls to first error
6. **API key fix** — app uses `process.env.REACT_APP_ANTHROPIC_API_KEY` (CRA syntax, not Vite), Vercel variable confirmed working

---

## Known Issues / Pending
- TradeView alternating row colors — was being worked on, confirm if deployed
- Atlas AI home inline chat — just deployed May 28, confirm it works on live site

---

## Key Files & Locations
```
src/App.js                    — main app, routing, sidebar, EMPTY_FORM defaults
src/pages/AtlasHome.jsx       — Atlas AI home page with inline chat
src/pages/Analysis.jsx        — TOS analysis + AI chat tab
src/pages/TradeView.jsx       — trade log table + new trade form
src/pages/Dashboard.jsx       — dashboard
src/pages/Reports.jsx         — reports
src/pages/Strategies.jsx      — strategies
src/AIChat.js                 — floating AI chat (all pages)
src/components/TOSUploader.jsx — TOS CSV parser (calculates duration_hrs)
src/components/TOSParser.js   — TOS parsing logic
src/supabase.js               — Supabase client
```

---

## Environment Variables (Vercel)
- `REACT_APP_ANTHROPIC_API_KEY` — All Environments ✅
- `REACT_APP_SUPABASE_ANON_KEY` — All Environments ✅
- `REACT_APP_PASSWORD` — Production and Preview ✅
- `VITE_ANTHROPIC_API_KEY` — All Environments (unused, can delete)

---

## Behavioral Rules (Trading)
1. **Never exit early** — avg target hit = +$412 when held
2. **Never remove stop** — Trade 84 cost –$596
3. **Same-day touch** — does NOT count toward touch total
4. **A- with Weak SL** — 35 trades, –$1,001. Always flag
5. **4-Touch Rule** — at least one side must have 4 touches, no exceptions

---

## Key Price Levels — MGC
- W($4900) — Weekly resistance ceiling
- W($4600) — Weekly support floor
- M($4600) — Monthly support
- 4($4642.1) — Key intermediate level

---

## Deployment Workflow
```powershell
cd "C:\Users\lax46\Downloads\trade-log\trade-log"
# Extract zip from Downloads
Expand-Archive "$env:USERPROFILE\Downloads\<zipfile>.zip" "$env:USERPROFILE\Downloads\<extract-folder>" -Force
# Copy files
Copy-Item "$env:USERPROFILE\Downloads\<extract-folder>\<file>" "src\<path>\<file>" -Force
# Push
git add .
git commit -m "<message>"
git push
```

**Note:** Files must be physically replaced before git detects changes. Use `Select-String` to verify content before pushing.
