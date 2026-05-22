import { useState, useCallback } from 'react';
import { supabase } from '../supabase';
import TOSUploader from '../components/TOSUploader';

// ── helpers ───────────────────────────────────────────────────────────────────
const MULT = { MGC: 10, MNQ: 2, MYM: 0.5, MCL: 100 };
function fmt(v) {
  const n = Math.round(v);
  return (n >= 0 ? '+$' : '-$') + Math.abs(n).toLocaleString();
}

// ── StatCard ──────────────────────────────────────────────────────────────────
function StatCard({ label, value, color }) {
  return (
    <div style={{ background: '#111', border: '1px solid #222', borderRadius: 8, padding: '10px 14px' }}>
      <div style={{ fontSize: 11, color: '#bbb', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: color || '#fff' }}>{value}</div>
    </div>
  );
}

// ── SVG equity curve ──────────────────────────────────────────────────────────
function EquityCurve({ data }) {
  if (!data || data.length < 2) return null;
  const W = 560, H = 160, PAD = { t: 16, r: 12, b: 28, l: 56 };
  const iW = W - PAD.l - PAD.r, iH = H - PAD.t - PAD.b;

  const vals = data.map(d => d.balance);
  const minV = Math.min(...vals), maxV = Math.max(...vals);
  const range = (maxV - minV) || 1;

  const toX = i => PAD.l + (i / (data.length - 1)) * iW;
  const toY = v => PAD.t + ((maxV - v) / range) * iH;
  const zeroY = toY(0);

  const pathStr = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(d.balance).toFixed(1)}`).join(' ');
  const fillStr = `${pathStr} L${toX(data.length-1).toFixed(1)},${H - PAD.b} L${toX(0).toFixed(1)},${H - PAD.b} Z`;

  const lastVal = vals[vals.length - 1];
  const firstVal = vals[0];
  const isUp = lastVal >= firstVal;
  const lineColor = isUp ? '#1D9E75' : '#E24B4A';

  // tick labels — show ~5 evenly spaced dates
  const tickIdxs = [0, Math.floor(data.length * 0.25), Math.floor(data.length * 0.5), Math.floor(data.length * 0.75), data.length - 1];

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', width: '100%', maxWidth: W }}>
      <defs>
        <linearGradient id="eq-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={lineColor} stopOpacity="0.3" />
          <stop offset="100%" stopColor={lineColor} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {/* grid */}
      {[0, 0.25, 0.5, 0.75, 1].map(t => {
        const v = minV + t * range;
        const y = toY(v);
        return (
          <g key={t}>
            <line x1={PAD.l} y1={y} x2={W - PAD.r} y2={y} stroke="#ffffff0d" strokeWidth="0.5" />
            <text x={PAD.l - 4} y={y + 4} textAnchor="end" fontSize="9" fill="#888" fontFamily="monospace">
              ${Math.round(v / 1000)}k
            </text>
          </g>
        );
      })}
      <path d={fillStr} fill="url(#eq-grad)" />
      <path d={pathStr} fill="none" stroke={lineColor} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
      {tickIdxs.map(i => (
        <text key={i} x={toX(i)} y={H - 6} textAnchor="middle" fontSize="9" fill="#666" fontFamily="monospace">
          {data[i].date}
        </text>
      ))}
      {/* start/end dots */}
      <circle cx={toX(0)} cy={toY(firstVal)} r="3" fill="#888" />
      <circle cx={toX(data.length-1)} cy={toY(lastVal)} r="4" fill={lineColor} />
    </svg>
  );
}

// ── SVG scatter ───────────────────────────────────────────────────────────────
function ScatterChart({ data, xLabel, yLabel, xKey, yKey }) {
  if (!data || data.length < 2) return null;
  const W = 260, H = 160, PAD = { t: 16, r: 12, b: 28, l: 52 };
  const iW = W - PAD.l - PAD.r, iH = H - PAD.t - PAD.b;

  const xs = data.map(d => d[xKey]), ys = data.map(d => d[yKey]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const rx = (maxX - minX) || 1, ry = (maxY - minY) || 1;

  const toX = v => PAD.l + ((v - minX) / rx) * iW;
  const toY = v => PAD.t + ((maxY - v) / ry) * iH;
  const zeroY = toY(0);

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', width: '100%', maxWidth: W }}>
      <line x1={PAD.l} y1={zeroY} x2={W - PAD.r} y2={zeroY} stroke="#ffffff15" strokeWidth="1" />
      {[0, 0.5, 1].map(t => {
        const v = minY + t * ry;
        const y = toY(v);
        return <text key={t} x={PAD.l - 4} y={y + 3} textAnchor="end" fontSize="8" fill="#666" fontFamily="monospace">{v >= 0 ? '+$' : '-$'}{Math.abs(Math.round(v))}</text>;
      })}
      {[0, 0.5, 1].map(t => {
        const v = minX + t * rx;
        const x = toX(v);
        return <text key={t} x={x} y={H - 4} textAnchor="middle" fontSize="8" fill="#666" fontFamily="monospace">{Math.round(v)}</text>;
      })}
      <text x={W / 2} y={H} textAnchor="middle" fontSize="8" fill="#555">{xLabel}</text>
      {data.map((d, i) => (
        <circle key={i} cx={toX(d[xKey])} cy={toY(d[yKey])} r="4"
          fill={d[yKey] >= 0 ? '#1D9E75' : '#E24B4A'}
          fillOpacity="0.85" />
      ))}
    </svg>
  );
}

// ── SVG bar chart ─────────────────────────────────────────────────────────────
function BarChart({ data }) {
  if (!data || !data.length) return null;
  const W = 260, H = 140, PAD = { t: 16, r: 12, b: 28, l: 52 };
  const iW = W - PAD.l - PAD.r, iH = H - PAD.t - PAD.b;

  const vals = data.map(d => d.value);
  const maxAbs = Math.max(...vals.map(v => Math.abs(v)), 1);
  const barW = Math.floor(iW / data.length) - 6;
  const zeroY = PAD.t + iH / 2;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', width: '100%', maxWidth: W }}>
      <line x1={PAD.l} y1={zeroY} x2={W - PAD.r} y2={zeroY} stroke="#ffffff15" strokeWidth="1" />
      {[-1, 0, 1].map(t => {
        const v = t * maxAbs;
        const y = PAD.t + ((maxAbs - v) / (2 * maxAbs)) * iH;
        return <text key={t} x={PAD.l - 4} y={y + 3} textAnchor="end" fontSize="8" fill="#666" fontFamily="monospace">{v >= 0 ? '+$' : '-$'}{Math.abs(Math.round(v))}</text>;
      })}
      {data.map((d, i) => {
        const x = PAD.l + (i / data.length) * iW + 3;
        const barH = Math.abs(d.value) / maxAbs * (iH / 2);
        const barY = d.value >= 0 ? zeroY - barH : zeroY;
        return (
          <g key={i}>
            <rect x={x} y={barY} width={barW} height={barH}
              fill={d.value >= 0 ? '#1D9E75' : '#E24B4A'} rx="2" />
            <text x={x + barW / 2} y={H - 6} textAnchor="middle" fontSize="9" fill="#888">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Multiday journey chart ────────────────────────────────────────────────────
function MultidayChart({ trades }) {
  const multiday = trades.filter(t => t.dur_hrs >= 20 && t.checkpoints?.length > 0).slice(0, 5);
  if (!multiday.length) return <div style={{ fontSize: 12, color: '#555', padding: '20px 0' }}>No multiday trades with checkpoints in this period.</div>;

  const W = 560, H = 160, PAD = { t: 20, r: 12, b: 28, l: 56 };
  const iW = W - PAD.l - PAD.r, iH = H - PAD.t - PAD.b;

  const colors = ['#185FA5', '#1D9E75', '#BA7517', '#E24B4A', '#7c3aed'];
  const allPnls = multiday.flatMap(t => [0, ...t.checkpoints.map(c => c.rpnl), t.pnl]);
  const minP = Math.min(...allPnls), maxP = Math.max(...allPnls);
  const range = (maxP - minP) || 1;
  const maxPts = Math.max(...multiday.map(t => t.checkpoints.length + 2));

  const toX = i => PAD.l + (i / (maxPts - 1)) * iW;
  const toY = v => PAD.t + ((maxP - v) / range) * iH;
  const zeroY = toY(0);

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', width: '100%', maxWidth: W }}>
      <line x1={PAD.l} y1={zeroY} x2={W - PAD.r} y2={zeroY} stroke="#ffffff15" strokeWidth="1" />
      {[minP, 0, maxP].map((v, i) => (
        <text key={i} x={PAD.l - 4} y={toY(v) + 3} textAnchor="end" fontSize="9" fill="#666" fontFamily="monospace">
          {v >= 0 ? '+$' : '-$'}{Math.abs(Math.round(v))}
        </text>
      ))}
      {multiday.map((t, ti) => {
        const pts = [0, ...t.checkpoints.map(c => c.rpnl), t.pnl];
        const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(p).toFixed(1)}`).join(' ');
        const c = colors[ti % colors.length];
        return (
          <g key={ti}>
            <path d={path} fill="none" stroke={c} strokeWidth="1.8" strokeLinejoin="round" strokeDasharray={ti > 0 ? (ti === 1 ? '5,3' : '2,2') : 'none'} />
            {pts.map((p, i) => <circle key={i} cx={toX(i)} cy={toY(p)} r="3" fill={c} />)}
            <text x={toX(pts.length - 1) + 5} y={toY(t.pnl) + 3} fontSize="9" fill={c} fontFamily="monospace">
              {t.sym} {fmt(t.pnl)}
            </text>
          </g>
        );
      })}
      {['Entry', ...Array.from({length: maxPts - 2}, (_, i) => `Day ${i+1}`), 'Exit'].map((l, i) => (
        <text key={i} x={toX(i)} y={H - 6} textAnchor="middle" fontSize="9" fill="#555" fontFamily="monospace">{l}</text>
      ))}
    </svg>
  );
}

