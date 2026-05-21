// ── TOS Account Statement Parser ─────────────────────────────────────────────
// Parses TOS CSV exports and returns structured trade data with
// entry, exit, actual stop prices from OCO orders, and daily P&L checkpoints

const MULT = { MGC: 10, MNQ: 2, MYM: 0.5, MCL: 100 };
const SYM_MAP = {
  MGCM26:'MGC', MGCN26:'MGC', MGCG26:'MGC', MGCJ26:'MGC',
  MNQM26:'MNQ', MNQN26:'MNQ', MNQH26:'MNQ',
  MYMM26:'MYM', MYMN26:'MYM',
  MCLJ26:'MCL', MCLM26:'MCL',
};

function normSym(raw) {
  const s = raw.replace('/', '').split(':')[0];
  return SYM_MAP[s] || s.slice(0, 3);
}

function parseCSVLine(line) {
  const result = [];
  let cur = '', inQuote = false;
  for (const ch of line) {
    if (ch === '"') { inQuote = !inQuote; }
    else if (ch === ',' && !inQuote) { result.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  result.push(cur.trim());
  return result;
}

function parseDate(d, t) {
  // handles m/d/yy and m/d/yyyy
  const [mo, day, yr] = d.split('/');
  const year = yr.length === 2 ? '20' + yr : yr;
  return new Date(`${year}-${mo.padStart(2,'0')}-${day.padStart(2,'0')}T${t}`);
}

export function parseTOSStatement(csvText) {
  const lines = csvText.split('\n');

  // ── section indices ───────────────────────────────────────────────────
  const futIdx = lines.findIndex(l => l.includes('Futures Statements'));
  const ordIdx = lines.findIndex(l => l.includes('Account Order History'));
  const trdIdx = lines.findIndex(l => l.includes('Account Trade History'));
  const plIdx  = lines.findIndex(l => l.includes('Profits and Losses'));

  // ── 1. Parse fills ────────────────────────────────────────────────────
  const fills = [];
  const adjRows = []; // mark-to-market daily settlements

  for (const line of lines.slice(futIdx + 1)) {
    if (line.includes('Forex Statements') || line.includes('Account Order')) break;
    if (!line.includes(',TRD,') && !line.includes(',ADJ,')) continue;

    const p = parseCSVLine(line);
    if (p.length < 9) continue;

    if (line.includes(',TRD,')) {
      const desc = p[5];
      const m = desc.match(/^(BOT|SOLD)\s+([+-]?\d+)\s+\/(\w+)(?::\w+)?\s+@([\d.]+)/);
      if (!m) continue;
      const [, side, qty, symRaw, price] = m;
      const execDate = p[1], execTime = p[2];
      if (!execDate || !execTime || execDate === '--') continue;
      try {
        const dt = parseDate(execDate, execTime);
        fills.push({
          dt, side,
          qty:    Math.abs(parseInt(qty)),
          symbol: normSym(symRaw),
          price:  parseFloat(price),
        });
      } catch {}

    } else if (line.includes(',ADJ,')) {
      const desc = p[5];
      const m = desc.match(/\/(\w+).*@([\d.]+)/);
      if (!m) continue;
      const execDate = p[1], execTime = p[2];
      const amt = p[8]?.replace(/[$,"]/g,'');
      if (!execDate || execDate === '--') continue;
      try {
        adjRows.push({
          dt:     parseDate(execDate, execTime),
          symbol: normSym(m[1]),
          settle: parseFloat(m[2]),
          change: amt ? parseFloat(amt) : 0,
        });
      } catch {}
    }
  }

  // ── 2. Parse Order History for OCO stop prices ────────────────────────
  const ocoStops = {};   // oco_id -> stop price
  const ocoTargets = {}; // oco_id -> target price

  const ohEnd = trdIdx > ordIdx ? trdIdx : lines.length;
  for (const line of lines.slice(ordIdx, ohEnd)) {
    const p = parseCSVLine(line);
    if (!p[3]?.startsWith('OCO #')) continue;
    const ocoId    = p[3].trim();
    const priceCol = p[11]?.replace(/[$,"]/g,'')?.trim();
    const typeCol  = p[12]?.trim();
    if (!priceCol || isNaN(parseFloat(priceCol))) continue;
    const price = parseFloat(priceCol);
    if (typeCol === 'STP')       ocoStops[ocoId]   = price;
    else if (typeCol === 'LMT')  ocoTargets[ocoId] = price;
  }

  // Also extract stop from TRG lines (triggered stops)
  // TRG BY lines link fills to their OCO group
  const fillToOco = {}; // ref# -> oco_id
  for (const line of lines.slice(ordIdx, ohEnd)) {
    const p = parseCSVLine(line);
    if (p[3]?.startsWith('OCO #') && p[2]) {
      fillToOco[p[2]] = p[3];
    }
  }

  // ── 3. Match fills into round trips ───────────────────────────────────
  const openPos = {};
  const roundTrips = [];

  for (const f of [...fills].sort((a, b) => a.dt - b.dt)) {
    const sym  = f.symbol;
    const mult = MULT[sym] || 1;
    if (!openPos[sym]) openPos[sym] = [];
    const opens = openPos[sym];

    if (f.side === 'BOT') {
      const short = opens.find(o => o.direction === 'short');
      if (short) {
        opens.splice(opens.indexOf(short), 1);
        const pts = round2(short.price - f.price);
        const pnl = round2(pts * mult * short.qty);
        roundTrips.push({
          symbol: sym, direction: 'short',
          entry_dt: short.dt, exit_dt: f.dt,
          entry: short.price, exit: f.price,
          qty: short.qty, pnl,
          duration_hrs: (f.dt - short.dt) / 3600000,
        });
      } else {
        opens.push({ dt: f.dt, price: f.price, qty: f.qty, direction: 'long' });
      }
    } else if (f.side === 'SOLD') {
      const long = opens.find(o => o.direction === 'long');
      if (long) {
        opens.splice(opens.indexOf(long), 1);
        const pts = round2(f.price - long.price);
        const pnl = round2(pts * mult * long.qty);
        roundTrips.push({
          symbol: sym, direction: 'long',
          entry_dt: long.dt, exit_dt: f.dt,
          entry: long.price, exit: f.price,
          qty: long.qty, pnl,
          duration_hrs: (f.dt - long.dt) / 3600000,
        });
      } else {
        opens.push({ dt: f.dt, price: f.price, qty: f.qty, direction: 'short' });
      }
    }
  }

  // ── 4. Enrich each round trip with stops, targets, checkpoints ────────
  const stopList   = Object.values(ocoStops);
  const targetList = Object.values(ocoTargets);

  for (const rt of roundTrips) {
    const mult = MULT[rt.symbol] || 1;

    // find the closest stop price that makes sense for this trade's direction
    const isLong = rt.direction === 'long';
    const validStops = stopList.filter(s =>
      isLong ? s < rt.entry : s > rt.entry
    ).sort((a, b) =>
      isLong
        ? Math.abs(a - rt.entry) - Math.abs(b - rt.entry)
        : Math.abs(a - rt.entry) - Math.abs(b - rt.entry)
    );
    rt.tos_stop = validStops[0] || null;

    // find daily settlement checkpoints during this trade
    rt.checkpoints = adjRows
      .filter(a =>
        a.symbol === rt.symbol &&
        a.dt >= rt.entry_dt &&
        a.dt <= rt.exit_dt
      )
      .map(a => {
        const running_pts = isLong
          ? a.settle - rt.entry
          : rt.entry - a.settle;
        return {
          dt:          a.dt,
          settle:      a.settle,
          running_pnl: round2(running_pts * mult * rt.qty),
        };
      });

    // build a point list: [entry=0, ...checkpoints, exit=pnl]
    // This is the actual data we have — not estimated
    rt.pnl_points = [
      { dt: rt.entry_dt, pnl: 0, type: 'entry' },
      ...rt.checkpoints.map(c => ({ dt: c.dt, pnl: c.running_pnl, type: 'settle' })),
      { dt: rt.exit_dt,  pnl: rt.pnl, type: 'exit' },
    ];

    // MAE/MFE from checkpoints + exit
    const pnls = rt.pnl_points.map(p => p.pnl);
    rt.mfe = Math.max(...pnls, 0);
    rt.mae = Math.min(...pnls, 0);
  }

  // ── 5. Parse Profits & Losses section ────────────────────────────────
  const plRows = [];
  if (plIdx >= 0) {
    for (const line of lines.slice(plIdx + 2)) {
      if (!line.trim() || line.startsWith('Account')) break;
      const p = parseCSVLine(line);
      if (p[0] && p[0].startsWith('/')) {
        const ytd = p[5]?.replace(/[$,"()]/g, '');
        plRows.push({
          symbol:  normSym(p[0].slice(1)),
          desc:    p[1],
          pl_ytd:  ytd ? parseFloat(ytd) * (p[5]?.includes('(') ? -1 : 1) : null,
        });
      }
    }
  }

  return {
    account:     lines[0]?.match(/for (\w+)/)?.[1] || 'Unknown',
    roundTrips,
    adjRows,
    ocoStops,
    ocoTargets,
    plRows,
    summary: {
      total:   roundTrips.length,
      wins:    roundTrips.filter(r => r.pnl > 0).length,
      losses:  roundTrips.filter(r => r.pnl < 0).length,
      net:     round2(roundTrips.reduce((s, r) => s + r.pnl, 0)),
    },
  };
}

// ── Match TOS round trips to journal trades ───────────────────────────────
export function matchTOSToJournal(tosData, journalTrades) {
  const matched = [];

  for (const rt of tosData.roundTrips) {
    // find journal trade with same symbol + direction + entry within 5pts + entry date within 1 day
    const jt = journalTrades.find(t => {
      if (!t.entry || !t.date) return false;
      const sameSym = (t.symbol || '').toUpperCase() === rt.symbol;
      const sameDir = (t.direction || '').toLowerCase() === rt.direction;
      const entryDiff = Math.abs(parseFloat(t.entry) - rt.entry);
      const dateDiff  = Math.abs(new Date(t.date + 'T12:00:00') - rt.entry_dt) / 86400000;
      return sameSym && sameDir && entryDiff < 5 && dateDiff < 2;
    });

    matched.push({
      tos:     rt,
      journal: jt || null,
      matched: !!jt,
    });
  }

  return matched;
}

function round2(n) { return Math.round(n * 100) / 100; }
