import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../supabase';

// ─── Constants ────────────────────────────────────────────────────────────────
const MULT = { MGC: 10, MNQ: 2, MYM: 0.5, MCL: 100 };
const SYM_MAP = {
  MGCM26:'MGC', MGCN26:'MGC', MGCG26:'MGC', MGCJ26:'MGC',
  MNQM26:'MNQ', MNQN26:'MNQ', MNQH26:'MNQ',
  MYMM26:'MYM', MYMN26:'MYM', MCLJ26:'MCL', MCLM26:'MCL',
};

function round2(n) { return Math.round(n * 100) / 100; }
function normSym(raw) { const s = raw.replace('/','').split(':')[0]; return SYM_MAP[s] || s.slice(0,3); }

function parseCSVLine(line) {
  const out = []; let cur = '', q = false;
  for (const ch of line) {
    if (ch === '"') { q = !q; }
    else if (ch === ',' && !q) { out.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function parseDt(d, t) {
  const [mo, day, yr] = d.split('/');
  const year = yr.length === 2 ? '20' + yr : yr;
  return new Date(`${year}-${mo.padStart(2,'0')}-${day.padStart(2,'0')}T${t}`);
}

// ─── Detect account label from file header ────────────────────────────────────
function detectAccount(csvText) {
  const first = csvText.split('\n')[0];
  const m = first.match(/for (\w+)/);
  if (!m) return 'Unknown';
  const num = m[1];
  if (num.includes('7454')) return 'A1';
  if (num.includes('9962')) return 'A2';
  // fallback: try to make it readable
  if (num.includes('SCHW')) return num.replace('SCHW','').slice(-6);
  return num;
}

// ─── Parse TOS account statement CSV ─────────────────────────────────────────
function parseTOS(csvText) {
  const lines  = csvText.split('\n');
  const futIdx = lines.findIndex(l => l.includes('Futures Statements'));
  const ordIdx = lines.findIndex(l => l.includes('Account Order History'));
  const trdIdx = lines.findIndex(l => l.includes('Account Trade History'));
  const plIdx  = lines.findIndex(l => l.includes('Profits and Losses'));

  // 1. Fills + ADJ rows
  const fills = [], adjRows = [];
  for (const line of lines.slice(futIdx + 1)) {
    if (line.includes('Forex Statements') || line.includes('Account Order')) break;
    if (!line.includes(',TRD,') && !line.includes(',ADJ,')) continue;
    const p = parseCSVLine(line);
    if (p.length < 9) continue;

    if (line.includes(',TRD,')) {
      const m = p[5].match(/^(BOT|SOLD)\s+([+-]?\d+)\s+\/(\w+)(?::\w+)?\s+@([\d.]+)/);
      if (!m || !p[1] || p[1] === '--') continue;
      try {
        fills.push({ dt: parseDt(p[1], p[2]), side: m[1],
          qty: Math.abs(parseInt(m[2])), symbol: normSym(m[3]), price: parseFloat(m[4]) });
      } catch {}
    } else if (line.includes(',ADJ,')) {
      const m = p[5].match(/\/(\w+).*@([\d.]+)/);
      if (!m || !p[1] || p[1] === '--') continue;
      try {
        adjRows.push({ dt: parseDt(p[1], p[2]), symbol: normSym(m[1]),
          settle: parseFloat(m[2]),
          change: parseFloat((p[8] || '').replace(/[$,"]/g,'')) || 0 });
      } catch {}
    }
  }

  // 2. OCO stop prices
  const ocoStops = {};
  const ohEnd = trdIdx > ordIdx ? trdIdx : lines.length;
  for (const line of lines.slice(ordIdx, ohEnd)) {
    const p = parseCSVLine(line);
    if (!p[3]?.startsWith('OCO #')) continue;
    const price = parseFloat((p[11] || '').replace(/[$,"]/g,''));
    if (!isNaN(price) && p[12]?.trim() === 'STP') ocoStops[p[3].trim()] = price;
  }

  // 3. Round trips
  const openPos = {}, roundTrips = [];
  for (const f of [...fills].sort((a,b) => a.dt - b.dt)) {
    const sym = f.symbol, mult = MULT[sym] || 1;
    if (!openPos[sym]) openPos[sym] = [];
    const opens = openPos[sym];

    if (f.side === 'BOT') {
      const short = opens.find(o => o.direction === 'short');
      if (short) {
        opens.splice(opens.indexOf(short), 1);
        roundTrips.push({ symbol: sym, direction: 'short',
          entry_dt: short.dt, exit_dt: f.dt, entry: short.price, exit: f.price,
          qty: short.qty, pnl: round2((short.price - f.price) * mult * short.qty),
          duration_hrs: round2((f.dt - short.dt) / 3600000) });
      } else { opens.push({ dt: f.dt, price: f.price, qty: f.qty, direction: 'long' }); }

    } else if (f.side === 'SOLD') {
      const long = opens.find(o => o.direction === 'long');
      if (long) {
        opens.splice(opens.indexOf(long), 1);
        roundTrips.push({ symbol: sym, direction: 'long',
          entry_dt: long.dt, exit_dt: f.dt, entry: long.price, exit: f.price,
          qty: long.qty, pnl: round2((f.price - long.price) * mult * long.qty),
          duration_hrs: round2((f.dt - long.dt) / 3600000) });
      } else { opens.push({ dt: f.dt, price: f.price, qty: f.qty, direction: 'short' }); }
    }
  }

  // 4. Enrich with stops + checkpoints
  const stopList = Object.values(ocoStops);
  for (const rt of roundTrips) {
    const mult = MULT[rt.symbol] || 1;
    const isLong = rt.direction === 'long';
    const valid = stopList.filter(s => isLong ? s < rt.entry : s > rt.entry)
      .sort((a,b) => Math.abs(a - rt.entry) - Math.abs(b - rt.entry));
    rt.tos_stop  = valid[0] || null;
    rt.stop_dist = rt.tos_stop ? Math.abs(rt.entry - rt.tos_stop) : 0;

    rt.checkpoints = adjRows
      .filter(a => a.symbol === rt.symbol && a.dt >= rt.entry_dt && a.dt <= rt.exit_dt)
      .map(a => ({ dt: a.dt, settle: a.settle,
        running_pnl: round2((isLong ? a.settle - rt.entry : rt.entry - a.settle) * mult * rt.qty) }));

    rt.pnl_points = [
      { dt: rt.entry_dt, pnl: 0, type: 'entry' },
      ...rt.checkpoints.map(c => ({ dt: c.dt, pnl: c.running_pnl, type: 'settle' })),
      { dt: rt.exit_dt, pnl: rt.pnl, type: 'exit' },
    ];

    const pnls = rt.pnl_points.map(p => p.pnl);
    rt.mfe = Math.max(...pnls, 0);
    rt.mae = Math.min(...pnls, 0);
  }

  // 5. P&L rows
  const plRows = [];
  if (plIdx >= 0) {
    for (const line of lines.slice(plIdx + 2)) {
      if (!line.trim() || line.startsWith('Account')) break;
      const p = parseCSVLine(line);
      if (p[0]?.startsWith('/')) {
        const ytd = (p[5] || '').replace(/[$,"()]/g,'');
        plRows.push({ symbol: normSym(p[0].slice(1)),
          pl_ytd: ytd ? parseFloat(ytd) * ((p[5]||'').includes('(') ? -1 : 1) : null });
      }
    }
  }

  // Parse cash balance section for equity curve
  const cashBalances = [];
  const cashIdx = lines.findIndex(l => l.trim() === 'Cash Balance');
  if (cashIdx >= 0) {
    for (const line of lines.slice(cashIdx + 2)) {
      if (!line.trim()) break;
      const p = parseCSVLine(line);
      if (p.length < 9 || !p[0] || p[2] !== 'BAL') continue;
      try {
        const bal = parseFloat((p[8] || '').replace(/[$,"]/g, ''));
        if (!isNaN(bal)) cashBalances.push({ date: p[0].trim(), balance: bal });
      } catch {}
    }
  }

  // Period from first line
  const periodMatch = lines[0]?.match(/since (.+?) through (.+)/);
  const period = periodMatch ? periodMatch[1] + ' – ' + periodMatch[2] : '';

  return {
    account: detectAccount(csvText),
    roundTrips, adjRows, plRows, cashBalances, period,
    summary: {
      total:  roundTrips.length,
      wins:   roundTrips.filter(r => r.pnl > 0).length,
      losses: roundTrips.filter(r => r.pnl < 0).length,
      net:    round2(roundTrips.reduce((s,r) => s + r.pnl, 0)),
    },
  };
}

// ─── Match TOS trades to journal ──────────────────────────────────────────────
function matchToJournal(parsed, journalTrades) {
  return parsed.roundTrips.map(rt => {
    const jt = journalTrades.find(t => {
      if (!t.entry || !t.date) return false;
      return (t.symbol||'').toUpperCase() === rt.symbol &&
             (t.direction||'').toLowerCase() === rt.direction &&
             Math.abs(parseFloat(t.entry) - rt.entry) < 5 &&
             Math.abs(new Date(t.date + 'T12:00:00') - rt.entry_dt) / 86400000 < 2;
    });
    return { tos: rt, journal: jt || null, matched: !!jt };
  });
}

// ─── TOSUploader component ────────────────────────────────────────────────────
export default function TOSUploader({ trades, onComplete }) {
  const [state,   setState]   = useState('idle');   // idle | busy | done | error
  const [results, setResults] = useState({});        // { A1: summary, A2: summary }
  const [errMsg,  setErrMsg]  = useState('');
  const [dragging,setDragging]= useState(false);

  const processFiles = useCallback(async (fileList) => {
    if (!fileList || !fileList.length) return;
    setState('busy');
    setErrMsg('');

    const newResults = { ...results };

    for (const file of Array.from(fileList)) {
      if (!file.name.endsWith('.csv')) { setErrMsg('Please select .csv files only'); setState('error'); return; }
      try {
        const text   = await file.text();
        const parsed = parseTOS(text);
        if (!parsed.roundTrips.length) { setErrMsg(`No trades found in ${file.name}`); setState('error'); return; }

        const matched    = matchToJournal(parsed, trades || []);
        const matchCount = matched.filter(m => m.matched).length;

        // Save — supabase upsert then localStorage backup
        const upserts = matched.filter(m => m.matched && m.journal?.id).map(m => ({
          trade_id:    m.journal.id,
          account:     parsed.account,
          tos_entry:   m.tos.entry,
          tos_exit:    m.tos.exit,
          tos_stop:    m.tos.tos_stop,
          tos_pnl:     m.tos.pnl,
          mfe:         m.tos.mfe,
          mae:         m.tos.mae,
          pnl_points:  JSON.stringify(m.tos.pnl_points),
          checkpoints: JSON.stringify(m.tos.checkpoints),
          updated_at:  new Date().toISOString(),
        }));

        if (upserts.length > 0) {
          const { error } = await supabase.from('tos_trade_data').upsert(upserts, { onConflict: 'trade_id' });
          if (error) console.warn('Supabase save failed, using localStorage:', error.message);
          // always save to localStorage as backup
          const local = JSON.parse(localStorage.getItem('tos_trade_data') || '{}');
          upserts.forEach(u => { local[u.trade_id] = u; });
          localStorage.setItem('tos_trade_data', JSON.stringify(local));
        }

        newResults[parsed.account] = {
          account: parsed.account,
          total:   parsed.summary.total,
          wins:    parsed.summary.wins,
          net:     parsed.summary.net,
          matchCount,
          plRows:  parsed.plRows,
        };

        if (onComplete) onComplete(parsed, matched);
      } catch (e) {
        console.error(e);
        setErrMsg(`Error parsing ${file.name}: ${e.message}`);
        setState('error');
        return;
      }
    }

    setResults(newResults);
    setState('done');
  }, [trades, results, onComplete]);

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDragging(false);
    processFiles(e.dataTransfer.files);
  }, [processFiles]);

  const fmt = (v) => v >= 0 ? `+$${Math.abs(Math.round(v)).toLocaleString()}` : `-$${Math.abs(Math.round(v)).toLocaleString()}`;
  const accts = Object.values(results);

  return (
    <div>
      <style>{`@keyframes tos-spin { to { transform: rotate(360deg); } }`}</style>

      {/* Drop zone — always visible, accepts multiple files */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => document.getElementById('tos-multi-input').click()}
        style={{
          border: `1.5px dashed ${dragging ? '#7c3aed' : state === 'error' ? '#ef4444' : state === 'done' ? '#22c55e55' : '#2a3545'}`,
          borderRadius: 8, padding: '14px 20px',
          display: 'flex', alignItems: 'center', gap: 14,
          cursor: state === 'busy' ? 'default' : 'pointer',
          background: dragging ? '#13111e' : '#0a0c11',
          transition: 'all 0.15s',
          marginBottom: accts.length ? 10 : 0,
        }}
      >
        <input id="tos-multi-input" type="file" accept=".csv" multiple
          style={{ display: 'none' }}
          onChange={e => { processFiles(e.target.files); e.target.value = ''; }}
        />

        {state === 'busy' ? (
          <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid #1e2d3d', borderTop: '2px solid #7c3aed', animation: 'tos-spin 0.8s linear infinite', flexShrink: 0 }} />
        ) : (
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" style={{ color: '#4a5568', flexShrink: 0 }}>
            <path d="M10 13V4M10 4L7 7M10 4l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M3 14v1a2 2 0 002 2h10a2 2 0 002-2v-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        )}

        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: state === 'busy' ? '#7c3aed' : '#94a3b8' }}>
            {state === 'busy' ? 'Importing...' : 'Import TOS Account Statement(s)'}
          </div>
          <div style={{ fontSize: 10, color: '#4a5568', marginTop: 2 }}>
            {state === 'done'
              ? `✅ ${accts.map(a => a.account).join(' + ')} imported — drop again to refresh`
              : 'Drop or select CSV files · A1 (acct …7454) and A2 (acct …9962) auto-detected'}
          </div>
          {state === 'error' && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 3 }}>{errMsg}</div>}
        </div>
      </div>

      {/* Results */}
      {accts.length > 0 && (
        <div style={{ background: '#0a0c11', border: '1px solid #1e2530', borderRadius: 8, overflow: 'hidden' }}>
          {accts.map((r, i) => (
            <div key={r.account} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '8px 14px',
              borderBottom: i < accts.length - 1 ? '1px solid #1a2030' : 'none',
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed', minWidth: 28 }}>{r.account}</span>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>{r.total} trades</span>
              <span style={{ fontSize: 12, color: '#22c55e' }}>{r.wins}W</span>
              <span style={{ fontSize: 12, color: '#ef4444' }}>{r.total - r.wins}L</span>
              <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace', marginLeft: 'auto',
                color: r.net >= 0 ? '#22c55e' : '#ef4444' }}>{fmt(r.net)}</span>
              <span style={{ fontSize: 11, color: r.matchCount === r.total ? '#22c55e' : '#f59e0b' }}>
                {r.matchCount}/{r.total} matched
              </span>
            </div>
          ))}
          {accts.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 14px', background: '#111520', borderTop: '1px solid #1e2530' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', minWidth: 28 }}>ALL</span>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>{accts.reduce((s,r)=>s+r.total,0)} trades</span>
              <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace', marginLeft: 'auto',
                color: accts.reduce((s,r)=>s+r.net,0) >= 0 ? '#22c55e' : '#ef4444' }}>
                {fmt(accts.reduce((s,r)=>s+r.net,0))}
              </span>
              <span style={{ fontSize: 11, color: accts.reduce((s,r)=>s+r.matchCount,0) === accts.reduce((s,r)=>s+r.total,0) ? '#22c55e' : '#f59e0b' }}>
                {accts.reduce((s,r)=>s+r.matchCount,0)}/{accts.reduce((s,r)=>s+r.total,0)} matched
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Hook: load TOS data for a trade ─────────────────────────────────────────
export function useTOSTradeData(tradeId) {
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!tradeId) return;
    supabase.from('tos_trade_data').select('*').eq('trade_id', tradeId).single()
      .then(({ data: d }) => {
        if (d) {
          setData({ ...d,
            pnl_points:  JSON.parse(d.pnl_points  || '[]'),
            checkpoints: JSON.parse(d.checkpoints || '[]'),
          });
        } else {
          const local = JSON.parse(localStorage.getItem('tos_trade_data') || '{}');
          const ld = local[tradeId];
          if (ld) setData({ ...ld,
            pnl_points:  JSON.parse(ld.pnl_points  || '[]'),
            checkpoints: JSON.parse(ld.checkpoints || '[]'),
          });
        }
      });
  }, [tradeId]);

  return data;
}
