# Trade-Log Project Instructions

## Shell
All commands are for **PowerShell**. Use `;` as the statement separator (not `&&`).

---

## Project Paths
| Role | Path |
|------|------|
| Downloads (source) | `C:\Users\lax46\Downloads\` |
| Project folder | `C:\Users\lax46\Downloads\trade-log\trade-log\` |
| GitHub remote | origin/main (already configured) |

---

## Check-in a File (One-Line Command)

Replace `<filename>` and `<message>` each time:

```cmd
xcopy /Y "C:\Users\lax46\Downloads\<filename>" "C:\Users\lax46\Downloads\trade-log\trade-log\"; git -C "C:\Users\lax46\Downloads\trade-log\trade-log" add .; git -C "C:\Users\lax46\Downloads\trade-log\trade-log" commit -m "<message>"; git -C "C:\Users\lax46\Downloads\trade-log\trade-log" push
```

**Example** — checking in a new trades CSV:
```cmd
xcopy /Y "C:\Users\lax46\Downloads\trades.csv" "C:\Users\lax46\Downloads\trade-log\trade-log\"; git -C "C:\Users\lax46\Downloads\trade-log\trade-log" add .; git -C "C:\Users\lax46\Downloads\trade-log\trade-log" commit -m "add trades.csv"; git -C "C:\Users\lax46\Downloads\trade-log\trade-log" push
```

---

## Check-in the Memory File

```cmd
xcopy /Y "C:\Users\lax46\Downloads\trading_master_memory.md" "C:\Users\lax46\Downloads\trade-log\trade-log\"; git -C "C:\Users\lax46\Downloads\trade-log\trade-log" add .; git -C "C:\Users\lax46\Downloads\trade-log\trade-log" commit -m "update memory"; git -C "C:\Users\lax46\Downloads\trade-log\trade-log" push
```

---

## Trading Session Workflow

### Start of Session
1. Upload `trading_master_memory.md` → Claude loads context
2. Tell Claude any open trades from prior session

### During Session — Chart Analysis
1. Share chart screenshot
2. Claude returns graded Trade Decision Card
3. Act only on TAKE verdicts with valid session window

### End of Session
1. Tell Claude: **"update memory file"**
2. Download `trading_master_memory.md` from output
3. Run the memory file check-in command above

---

## Trade Decision Card (what Claude always outputs)

```
📊 Trade Decision
Factor          Detail                  Status
Direction       Long / Short
AL              X touches, age          ★ Strong / Standard / Weak
SL              X touches, age          ★ Strong / Standard / Weak
4-Touch Rule    AL or SL has 4 touches? ✅ Pass / ❌ Fail
AL Broken?      Yes / No / Waiting      ✅ / ❌ / ⏳
Apex Compress?  Yes / No                ✅ Clear / ❌ Skip
Session         Time EST                ✅ Valid / ❌ Dead zone
R:R             X:1                     ✅ / ❌
🏆 Grade: [A+ / A / A- / SKIP]
🚦 Verdict: [TAKE / WAIT / SKIP]
Reason: Single most important factor.
```

---

## Hard Rules (Never Break)

| Rule | Detail |
|------|--------|
| 4-Touch Rule | At least one side (AL or SL) must have 4 touches — else SKIP |
| Same-day touch | Does NOT count toward touch total |
| Stop placement | Always at SL level — never move to breakeven |
| Entry timing | No entries 15:00–19:00 or 23:00–07:00 EST |
| AL not broken | Never enter before confirmed break |
| Early exit | Hold to target — avg gain when held: **+$412** |
| A- with Weak SL | 35 trades = –$1,001. Skip unless SL has 4+ touches |

---

## Grade Reference

| Grade | AL | SL |
|-------|----|----|
| A+ | ★ Strong (3+ touches, 1wk+) | ★ Strong |
| A | Standard | ★ Strong |
| A- | Standard | Weak |
| SKIP | Neither side has 4 touches | — |

---

## Session Windows (EST)

| Window | Hours | Rule |
|--------|-------|------|
| Morning | 07:00–15:00 | ✅ Best entries |
| Late session | 15:00–19:00 | ❌ No new entries |
| Overnight carry | 19:00–23:00 | ✅ Valid hold |
| Dead zone | 23:00–07:00 | ❌ No entries, avoid holds |

---

## Key MGC Price Levels

| Level | Type | Note |
|-------|------|------|
| $4,900 | W resistance | Ceiling |
| $4,642.1 | 4H level | Strong magnetic target |
| $4,600 | W/M support | Floor |
