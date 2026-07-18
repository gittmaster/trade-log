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
  // Check all lines for account number (handles both CSV and tab-separated formats)
  const lines = csvText.split('\n').slice(0, 20);
  for (const line of lines) {
    if (line.includes('7454')) return 'A1';
    if (line.includes('9962')) return 'A2';
    const m = line.match(/for (\w+SCHW)/);
    if (m) return m[1].replace('SCHW','').slice(-4) === '7454' ? 'A1' : m[1].replace('SCHW','').slice(-4) === '9962' ? 'A2' : 'A?';
  }
  return 'Unknown';
}

// ─── Parse TOS account statement CSV ─────────────────────────────────────────
function parseTOS(csvText) {
  const rawLines = csvText.split('\n');

  function parseCSVLine(line) {
    const result = [], len = line.length;
    let cur = '', inQ = false;
    for (let i = 0; i < len; i++) {
      const ch = line[i];
      if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { result.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    result.push(cur.trim());
    return result;
  }

  function cleanNum(s) {
    if (!s || s === '--' || s === '—') return null;
    const m = s.match(/^="?([^"]+)"?$/);
    const v = m ? m[1] : s;
    return parseFloat(v.replace(/[$,"]/g, '')) || null;
  }

  function parseDate(d, t) {
    if (!d || d === '--') return null;
    try {
      // Handle "7/16/26 15:47:32" combined format
      if (d.includes(' ')) { const [date, time] = d.split(' '); return parseDate(date, time); }
      const [mo, day, yr] = d.split('/');
      const year = yr.length === 2 ? '20' + yr : yr;
      return new Date(`${year}-${mo.padStart(2,'0')}-${day.padStart(2,'0')}T${t || '00:00:00'}`);
    } catch { return null; }
  }

  const MULT = { MGC:10, MNQ:2, MYM:0.5, MCL:100 };
  const SYM_MAP = {
    MGCM26:'MGC',MGCN26:'MGC',MGCQ26:'MGC',MGCG26:'MGC',MGCJ26:'MGC',MGCZ26:'MGC',
    MNQM26:'MNQ',MNQN26:'MNQ',MNQH26:'MNQ',MNQU26:'MNQ',MNQZ26:'MNQ',
    MYMM26:'MYM',MYMN26:'MYM',MYMU26:'MYM',
    MCLJ26:'MCL',MCLM26:'MCL',MCLN26:'MCL',
  };
  function normSym(raw) {
    const s = raw.replace('/','').split(':')[0];
    return SYM_MAP[s] || s.slice(0,3);
  }

  // ── 1. Parse Account Trade History (TO OPEN / TO CLOSE) ──────────────────
  // This is the authoritative source for direction
  const tradeHistory = []; // { dt, side, posEffect, symbol, price }
  let inHistory = false;
  for (const line of rawLines) {
    const trimmed = line.trim();
    if (trimmed === 'Account Trade History' || trimmed.startsWith('Account Trade History,')) { inHistory = true; continue; }
    if (inHistory && (trimmed.startsWith('Account Order History') || trimmed.startsWith('Profits and Losses'))) break;
    if (!inHistory) continue;
    const p = parseCSVLine(line);
    // Header row detection
    if (p.some(c => c === 'Exec Time' || c === 'Side' || c === 'Pos Effect')) continue;
    if (p.length < 10) continue;
    // Format: ,Exec Time,Spread,Side,Qty,Pos Effect,Symbol,Exp,Strike,Type,Price,...
    // p[0]=blank, p[1]=execTime, p[2]=spread, p[3]=side, p[4]=qty, p[5]=posEffect, p[6]=symbol, p[10]=price
    const execTime = p[1]?.trim();
    const side     = p[3]?.trim();
    const posEff   = p[5]?.trim();
    const symRaw   = p[6]?.trim();
    const price    = parseFloat(p[10]);
    if (!execTime || !side || !symRaw || isNaN(price)) continue;
    if (posEff !== 'TO OPEN' && posEff !== 'TO CLOSE') continue;
    const dt = parseDate(execTime);
    if (!dt) continue;
    tradeHistory.push({ dt, side, posEffect: posEff, symbol: normSym(symRaw.replace('/','')), price });
  }
  console.log('Trade history rows found:', tradeHistory.length);
  // Log round trips after matching
  console.log('All history sorted:', tradeHistory.sort((a,b)=>a.dt-b.dt).map(t => `${t.dt.toISOString().slice(0,16)} ${t.posEffect} ${t.side} ${t.symbol} @${t.price}`).join(' | '));

  // ── 2. Parse Futures Statements for ADJ rows and cash balances ─────────────
  const adjRows = [];
  const cashBalances = [];
  let inFutures = false, inCash = false;
  for (const line of rawLines) {
    const t = line.trim();
    if (t === 'Futures Statements') { inFutures = true; inCash = false; continue; }
    if (t === 'Cash Balance') { inCash = true; inFutures = false; continue; }
    if (t === 'Account Trade History' || t === 'Forex Statements') { inFutures = false; inCash = false; continue; }
    if (!t) continue;
    const p = parseCSVLine(line);
    if (p.length < 5) continue;

    if (inFutures && p[3] === 'ADJ') {
      const desc = p[5] || '';
      const m = desc.match(/\/([\w]+).*@([\d.]+)/);
      if (!m) continue;
      const dt = parseDate(p[1], p[2]);
      const amt = cleanNum(p[8]);
      if (dt) adjRows.push({ dt, symbol: normSym(m[1]), settle: parseFloat(m[2]), change: amt || 0 });
    } else if (inFutures && p[3] === 'BAL') {
      const bal = cleanNum(p[9]);
      if (bal != null && p[1]) cashBalances.push({ date: p[1], balance: bal });
    } else if (inCash && p[2] === 'BAL') {
      const bal = cleanNum(p[8]);
      if (bal != null && p[0]) cashBalances.push({ date: p[0], balance: bal });
    }
    // OLD FORMAT fallback
    if (!inFutures && !inCash) {
      if (line.includes(',ADJ,')) {
        const pp = parseCSVLine(line);
        const desc = pp[5] || '';
        const m = desc.match(/\/(\w+).*@([\d.]+)/);
        if (m) {
          const dt = parseDate(pp[1], pp[2]);
          const amt = pp[8]?.replace(/[$,"]/g,'');
          if (dt) adjRows.push({ dt, symbol: normSym(m[1]), settle: parseFloat(m[2]), change: amt ? parseFloat(amt) : 0 });
        }
      }
    }
  }

  // ── 3. Build round trips from Account Trade History ───────────────────────
  const round2 = n => Math.round(n * 100) / 100;
  const roundTrips = [];
  const openPos = {}; // sym -> [{dt, price, direction:'long'|'short'}]

  // Sort by exec time
  const sorted = [...tradeHistory].sort((a,b) => a.dt - b.dt);

  for (const fill of sorted) {
    const sym = fill.symbol;
    const mult = MULT[sym] || 1;
    if (!openPos[sym]) openPos[sym] = [];

    if (fill.posEffect === 'TO OPEN') {
      const dir = fill.side === 'BUY' ? 'long' : 'short';
      openPos[sym].push({ dt: fill.dt, price: fill.price, direction: dir });
    } else if (fill.posEffect === 'TO CLOSE') {
      const dir = fill.side === 'BUY' ? 'short' : 'long';
      const openIdx = openPos[sym].findIndex(o => o.direction === dir);
      if (openIdx >= 0) {
        // Matched — create round trip
        const open = openPos[sym][openIdx];
        openPos[sym].splice(openIdx, 1);
        const pts = dir === 'long'
          ? fill.price - open.price
          : open.price - fill.price;
        roundTrips.push({
          symbol: sym, direction: dir,
          entry_dt: open.dt.toISOString(),
          exit_dt: fill.dt.toISOString(),
          entry: open.price,
          exit: fill.price,
          qty: 1,
          pnl: round2(pts * mult),
          duration_hrs: (fill.dt - open.dt) / 3600000,
          comm: 0,
        });
      }
      // If no matching open — this closes a position from a prior statement period
      // Simply ignore it — do NOT create a phantom open position
    }
  }

  console.log('Round trips built:', roundTrips.map(r => `${r.direction} ${r.symbol} ${r.entry}->${r.exit} ${r.pnl>=0?'+':''}$${Math.round(r.pnl)}`).join(' | '));

  // Fallback: if no Account Trade History, use old BOT/SOLD logic
  if (roundTrips.length === 0) {
    const fills2 = [];
    let inFut2 = false;
    for (const line of rawLines) {
      if (line.includes('Futures Statements')) { inFut2 = true; continue; }
      if (!inFut2) continue;
      if (!line.includes(',TRD,') && !line.includes('TRD,')) continue;
      const p = parseCSVLine(line);
      const isNew = p[3] === 'TRD';
      const desc = isNew ? p[5] : p[4];
      const date = isNew ? p[1] : p[0];
      const time = isNew ? p[2] : p[1];
      if (!desc) continue;
      const m = desc.match(/^(BOT|SOLD)\s+([+-]?\d+)\s+\/([\w]+)(?::[\w]+)?\s+@([\d.]+)/);
      if (!m) continue;
      const dt = parseDate(date, time);
      if (!dt) continue;
      fills2.push({ dt, side: m[1], qty: Math.abs(parseInt(m[2])), symbol: normSym(m[3]), price: parseFloat(m[4]), comm: 0 });
    }
    const openPos2 = {};
    for (const f of fills2.sort((a,b) => a.dt - b.dt)) {
      const sym = f.symbol; const mult = MULT[sym] || 1;
      if (!openPos2[sym]) openPos2[sym] = [];
      if (f.side === 'BOT') {
        const short = openPos2[sym].find(o => o.direction === 'short');
        if (short) { openPos2[sym].splice(openPos2[sym].indexOf(short),1); roundTrips.push({ symbol:sym, direction:'short', entry_dt:short.dt.toISOString(), exit_dt:f.dt.toISOString(), entry:short.price, exit:f.price, qty:f.qty, pnl:round2((short.price-f.price)*mult*f.qty), duration_hrs:(f.dt-short.dt)/3600000, comm:0 }); }
        else openPos2[sym].push({ dt:f.dt, price:f.price, qty:f.qty, direction:'long', comm:0 });
      } else {
        const long = openPos2[sym].find(o => o.direction === 'long');
        if (long) { openPos2[sym].splice(openPos2[sym].indexOf(long),1); roundTrips.push({ symbol:sym, direction:'long', entry_dt:long.dt.toISOString(), exit_dt:f.dt.toISOString(), entry:long.price, exit:f.price, qty:f.qty, pnl:round2((f.price-long.price)*mult*f.qty), duration_hrs:(f.dt-long.dt)/3600000, comm:0 }); }
        else openPos2[sym].push({ dt:f.dt, price:f.price, qty:f.qty, direction:'short', comm:0 });
      }
    }
  }

  // ── 4. Enrich with checkpoints ────────────────────────────────────────────
  for (const rt of roundTrips) {
    const mult = MULT[rt.symbol] || 1;
    const isLong = rt.direction === 'long';
    rt.checkpoints = adjRows
      .filter(a => a.symbol === rt.symbol && new Date(a.dt) >= new Date(rt.entry_dt) && new Date(a.dt) <= new Date(rt.exit_dt))
      .map(a => {
        const pts = isLong ? a.settle - rt.entry : rt.entry - a.settle;
        return { dt: a.dt, settle: a.settle, running_pnl: round2(pts * mult * rt.qty) };
      });
    rt.pnl_points = [
      { dt: rt.entry_dt, pnl: 0, type: 'entry' },
      ...rt.checkpoints.map(c => ({ dt: c.dt, pnl: c.running_pnl, type: 'settle' })),
      { dt: rt.exit_dt, pnl: rt.pnl, type: 'exit' },
    ];
    const pnls = rt.pnl_points.map(p => p.pnl);
    rt.mfe = Math.max(...pnls, 0);
    rt.mae = Math.min(...pnls, 0);
  }

  // ── 5. Period from data ───────────────────────────────────────────────────
  const allDates = rawLines.map(l => { const m = l.match(/^(\d{1,2}\/\d{1,2}\/\d{2,4})/); return m?.[1]; }).filter(Boolean);
  const period = allDates.length ? allDates[0] + ' \u2013 ' + allDates[allDates.length-1] : '';

  return {
    account: detectAccount(csvText),
    roundTrips, adjRows, cashBalances, period,
    summary: { total: roundTrips.length, wins: roundTrips.filter(r=>r.pnl>0).length, losses: roundTrips.filter(r=>r.pnl<0).length, net: round2(roundTrips.reduce((s,r)=>s+r.pnl,0)) },
  };
}


function matchToJournal(parsed, journalTrades) {
  return parsed.roundTrips.map(rt => {
    const entryDt = new Date(rt.entry_dt);
    const jt = journalTrades.find(t => {
      if (!t.entry || !t.date) return false;
      return (t.symbol||'').toUpperCase() === rt.symbol &&
             (t.direction||'').toLowerCase() === rt.direction &&
             Math.abs(parseFloat(t.entry) - rt.entry) < 5 &&
             Math.abs(new Date(t.date + 'T12:00:00') - entryDt) / 86400000 < 2;
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
          // Upsert one at a time to avoid ON CONFLICT affecting same row twice in batch
          let error = null;
          for (const u of upserts) {
            const { error: e } = await supabase.from('tos_trade_data').upsert(u, { onConflict: 'trade_id' });
            if (e) { error = e; break; }
          }
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
              : 'Drop or select CSV files · A1 and A2 accounts auto-detected'}
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