// ── Main Analysis page ────────────────────────────────────────────────────────
export default function Analysis({ filteredTrades, dateLabel, acctLabel }) {
  const [tosData, setTosData] = useState(null); // { account, trips, equityData, symPnl, totalComm }

  const handleTOSImport = useCallback((parsed, matched) => {
    // Build chart datasets from parsed TOS data
    const trips = parsed.roundTrips;
    if (!trips?.length) return;

    // Equity curve from cash balance daily rows
    const eq = (parsed.cashBalances || [])
      .map(b => ({ date: b.date, balance: b.balance }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    // Remove duplicates (keep last per date)
    const eqMap = {};
    eq.forEach(e => { eqMap[e.date] = e; });
    const equityData = Object.values(eqMap).sort((a, b) => new Date(a.date) - new Date(b.date));

    // P&L by symbol
    const symMap = {};
    trips.forEach(t => { symMap[t.symbol] = (symMap[t.symbol] || 0) + t.pnl; });
    const symPnl = Object.entries(symMap).map(([label, value]) => ({ label, value }));

    // Total commissions
    const totalComm = trips.reduce((s, t) => s + (t.comm || 0), 0);

    // Enrich trips with dur_hrs and checkpoints from parsed data
    const enriched = trips.map(t => ({
      ...t,
      dur_hrs: t.duration_hrs || 0,
      checkpoints: t.checkpoints || [],
    }));

    setTosData({
      account:     parsed.account,
      period:      parsed.period || '',
      trips:       enriched,
      equityData,
      symPnl,
      totalComm,
      wins:        trips.filter(t => t.pnl > 0).length,
      total:       trips.length,
      netPnl:      trips.reduce((s, t) => s + t.pnl, 0),
      avgHold:     trips.reduce((s, t) => s + (t.duration_hrs || 0), 0) / trips.length,
    });
  }, []);

  const wins = tosData?.wins || 0;
  const total = tosData?.total || 0;

  return (
    <div style={{ padding: '16px 20px' }}>
      {/* header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 500, color: '#ccc', marginBottom: 2 }}>Analysis</div>
        <div style={{ fontSize: 12, color: '#555' }}>{dateLabel} · {acctLabel}</div>
      </div>

      {/* TOS uploader */}
      <div style={{ background: '#111', border: '1px solid #222', borderRadius: 8, padding: '12px 14px', marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#ccc', marginBottom: 8 }}>
          📊 TOS Account Statement
        </div>
        <TOSUploader trades={filteredTrades} onComplete={handleTOSImport} />
      </div>

      {!tosData && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#444', fontSize: 13 }}>
          Upload your TOS account statement above to see charts
        </div>
      )}

      {tosData && (
        <>
          {/* stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 16 }}>
            <StatCard label="Trades" value={total} />
            <StatCard label="Win Rate" value={total ? Math.round(wins / total * 100) + '%' : '—'}
              color={total && wins/total >= 0.5 ? '#1D9E75' : '#E24B4A'} />
            <StatCard label="Net P&L" value={fmt(tosData.netPnl)}
              color={tosData.netPnl >= 0 ? '#1D9E75' : '#E24B4A'} />
            <StatCard label="Commissions" value={`-$${Math.round(tosData.totalComm)}`} color="#E24B4A" />
            <StatCard label="Avg Hold" value={`${Math.round(tosData.avgHold)}h`} color="#ccc" />
          </div>

          {/* equity curve */}
          <div style={{ background: '#111', border: '1px solid #222', borderRadius: 8, padding: '12px 14px', marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: '#bbb', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
              Account Equity Curve — {tosData.account}
            </div>
            {tosData.equityData.length > 1
              ? <EquityCurve data={tosData.equityData} />
              : <div style={{ fontSize: 12, color: '#444' }}>Not enough balance data in this file.</div>}
          </div>

          {/* 3-col charts */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div style={{ background: '#111', border: '1px solid #222', borderRadius: 8, padding: '12px 14px' }}>
              <div style={{ fontSize: 11, color: '#bbb', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>P&L by Symbol</div>
              <BarChart data={tosData.symPnl} />
            </div>
            <div style={{ background: '#111', border: '1px solid #222', borderRadius: 8, padding: '12px 14px' }}>
              <div style={{ fontSize: 11, color: '#bbb', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Stop Distance vs Outcome</div>
              <ScatterChart
                data={tosData.trips.map(t => ({ x: t.stop_dist || 0, y: t.pnl, win: t.pnl > 0 }))}
                xKey="x" yKey="y" xLabel="Stop distance (pts)" yLabel="P&L" />
            </div>
            <div style={{ background: '#111', border: '1px solid #222', borderRadius: 8, padding: '12px 14px' }}>
              <div style={{ fontSize: 11, color: '#bbb', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Hold Time vs P&L</div>
              <ScatterChart
                data={tosData.trips.map(t => ({ x: Math.round(t.dur_hrs), y: t.pnl }))}
                xKey="x" yKey="y" xLabel="Hold time (hrs)" yLabel="P&L" />
            </div>
          </div>

          {/* multiday journeys */}
          <div style={{ background: '#111', border: '1px solid #222', borderRadius: 8, padding: '12px 14px' }}>
            <div style={{ fontSize: 11, color: '#bbb', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
              Multiday Trades — Real P&L from Daily Settlements
            </div>
            <MultidayChart trades={tosData.trips} />
          </div>
        </>
      )}
    </div>
  );
}
