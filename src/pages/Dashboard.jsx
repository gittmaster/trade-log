import React, { useState, useRef, useEffect, useCallback } from 'react';
import { SESSIONS, getMultiplier } from '../App';

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DOW = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

const STRAT_LABELS = {
  'strat-aplus-prime':       'A+ Prime',
  'strat-strong-al-weak-sl': 'Strong AL / Weak SL',
  'strat-weak-al-strong-sl': 'Weak AL / Strong SL',
  'strat-both-weak':         'Both Weak',
  'strat-unassigned':        'Unassigned',
};


// ─── Running P&L mini chart ──────────────────────────────────────────────────
function RunningPnlChart({ trade }) {
  const canvasRef = useRef(null);
  const mult = getMultiplier(trade.symbol, trade.custom_multiplier);
  const contracts = parseFloat(trade.contracts) || 1;
  const isLong = trade.direction === 'long';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const entry = parseFloat(trade.entry);
    const exit  = parseFloat(trade.exit_price);
    const mfe   = parseFloat(trade.mfe_price);
    const mae   = parseFloat(trade.mae_price);
    if (!entry || !exit) return;

    // Build 4-point path: Entry(0) → worst → best → Exit
    // For long: MAE then MFE. For short: MFE then MAE (price inverted)
    const toPnl = price => Math.round((isLong ? price - entry : entry - price) * mult * contracts * 100) / 100;

    const points = [{ label: 'Entry', pnl: 0 }];
    if (!isNaN(mae) && !isNaN(mfe)) {
      if (isLong) {
        points.push({ label: 'MAE', pnl: toPnl(mae) });
        points.push({ label: 'MFE', pnl: toPnl(mfe) });
      } else {
        points.push({ label: 'MFE', pnl: toPnl(mfe) });
        points.push({ label: 'MAE', pnl: toPnl(mae) });
      }
    }
    points.push({ label: 'Exit', pnl: toPnl(exit) });

    const W = canvas.width, H = canvas.height;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    const pnls = points.map(p => p.pnl);
    const minV = Math.min(...pnls, 0);
    const maxV = Math.max(...pnls, 0);
    const range = maxV - minV || 1;
    const padX = 48, padY = 20, padB = 28;
    const chartW = W - padX - 12;
    const chartH = H - padY - padB;
    const px = i => padX + (i / (points.length - 1)) * chartW;
    const py = v => padY + chartH - ((v - minV) / range) * chartH;

    // Zero line
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padX, py(0)); ctx.lineTo(W - 12, py(0)); ctx.stroke();
    ctx.setLineDash([]);

    // Fill
    const exitPnl = points[points.length - 1].pnl;
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, exitPnl >= 0 ? 'rgba(29,158,117,0.3)' : 'rgba(226,75,74,0.3)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.beginPath();
    ctx.moveTo(px(0), py(0));
    points.forEach((p, i) => ctx.lineTo(px(i), py(p.pnl)));
    ctx.lineTo(px(points.length - 1), py(0));
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Line
    ctx.strokeStyle = exitPnl >= 0 ? '#1D9E75' : '#E24B4A';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    points.forEach((p, i) => i === 0 ? ctx.moveTo(px(i), py(p.pnl)) : ctx.lineTo(px(i), py(p.pnl)));
    ctx.stroke();

    // Dots
    points.forEach((p, i) => {
      ctx.beginPath();
      ctx.arc(px(i), py(p.pnl), 3.5, 0, Math.PI * 2);
      ctx.fillStyle = exitPnl >= 0 ? '#1D9E75' : '#E24B4A';
      ctx.fill();
    });

    // Y-axis labels
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    [minV, 0, maxV].filter((v, i, a) => a.indexOf(v) === i).forEach(v => {
      ctx.fillStyle = v === 0 ? 'rgba(255,255,255,0.3)' : v > 0 ? '#1D9E75' : '#E24B4A';
      ctx.fillText((v >= 0 ? '+$' : '-$') + Math.abs(Math.round(v)), padX - 4, py(v) + 3);
    });

    // X-axis labels
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    points.forEach((p, i) => {
      ctx.fillText(p.label, px(i), H - 8);
    });
  }, [trade]);

  const hasMfeMae = !isNaN(parseFloat(trade.mfe_price)) && !isNaN(parseFloat(trade.mae_price));

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, color: '#555', marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>RUNNING P&L</span>
        {!hasMfeMae && <span style={{ color: '#333', fontSize: 10 }}>Add MFE/MAE in Trade Review for full path</span>}
      </div>
      <canvas ref={canvasRef} width={760} height={140} style={{ width: '100%', height: 140, borderRadius: 6, background: '#0a0a0a', display: 'block' }} />
      {hasMfeMae && (
        <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
          {[
            { label: 'MFE', price: trade.mfe_price, color: '#1D9E75' },
            { label: 'MAE', price: trade.mae_price, color: '#E24B4A' },
          ].map(({ label, price, color }) => {
            const mult2 = getMultiplier(trade.symbol, trade.custom_multiplier);
            const contracts2 = parseFloat(trade.contracts) || 1;
            const isLong2 = trade.direction === 'long';
            const pnl = Math.round((isLong2 ? price - trade.entry : trade.entry - price) * mult2 * contracts2);
            return (
              <div key={label} style={{ fontSize: 11, color: '#555' }}>
                {label}: <span style={{ color, fontWeight: 700 }}>${price}</span>
                <span style={{ color: '#444', marginLeft: 4 }}>({pnl >= 0 ? '+$' : '-$'}{Math.abs(pnl)})</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Trade Detail Sub-panel ───────────────────────────────────────────────────
function TradeDetail({ trade, onClose }) {
  const mult = getMultiplier(trade.symbol, trade.custom_multiplier);
  const pts  = (trade.entry != null && trade.exit_price != null)
    ? Math.round(((trade.direction === 'long' ? trade.exit_price - trade.entry : trade.entry - trade.exit_price)) * 100) / 100
    : null;
  const heldStr = (() => {
    try {
      if (!trade.time) return null;
      const entryDt = new Date(`${trade.date}T${trade.time}`);
      const exitDate = trade.exit_date || trade.date;
      const exitDt  = new Date(`${exitDate}T${trade.exit_time}`);
      const ms = exitDt - entryDt;
      if (ms <= 0) return null;
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      return h > 0 ? `${h}h ${m}m` : `${m}m`;
    } catch { return null; }
  })();

  const isWin  = trade.pnl > 0;
  const isLoss = trade.pnl < 0;
  const resultColor = isWin ? '#1D9E75' : isLoss ? '#E24B4A' : '#888';
  const fmtPnl = v => v != null ? ((v >= 0 ? '+$' : '-$') + Math.abs(Math.round(v)).toLocaleString()) : '—';

  const rows = [
    { label: 'Side',        value: trade.direction?.toUpperCase(), color: trade.direction === 'long' ? '#1D9E75' : '#E24B4A' },
    { label: 'Account',     value: trade.account },
    { label: 'Symbol',      value: trade.symbol },
    { label: 'Contracts',   value: trade.contracts || 1 },
    { label: 'Entry',       value: trade.entry },
    { label: 'Exit',        value: trade.exit_price || '—' },
    { label: 'Points',      value: pts != null ? (pts >= 0 ? '+' : '') + pts : '—', color: pts != null && pts >= 0 ? '#1D9E75' : '#E24B4A' },
    { label: 'Gross P&L',   value: fmtPnl(trade.pnl), color: resultColor },
    { label: 'Session',     value: trade.session || '—' },
    { label: 'Held',        value: heldStr || '—' },
    { label: 'Strategy',    value: STRAT_LABELS[trade.strategy_id] || trade.strategy_id || '—' },
    { label: 'Exit Reason', value: trade.exit_reason || '—' },
  ];

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
      zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
    <div style={{
      width: 520, maxHeight: '90vh', background: '#0e0e0e', borderRadius: 12,
      border: '1px solid #2a2a2a', display: 'flex', flexDirection: 'column',
      animation: 'fadeScaleIn 0.15s ease', overflow: 'hidden',
    }} onClick={e => e.stopPropagation()}>
    <style>{`@keyframes fadeScaleIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }`}</style>
      {/* Header */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid #1e1e1e', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#666', fontSize: 18, cursor: 'pointer', padding: '0 4px' }}>‹</button>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#ccc' }}>{trade.symbol}</span>
          <span style={{ background: trade.direction === 'long' ? '#1D9E7522' : '#E24B4A22', color: trade.direction === 'long' ? '#1D9E75' : '#E24B4A', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>{trade.direction}</span>
          <span style={{ background: '#1a1a2a', color: '#85B7EB', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>{trade.exit_price ? 'Closed' : 'Open'}</span>
          <span style={{ background: isWin ? '#1D9E7522' : isLoss ? '#E24B4A22' : '#222', color: resultColor, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>{isWin ? 'Win' : isLoss ? 'Loss' : 'BE'}</span>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#444', fontSize: 20, cursor: 'pointer' }}>×</button>
      </div>

      {/* Opened / held */}
      <div style={{ padding: '8px 20px', borderBottom: '1px solid #1e1e1e', fontSize: 11, color: '#555', flexShrink: 0 }}>
        Opened {trade.date} {trade.time || ''}
        {trade.exit_date || trade.exit_time ? ` · Closed ${trade.exit_date || trade.date} ${trade.exit_time || ''}` : ''}
        {heldStr ? ` · Held ${heldStr}` : ''}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px 20px' }}>
        {/* P&L box */}
        <div style={{ background: '#111', border: `1px solid ${resultColor}44`, borderLeft: `3px solid ${resultColor}`, borderRadius: 8, padding: '14px 16px', marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: '#555', marginBottom: 4 }}>NET P&L</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: resultColor }}>{fmtPnl(trade.pnl)}</div>
          {pts != null && <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{pts >= 0 ? '+' : ''}{pts} pts · {trade.contracts || 1} contract{trade.contracts > 1 ? 's' : ''}</div>}
        </div>

        {/* Running P&L chart */}
        {trade.entry && trade.exit_price && <RunningPnlChart trade={trade} />}

        {/* Chart image */}
        {trade.chart_url && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: '#555', marginBottom: 6 }}>CHART</div>
            <img src={trade.chart_url} alt="Trade chart"
              style={{ width: '100%', borderRadius: 8, border: '1px solid #222', display: 'block', cursor: 'pointer' }}
              onClick={() => window.open(trade.chart_url, '_blank')} />
          </div>
        )}

        {/* Stats table */}
        <div>
          {rows.map(({ label, value, color }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid #181818' }}>
              <span style={{ fontSize: 13, color: '#555' }}>{label}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: color || '#ccc' }}>{value}</span>
            </div>
          ))}
          {trade.notes && (
            <div style={{ marginTop: 14, background: '#111', border: '1px solid #222', borderRadius: 8, padding: '10px 14px' }}>
              <div style={{ fontSize: 11, color: '#555', marginBottom: 6 }}>NOTES</div>
              <div style={{ fontSize: 13, color: '#aaa', lineHeight: 1.6 }}>{trade.notes}</div>
            </div>
          )}
        </div>
      </div>
    </div>
    </div>
  );
}

// ─── Day Detail Panel ─────────────────────────────────────────────────────────
function DayPanel({ day, month, year, trades, onClose }) {
  const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  const dayTrades = trades.filter(t => t.date === dateStr);
  const closed = dayTrades.filter(t => t.pnl !== null);
  const wins = closed.filter(t => t.pnl > 0);
  const net = closed.reduce((s,t) => s + t.pnl, 0);
  const wr = closed.length ? Math.round(wins.length / closed.length * 100) : 0;
  const [selectedTrade, setSelectedTrade] = useState(null);
  const date = new Date(year, month, day);
  const dow = DOW[date.getDay()];
  const fmt = v => (v >= 0 ? '+$' : '-$') + Math.abs(Math.round(v)).toLocaleString();

  // Build cumulative P&L curve points
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !closed.length) return;
    const sorted = [...closed].sort((a,b) => (a.time||'').localeCompare(b.time||''));
    const points = [0];
    let running = 0;
    sorted.forEach(t => { running += t.pnl; points.push(running); });
    const W = canvas.width, H = canvas.height;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0,0,W,H);
    const min = Math.min(...points, 0);
    const max = Math.max(...points, 0);
    const range = max - min || 1;
    const px = (i) => (i / (points.length - 1)) * (W - 20) + 10;
    const py = (v) => H - 20 - ((v - min) / range) * (H - 30);
    // zero line
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(10, py(0)); ctx.lineTo(W-10, py(0)); ctx.stroke();
    // fill
    const grad = ctx.createLinearGradient(0,0,0,H);
    grad.addColorStop(0, net >= 0 ? 'rgba(29,158,117,0.35)' : 'rgba(226,75,74,0.35)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.beginPath();
    ctx.moveTo(px(0), py(0));
    points.forEach((v,i) => ctx.lineTo(px(i), py(v)));
    ctx.lineTo(px(points.length-1), py(0));
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
    // line
    ctx.strokeStyle = net >= 0 ? '#1D9E75' : '#E24B4A';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    points.forEach((v,i) => i === 0 ? ctx.moveTo(px(i),py(v)) : ctx.lineTo(px(i),py(v)));
    ctx.stroke();
  }, [closed, net]);

  const overlayRef = useRef(null);
  useEffect(() => {
    const handler = (e) => { if (overlayRef.current && e.target === overlayRef.current) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div ref={overlayRef} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      zIndex: 2000, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end',
    }}>
      <div style={{
        width: 820, height: '100vh', background: '#111', borderLeft: '1px solid #2a2a2a',
        display: 'flex', flexDirection: 'column', overflowY: 'auto',
        animation: 'slideIn 0.2s ease',
        position: 'relative',
      }}>
        <style>{`@keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>
        {selectedTrade && <TradeDetail trade={selectedTrade} onClose={() => setSelectedTrade(null)} />}

        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e1e1e', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{dow}, {MONTH_NAMES[month]} {day}, {year}</div>
            <div style={{ fontSize: 13, color: net >= 0 ? '#1D9E75' : '#E24B4A', fontWeight: 700, marginTop: 2 }}>
              Net P&L {fmt(net)}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#666', fontSize: 22, cursor: 'pointer', padding: '0 4px' }}>×</button>
        </div>

        {dayTrades.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#444', fontSize: 13 }}>No trades on this day</div>
        ) : (
          <>
            {/* P&L curve + stats row */}
            <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #1e1e1e', flexShrink: 0 }}>
              {/* Chart */}
              <div style={{ flex: 1, padding: '16px 16px 12px' }}>
                <canvas ref={canvasRef} width={300} height={120} style={{ width: '100%', height: 120 }} />
              </div>
              {/* Stats */}
              <div style={{ width: 280, padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px', borderLeft: '1px solid #1e1e1e' }}>
                {[
                  { label: 'Total Trades', value: closed.length },
                  { label: 'Gross P&L',    value: fmt(net), color: net >= 0 ? '#1D9E75' : '#E24B4A' },
                  { label: 'Win Rate',     value: wr + '%', color: wr >= 50 ? '#1D9E75' : '#E24B4A' },
                  { label: 'Winners / Losers', value: `${wins.length} / ${closed.length - wins.length}` },
                  { label: 'Avg Winner',   value: wins.length ? fmt(wins.reduce((s,t)=>s+t.pnl,0)/wins.length) : '—', color: '#1D9E75' },
                  { label: 'Avg Loser',    value: (closed.length-wins.length) ? fmt(closed.filter(t=>t.pnl<0).reduce((s,t)=>s+t.pnl,0)/(closed.length-wins.length)) : '—', color: '#E24B4A' },
                ].map(({ label, value, color }) => (
                  <div key={label}>
                    <div style={{ fontSize: 11, color: '#555', marginBottom: 3 }}>{label}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: color || '#fff' }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Trade table */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #1e1e1e' }}>
                    {['Time','Acct','Symbol','Dir','Entry','Exit','P&L','Session','Strategy','Notes'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#444', fontWeight: 500, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...dayTrades].sort((a,b) => (a.time||'').localeCompare(b.time||'')).map((t, i) => (
                    <tr key={t.id || i} onClick={() => setSelectedTrade(t)} style={{ borderBottom: '1px solid #181818', cursor: 'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#1a1a1a'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '10px 12px', color: '#888', whiteSpace: 'nowrap' }}>{t.time || '—'}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ background: '#1a2535', color: '#85B7EB', borderRadius: 4, padding: '2px 7px', fontSize: 11, fontWeight: 700 }}>{t.account}</span>
                      </td>
                      <td style={{ padding: '10px 12px', color: '#ccc', fontWeight: 700 }}>{t.symbol}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ color: t.direction === 'long' ? '#1D9E75' : '#E24B4A', fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>{t.direction}</span>
                      </td>
                      <td style={{ padding: '10px 12px', color: '#ccc', fontFamily: 'monospace' }}>{t.entry || '—'}</td>
                      <td style={{ padding: '10px 12px', color: '#ccc', fontFamily: 'monospace' }}>{t.exit_price || '—'}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: t.pnl > 0 ? '#1D9E75' : t.pnl < 0 ? '#E24B4A' : '#888', fontFamily: 'monospace' }}>
                        {t.pnl !== null ? (t.pnl >= 0 ? '+$' : '-$') + Math.abs(Math.round(t.pnl)).toLocaleString() : '—'}
                      </td>
                      <td style={{ padding: '10px 12px', color: '#666', fontSize: 11 }}>{t.session || '—'}</td>
                      <td style={{ padding: '10px 12px', color: '#555', fontSize: 11, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{STRAT_LABELS[t.strategy_id] || t.strategy_id || '—'}</td>
                      <td style={{ padding: '10px 12px', color: '#555', fontSize: 11, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.notes || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div style={{ background: '#111', border: '1px solid #222', borderRadius: 8, padding: '10px 14px' }}>
      <div style={{ fontSize: 11, color: '#bbb', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: color || '#fff' }}>{value}</div>
    </div>
  );
}

function InsightCard({ title, data }) {
  return (
    <div style={{ background: '#111', border: '1px solid #222', borderRadius: 8, padding: '12px 14px' }}>
      <div style={{ fontSize: 11, color: '#bbb', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>{title}</div>
      {data.map((row, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: i < data.length - 1 ? 6 : 0 }}>
          <span style={{ fontSize: 12, color: '#ccc' }}>{row.label}</span>
          <span style={{ fontSize: 12, color: row.wr >= 50 ? '#1D9E75' : '#E24B4A' }}>{row.wr}% · {row.net >= 0 ? '+' : ''}${row.net}</span>
        </div>
      ))}
      {data.length === 0 && <div style={{ fontSize: 12, color: '#444' }}>No data</div>}
    </div>
  );
}

function ProgressCalendar({ trades, dateRange }) {
  const closed = trades.filter(t => t.pnl !== null && t.date);
  const now = new Date();
  const [open, setOpen] = useState(true);
  const [selectedDay, setSelectedDay] = useState(null);
  const [calYear,  setCalYear]  = useState(dateRange.start.getFullYear());
  const [calMonth, setCalMonth] = useState(dateRange.start.getMonth());

  // Sync to global filter whenever dateRange changes — use start date so
  // "last month" (start=Apr 1, end=Apr 30) shows April, not May
  React.useEffect(() => {
    setCalYear(dateRange.start.getFullYear());
    setCalMonth(dateRange.start.getMonth());
  }, [dateRange.start, dateRange.end]);

  const dayMap = {};
  closed.forEach(t => {
    const [ty, tm, td] = t.date.split('-').map(Number);
    if (ty === calYear && tm - 1 === calMonth) {
      if (!dayMap[td]) dayMap[td] = { pnl: 0, count: 0, wins: 0 };
      dayMap[td].pnl   += t.pnl;
      dayMap[td].count += 1;
      if (t.pnl > 0) dayMap[td].wins += 1;
    }
  });

  const monthNet  = Object.values(dayMap).reduce((s, d) => s + d.pnl, 0);
  const tradeDays = Object.keys(dayMap).length;
  const fmt = (v) => (v >= 0 ? '+$' : '-$') + Math.abs(Math.round(v)).toLocaleString();

  const firstDay    = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  if (!closed.length) return null;

  return (
    <>
      {selectedDay && (
        <DayPanel
          day={selectedDay} month={calMonth} year={calYear}
          trades={trades}
          onClose={() => setSelectedDay(null)}
        />
      )}

      <div style={{ marginBottom: 20 }}>
        <div onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#111', border: '1px solid #222', borderRadius: open ? '8px 8px 0 0' : 8, padding: '10px 16px', cursor: 'pointer', userSelect: 'none' }}>
          <span style={{ fontWeight: 700, fontSize: 16, color: '#ccc' }}>📅 Progress</span>
          <span style={{ color: '#666', fontSize: 14, fontWeight: 600 }}>{open ? '▲ Hide' : '▼ Show'}</span>
        </div>
        {open && (
          <div style={{ border: '1px solid #222', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#ccc', minWidth: 110 }}>{MONTH_NAMES[calMonth]} {calYear}</span>
              <span style={{ background: monthNet >= 0 ? '#1D9E7522' : '#E24B4A22', color: monthNet >= 0 ? '#1D9E75' : '#E24B4A', borderRadius: 20, padding: '3px 12px', fontSize: 14, fontWeight: 700 }}>{fmt(monthNet)}</span>
              <span style={{ background: '#1a1a1a', color: '#ccc', borderRadius: 20, padding: '3px 12px', fontSize: 13, fontWeight: 600 }}>{tradeDays} days</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 0, alignItems: 'start', maxWidth: 1000 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
                  {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                    <div key={d} style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#666', padding: '4px 0', background: '#0d0d0d', borderRadius: 6 }}>{d}</div>
                  ))}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {weeks.map((week, wi) => (
                    <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
                      {week.map((day, di) => {
                        if (!day) return <div key={di} style={{ height: 100, borderRadius: 8, background: '#0a0a0a' }} />;
                        const d = dayMap[day];
                        const isToday = now.getFullYear() === calYear && now.getMonth() === calMonth && now.getDate() === day;
                        const hasData = !!d;
                        const isWin = d && d.pnl > 0;
                        const isLoss = d && d.pnl < 0;
                        const isFlat = d && d.pnl === 0;
                        let bg = '#111';
                        if (isWin)  bg = '#0d2e1f';
                        if (isLoss) bg = '#2a0e0e';
                        if (isFlat) bg = '#0f1a2a';
                        const borderCol = isToday ? '#7c3aed' : isWin ? '#1D9E7540' : isLoss ? '#E24B4A40' : isFlat ? '#185FA540' : '#1a1a1a';
                        const wr = d && d.count ? Math.round(d.wins / d.count * 100) : 0;
                        const pnlColor = isWin ? '#fff' : isLoss ? '#fff' : '#888';
                        return (
                          <div
                            key={di}
                            onClick={() => hasData && setSelectedDay(day)}
                            style={{
                              background: bg,
                              border: `1.5px solid ${borderCol}`,
                              borderRadius: 8, padding: '8px 10px', height: 100,
                              display: 'flex', flexDirection: 'column',
                              position: 'relative',
                              cursor: hasData ? 'pointer' : 'default',
                              transition: 'filter 0.12s',
                            }}
                            onMouseEnter={e => { if (hasData) e.currentTarget.style.filter = 'brightness(1.25)'; }}
                            onMouseLeave={e => { if (hasData) e.currentTarget.style.filter = 'brightness(1)'; }}
                          >
                            <span style={{ fontSize: 13, fontWeight: 700, color: isToday ? '#a78bfa' : '#aaa', textAlign: 'right', marginBottom: 'auto' }}>{day}</span>
                            {d ? (<>
                              <span style={{ fontSize: 16, fontWeight: 800, color: pnlColor, marginTop: 6, lineHeight: 1 }}>
                                {isFlat ? '$0' : (isWin ? '' : '-') + '$' + Math.abs(Math.round(d.pnl)).toLocaleString()}
                              </span>
                              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 3 }}>{d.count} trade{d.count !== 1 ? 's' : ''}</span>
                              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>{wr.toFixed(2)}%</span>
                              {hasData && <span style={{ width: 6, height: 6, borderRadius: '50%', background: isWin ? '#1D9E75' : isLoss ? '#E24B4A' : '#185FA5', position: 'absolute', bottom: 6, right: 8 }} />}
                            </>) : null}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 20, marginLeft: 8 }}>
                {weeks.map((week, wi) => {
                  let wNet = 0, wDays = 0;
                  week.forEach(day => { if (day && dayMap[day]) { wNet += dayMap[day].pnl; wDays++; } });
                  return (
                    <div key={wi} style={{ background: '#111', border: '1px solid #222', borderRadius: 6, padding: '7px 10px', minWidth: 85, minHeight: 68, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#aaa' }}>Week {wi + 1}</span>
                      {wDays > 0 ? (<>
                        <span style={{ fontSize: 18, fontWeight: 700, color: wNet >= 0 ? '#1D9E75' : '#E24B4A' }}>{fmt(wNet)}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#888' }}>{wDays} day{wDays !== 1 ? 's' : ''}</span>
                      </>) : <span style={{ fontSize: 13, fontWeight: 700, color: '#444' }}>—</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default function Dashboard({ filteredTrades, dateLabel, acctLabel, dateRange }) {
  const trades = filteredTrades;

  const closed = trades.filter(t => t.pnl !== null);
  const wins   = closed.filter(t => t.pnl > 0);
  const losses = closed.filter(t => t.pnl < 0);
  const net    = closed.reduce((s, t) => s + (t.pnl || 0), 0);
  const avgW   = wins.length   ? Math.round(wins.reduce((s, t)   => s + t.pnl, 0) / wins.length)   : null;
  const avgL   = losses.length ? Math.round(losses.reduce((s, t) => s + t.pnl, 0) / losses.length) : null;
  const wr     = closed.length ? Math.round(wins.length / closed.length * 100) : null;

  const insightData = (key, labels) => labels.map(({ k, l }) => {
    const ts = closed.filter(t => t[key] === k);
    if (!ts.length) return null;
    const w = ts.filter(t => t.pnl > 0).length;
    return { label: l, wr: Math.round(w / ts.length * 100), net: Math.round(ts.reduce((s, t) => s + t.pnl, 0)) };
  }).filter(Boolean);

  const symbols = [...new Set(trades.map(t => t.symbol === 'OTHER' ? (t.custom_symbol || 'OTHER') : t.symbol))];

  return (
    <div style={{ padding: '16px 20px' }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 500, color: '#ccc', marginBottom: 2 }}>Dashboard</div>
        <div style={{ fontSize: 12, color: '#555' }}>{dateLabel} · {acctLabel}</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 16 }}>
        <StatCard label="Total Trades" value={trades.length} />
        <StatCard label="Win Rate"     value={wr !== null ? wr + '%' : '—'} color={wr >= 50 ? '#1D9E75' : wr !== null ? '#E24B4A' : undefined} />
        <StatCard label="Net P&L"      value={closed.length ? (net >= 0 ? '+$' : '-$') + Math.abs(Math.round(net)).toLocaleString() : '$0'} color={net > 0 ? '#1D9E75' : net < 0 ? '#E24B4A' : undefined} />
        <StatCard label="Avg Winner"   value={avgW !== null ? '+$' + avgW : '—'} color="#1D9E75" />
        <StatCard label="Avg Loser"    value={avgL !== null ? '-$' + Math.abs(avgL) : '—'} color="#E24B4A" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
        <InsightCard title="By Instrument" data={insightData('symbol', symbols.map(s => ({ k: s, l: s })))} />
        <InsightCard title="By Strategy"   data={insightData('strategy_id', [
          { k: 'strat-aplus-prime',       l: 'A+ Prime' },
          { k: 'strat-strong-al-weak-sl', l: 'Strong AL' },
          { k: 'strat-weak-al-strong-sl', l: 'Weak AL' },
          { k: 'strat-both-weak',         l: 'Both Weak' },
        ])} />
        <InsightCard title="By Safety Line" data={insightData('sl_quality', [{ k: 'strong', l: '★ Strong' }, { k: 'weak', l: 'Weak' }])} />
        <InsightCard title="By Session"    data={insightData('session', SESSIONS.map(s => ({ k: s, l: s })))} />
      </div>

      <ProgressCalendar trades={trades} dateRange={dateRange} />
    </div>
  );
}
