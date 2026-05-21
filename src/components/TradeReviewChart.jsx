import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

const MULT = { MGC: 10, MNQ: 2, MYM: 0.5, MCL: 100 };
function getMult(symbol, custom_multiplier) {
  return MULT[symbol] || (custom_multiplier ? parseFloat(custom_multiplier) : 1);
}

const GRADE_COLORS = { aplus: '#22c55e', a: '#60a5fa', aminus: '#f59e0b' };
const GRADE_LABELS = { aplus: 'A+', a: 'A', aminus: 'A-' };

function fmt(v) {
  if (v === null || v === undefined || v === '') return '—';
  const n = parseFloat(v);
  if (isNaN(n)) return '—';
  return n >= 0 ? `+$${Math.abs(Math.round(n)).toLocaleString()}` : `-$${Math.abs(Math.round(n)).toLocaleString()}`;
}

// ── Outcome bar — shows stop / entry / exit / target on a linear price scale ──
function OutcomeBar({ entry, exit, stop, target, direction }) {
  const isLong = direction === 'long';
  const pts = [entry, exit, stop, target].filter(Boolean).map(parseFloat).filter(v => !isNaN(v));
  if (pts.length < 2) return null;

  const lo   = Math.min(...pts) - (Math.max(...pts) - Math.min(...pts)) * 0.08;
  const hi   = Math.max(...pts) + (Math.max(...pts) - Math.min(...pts)) * 0.08;
  const span = hi - lo || 1;
  const pct  = (p) => `${((parseFloat(p) - lo) / span * 100).toFixed(1)}%`;

  const isWin = isLong ? parseFloat(exit) > parseFloat(entry) : parseFloat(exit) < parseFloat(entry);

  return (
    <div style={{ padding: '14px 16px 10px', background: '#080a0e', borderTop: '1px solid #1a2030' }}>
      <div style={{ fontSize: 10, color: '#94a3b8', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>
        Price Outcome
      </div>
      <div style={{ position: 'relative', height: 32, marginBottom: 6 }}>
        {/* track */}
        <div style={{ position: 'absolute', top: 14, left: 0, right: 0, height: 4, background: '#1a2030', borderRadius: 2 }} />

        {/* filled zone: entry → exit */}
        {entry && exit && (
          <div style={{
            position: 'absolute', top: 14, height: 4, borderRadius: 2,
            left: isLong ? pct(Math.min(entry, exit)) : pct(Math.min(entry, exit)),
            width: `${Math.abs(parseFloat(exit) - parseFloat(entry)) / span * 100}%`,
            background: isWin ? '#22c55e' : '#ef4444',
          }} />
        )}

        {/* stop marker */}
        {stop && (
          <div style={{ position: 'absolute', left: pct(stop), transform: 'translateX(-50%)', top: 0 }}>
            <div style={{ width: 2, height: 32, background: '#ef444466', borderRadius: 1 }} />
            <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)',
              fontSize: 9, color: '#ef4444', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>STP</div>
          </div>
        )}

        {/* target marker */}
        {target && (
          <div style={{ position: 'absolute', left: pct(target), transform: 'translateX(-50%)', top: 0 }}>
            <div style={{ width: 2, height: 32, background: '#22c55e66', borderRadius: 1 }} />
            <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)',
              fontSize: 9, color: '#22c55e', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>TGT</div>
          </div>
        )}

        {/* entry dot */}
        {entry && (
          <div style={{ position: 'absolute', left: pct(entry), transform: 'translateX(-50%)', top: 9 }}>
            <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#60a5fa',
              border: '2px solid #0d0f14', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#fff' }} />
            </div>
          </div>
        )}

        {/* exit dot */}
        {exit && (
          <div style={{ position: 'absolute', left: pct(exit), transform: 'translateX(-50%)', top: 9 }}>
            <div style={{ width: 14, height: 14, borderRadius: '50%',
              background: isWin ? '#22c55e' : '#ef4444', border: '2px solid #0d0f14' }} />
          </div>
        )}
      </div>

      {/* price labels */}
      <div style={{ position: 'relative', height: 16 }}>
        {stop && (
          <div style={{ position: 'absolute', left: pct(stop), transform: 'translateX(-50%)',
            fontSize: 9, color: '#ef4444', fontFamily: 'monospace' }}>{parseFloat(stop).toFixed(1)}</div>
        )}
        {entry && (
          <div style={{ position: 'absolute', left: pct(entry), transform: 'translateX(-50%)',
            fontSize: 9, color: '#60a5fa', fontFamily: 'monospace' }}>{parseFloat(entry).toFixed(1)}</div>
        )}
        {exit && (
          <div style={{ position: 'absolute', left: pct(exit), transform: 'translateX(-50%)',
            fontSize: 9, color: isWin ? '#22c55e' : '#ef4444', fontFamily: 'monospace', fontWeight: 700 }}>{parseFloat(exit).toFixed(1)}</div>
        )}
        {target && (
          <div style={{ position: 'absolute', left: pct(target), transform: 'translateX(-50%)',
            fontSize: 9, color: '#22c55e', fontFamily: 'monospace' }}>{parseFloat(target).toFixed(1)}</div>
        )}
      </div>

      {/* legend */}
      <div style={{ display: 'flex', gap: 14, marginTop: 8 }}>
        {[
          { color: '#60a5fa', label: 'Entry' },
          { color: isWin ? '#22c55e' : '#ef4444', label: 'Exit' },
          { color: '#22c55e', label: 'Target' },
          { color: '#ef4444', label: 'Stop' },
        ].map((l, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: l.color }} />
            <span style={{ fontSize: 10, color: '#94a3b8' }}>{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}


// ── Real P&L Chart — drawn from entry/MFE/MAE/exit actual prices ─────────────
function PnLChart({ entry, exitPrice, mfePrice, maePrice, stopPrice, targetPrice, direction, mult, qty }) {
  const isLong = direction === 'long';
  const W = 500, H = 160, PAD = { top: 24, right: 52, bottom: 24, left: 62 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top  - PAD.bottom;

  // convert price to P&L
  const toPnl = (price) => {
    if (!price) return null;
    const pts = isLong ? parseFloat(price) - parseFloat(entry) : parseFloat(entry) - parseFloat(price);
    return Math.round(pts * mult * qty);
  };

  const exitPnl  = toPnl(exitPrice)  || 0;
  const mfePnl   = toPnl(mfePrice);
  const maePnl   = toPnl(maePrice);
  const stopPnl  = toPnl(stopPrice);
  const tgtPnl   = toPnl(targetPrice);

  // Build 4-point path: entry(0) → MAE or MFE → MFE or MAE → exit
  const path = [{ label: 'Entry', pnl: 0 }];
  if (mfePnl !== null && maePnl !== null) {
    if (exitPnl >= 0) {
      path.push({ label: 'Low', pnl: maePnl });
      path.push({ label: 'High', pnl: mfePnl });
    } else {
      path.push({ label: 'High', pnl: mfePnl });
      path.push({ label: 'Low', pnl: maePnl });
    }
  } else if (mfePnl !== null) {
    path.push({ label: 'High', pnl: mfePnl });
  } else if (maePnl !== null) {
    path.push({ label: 'Low', pnl: maePnl });
  }
  path.push({ label: 'Exit', pnl: exitPnl });

  // y scale — include stop and target in range
  const allPnls = path.map(p => p.pnl).concat(
    [stopPnl, tgtPnl].filter(v => v !== null)
  );
  const minPnl = Math.min(...allPnls) * 1.15;
  const maxPnl = Math.max(...allPnls) * 1.15 || 50;
  const range  = (maxPnl - minPnl) || 1;

  const toX = (i) => PAD.left + (i / (path.length - 1)) * innerW;
  const toY = (v) => PAD.top + ((maxPnl - v) / range) * innerH;
  const zeroY = toY(0);
  const isWin = exitPnl >= 0;
  const lineColor = isWin ? '#22c55e' : '#ef4444';
  const fmt = (v) => v >= 0 ? `+$${Math.abs(Math.round(v))}` : `-$${Math.abs(Math.round(v))}`;

  // SVG path string
  const svgPath = path.map((p, i) =>
    `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(p.pnl).toFixed(1)}`
  ).join(' ');

  // fill path
  const fillPath = `${svgPath} L${toX(path.length-1).toFixed(1)},${zeroY.toFixed(1)} L${toX(0).toFixed(1)},${zeroY.toFixed(1)} Z`;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}
      style={{ display: 'block', width: '100%', maxWidth: W }}>
      <defs>
        <linearGradient id="rc-win" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#22c55e" stopOpacity="0.4"/>
          <stop offset="100%" stopColor="#22c55e" stopOpacity="0.02"/>
        </linearGradient>
        <linearGradient id="rc-loss" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.02"/>
          <stop offset="100%" stopColor="#ef4444" stopOpacity="0.35"/>
        </linearGradient>
        <clipPath id="rc-above">
          <rect x={PAD.left} y={PAD.top} width={innerW} height={Math.max(0, zeroY - PAD.top)}/>
        </clipPath>
        <clipPath id="rc-below">
          <rect x={PAD.left} y={zeroY} width={innerW} height={Math.max(0, H - PAD.bottom - zeroY)}/>
        </clipPath>
      </defs>

      {/* zero line */}
      <line x1={PAD.left} y1={zeroY} x2={W - PAD.right} y2={zeroY}
        stroke="#ffffff22" strokeWidth="1"/>
      <text x={PAD.left - 5} y={zeroY + 4} textAnchor="end"
        fontSize="10" fill="#94a3b8" fontFamily="monospace">$0</text>

      {/* stop line */}
      {stopPnl !== null && (
        <>
          <line x1={PAD.left} y1={toY(stopPnl)} x2={W - PAD.right} y2={toY(stopPnl)}
            stroke="#ef444455" strokeWidth="1" strokeDasharray="4,3"/>
          <text x={W - PAD.right + 4} y={toY(stopPnl) + 4}
            fontSize="9" fill="#ef4444" fontFamily="monospace">STP</text>
        </>
      )}

      {/* target line */}
      {tgtPnl !== null && (
        <>
          <line x1={PAD.left} y1={toY(tgtPnl)} x2={W - PAD.right} y2={toY(tgtPnl)}
            stroke="#22c55e55" strokeWidth="1" strokeDasharray="4,3"/>
          <text x={W - PAD.right + 4} y={toY(tgtPnl) + 4}
            fontSize="9" fill="#22c55e" fontFamily="monospace">TGT</text>
        </>
      )}

      {/* fill */}
      <path d={fillPath} fill="url(#rc-win)"  clipPath="url(#rc-above)"/>
      <path d={fillPath} fill="url(#rc-loss)" clipPath="url(#rc-below)"/>

      {/* line */}
      <path d={svgPath} fill="none" stroke={lineColor} strokeWidth="2.5"
        strokeLinejoin="round" strokeLinecap="round"/>

      {/* dots + labels */}
      {path.map((p, i) => {
        const x = toX(i), y = toY(p.pnl);
        const isEntry = p.label === 'Entry';
        const isExit  = p.label === 'Exit';
        const dotColor = isEntry ? '#60a5fa' : isExit ? lineColor : p.pnl >= 0 ? '#22c55e' : '#ef4444';
        const labelY   = p.pnl >= 0 ? y - 9 : y + 17;
        return (
          <g key={i}>
            <circle cx={x} cy={y} r={isEntry || isExit ? 6 : 5}
              fill={dotColor} stroke="#0d0f14" strokeWidth="2"/>
            <text x={x} y={labelY} textAnchor="middle"
              fontSize="10" fill={dotColor} fontFamily="monospace" fontWeight="bold">
              {fmt(p.pnl)}
            </text>
            <text x={x} y={H - 6} textAnchor="middle"
              fontSize="9" fill="#64748b" fontFamily="monospace">
              {p.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── MFE/MAE manual input ──────────────────────────────────────────────────────
function MFEInput({ tradeId, entry, exitPrice, stopPrice, targetPrice, direction, mult, qty, onSaved }) {
  const [mfe, setMfe] = useState('');
  const [mae, setMae] = useState('');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const isLong = direction === 'long';

  // load existing values
  useEffect(() => {
    if (!tradeId) { setLoading(false); return; }
    supabase.from('trades').select('mfe_price, mae_price').eq('id', tradeId).single()
      .then(({ data: d }) => {
        if (d?.mfe_price) setMfe(d.mfe_price);
        if (d?.mae_price) setMae(d.mae_price);
        setLoading(false);
      });
  }, [tradeId]);

  const calcPnl = (price) => {
    if (!price || !entry) return null;
    const pts = isLong ? parseFloat(price) - parseFloat(entry) : parseFloat(entry) - parseFloat(price);
    return Math.round(pts * mult * qty);
  };

  const save = async () => {
    if (!tradeId) return;
    const { error } = await supabase.from('trades').update({
      mfe_price: mfe ? parseFloat(mfe) : null,
      mae_price: mae ? parseFloat(mae) : null,
    }).eq('id', tradeId);
    if (!error) { setSaved(true); setTimeout(() => setSaved(false), 2000); if (onSaved) onSaved(); }
  };

  const mfePnl = calcPnl(mfe);
  const maePnl = calcPnl(mae);

  if (loading) return null;

  return (
    <div style={{ padding: '12px 16px', background: '#080a0e', borderTop: '1px solid #1a2030' }}>
      <div style={{ fontSize: 10, color: '#94a3b8', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>
        Best & Worst Price Reached
        <span style={{ color: '#64748b', marginLeft: 6, fontSize: 9 }}>— enter manually after reviewing trade</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <div style={{ fontSize: 11, color: '#22c55e', marginBottom: 5, fontWeight: 600 }}>
              BEST PRICE (MFE){mfePnl !== null ? <span style={{ opacity: 0.7 }}> → {fmt(mfePnl)}</span> : ''}
            </div>
            <input type="number" step="0.1" value={mfe}
              placeholder={isLong ? '4720' : '4580'}
              onChange={e => setMfe(e.target.value)}
              style={{ width: '100%', background: '#111', border: '1px solid #1e3a1e',
                borderRadius: 6, padding: '10px', color: '#22c55e', fontSize: 14,
                fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#ef4444', marginBottom: 5, fontWeight: 600 }}>
              WORST PRICE (MAE){maePnl !== null ? <span style={{ opacity: 0.7 }}> → {fmt(maePnl)}</span> : ''}
            </div>
            <input type="number" step="0.1" value={mae}
              placeholder={isLong ? '4590' : '4640'}
              onChange={e => setMae(e.target.value)}
              style={{ width: '100%', background: '#111', border: '1px solid #3a1e1e',
                borderRadius: 6, padding: '10px', color: '#ef4444', fontSize: 14,
                fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
        </div>
        <button onClick={save} style={{
          width: '100%', padding: '11px', borderRadius: 6, border: 'none',
          background: saved ? '#22c55e' : '#1a2a3a',
          color: saved ? '#fff' : '#60a5fa', cursor: 'pointer',
          fontSize: 14, fontWeight: 700, fontFamily: 'inherit', transition: 'all 0.2s',
        }}>
          {saved ? '✓ Saved' : 'Save MFE / MAE'}
        </button>
      </div>

      {/* chart — shown when MFE or MAE entered */}
      {(mfe || mae) && (
        <div style={{ marginTop: 12, background: '#0a0c10', border: '1px solid #1a2030', borderRadius: 6, padding: '10px 8px 4px' }}>
          <PnLChart
            entry={entry}
            exitPrice={exitPrice}
            mfePrice={mfe || null}
            maePrice={mae || null}
            stopPrice={stopPrice}
            targetPrice={targetPrice}
            direction={direction}
            mult={mult}
            qty={qty}
          />
        </div>
      )}
import { supabase } from '../supabase';

const MULT = { MGC: 10, MNQ: 2, MYM: 0.5, MCL: 100 };
function getMult(symbol, custom_multiplier) {
  return MULT[symbol] || (custom_multiplier ? parseFloat(custom_multiplier) : 1);
}

const GRADE_COLORS = { aplus: '#22c55e', a: '#60a5fa', aminus: '#f59e0b' };
const GRADE_LABELS = { aplus: 'A+', a: 'A', aminus: 'A-' };

function fmt(v) {
  if (v === null || v === undefined || v === '') return '—';
  const n = parseFloat(v);
  if (isNaN(n)) return '—';
  return n >= 0 ? `+$${Math.abs(Math.round(n)).toLocaleString()}` : `-$${Math.abs(Math.round(n)).toLocaleString()}`;
}

// ── Outcome bar — shows stop / entry / exit / target on a linear price scale ──
function OutcomeBar({ entry, exit, stop, target, direction }) {
  const isLong = direction === 'long';
  const pts = [entry, exit, stop, target].filter(Boolean).map(parseFloat).filter(v => !isNaN(v));
  if (pts.length < 2) return null;

  const lo   = Math.min(...pts) - (Math.max(...pts) - Math.min(...pts)) * 0.08;
  const hi   = Math.max(...pts) + (Math.max(...pts) - Math.min(...pts)) * 0.08;
  const span = hi - lo || 1;
  const pct  = (p) => `${((parseFloat(p) - lo) / span * 100).toFixed(1)}%`;

  const isWin = isLong ? parseFloat(exit) > parseFloat(entry) : parseFloat(exit) < parseFloat(entry);

  return (
    <div style={{ padding: '14px 16px 10px', background: '#080a0e', borderTop: '1px solid #1a2030' }}>
      <div style={{ fontSize: 10, color: '#94a3b8', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>
        Price Outcome
      </div>
      <div style={{ position: 'relative', height: 32, marginBottom: 6 }}>
        {/* track */}
        <div style={{ position: 'absolute', top: 14, left: 0, right: 0, height: 4, background: '#1a2030', borderRadius: 2 }} />

        {/* filled zone: entry → exit */}
        {entry && exit && (
          <div style={{
            position: 'absolute', top: 14, height: 4, borderRadius: 2,
            left: isLong ? pct(Math.min(entry, exit)) : pct(Math.min(entry, exit)),
            width: `${Math.abs(parseFloat(exit) - parseFloat(entry)) / span * 100}%`,
            background: isWin ? '#22c55e' : '#ef4444',
          }} />
        )}

        {/* stop marker */}
        {stop && (
          <div style={{ position: 'absolute', left: pct(stop), transform: 'translateX(-50%)', top: 0 }}>
            <div style={{ width: 2, height: 32, background: '#ef444466', borderRadius: 1 }} />
            <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)',
              fontSize: 9, color: '#ef4444', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>STP</div>
          </div>
        )}

        {/* target marker */}
        {target && (
          <div style={{ position: 'absolute', left: pct(target), transform: 'translateX(-50%)', top: 0 }}>
            <div style={{ width: 2, height: 32, background: '#22c55e66', borderRadius: 1 }} />
            <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)',
              fontSize: 9, color: '#22c55e', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>TGT</div>
          </div>
        )}

        {/* entry dot */}
        {entry && (
          <div style={{ position: 'absolute', left: pct(entry), transform: 'translateX(-50%)', top: 9 }}>
            <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#60a5fa',
              border: '2px solid #0d0f14', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#fff' }} />
            </div>
          </div>
        )}

        {/* exit dot */}
        {exit && (
          <div style={{ position: 'absolute', left: pct(exit), transform: 'translateX(-50%)', top: 9 }}>
            <div style={{ width: 14, height: 14, borderRadius: '50%',
              background: isWin ? '#22c55e' : '#ef4444', border: '2px solid #0d0f14' }} />
          </div>
        )}
      </div>

      {/* price labels */}
      <div style={{ position: 'relative', height: 16 }}>
        {stop && (
          <div style={{ position: 'absolute', left: pct(stop), transform: 'translateX(-50%)',
            fontSize: 9, color: '#ef4444', fontFamily: 'monospace' }}>{parseFloat(stop).toFixed(1)}</div>
        )}
        {entry && (
          <div style={{ position: 'absolute', left: pct(entry), transform: 'translateX(-50%)',
            fontSize: 9, color: '#60a5fa', fontFamily: 'monospace' }}>{parseFloat(entry).toFixed(1)}</div>
        )}
        {exit && (
          <div style={{ position: 'absolute', left: pct(exit), transform: 'translateX(-50%)',
            fontSize: 9, color: isWin ? '#22c55e' : '#ef4444', fontFamily: 'monospace', fontWeight: 700 }}>{parseFloat(exit).toFixed(1)}</div>
        )}
        {target && (
          <div style={{ position: 'absolute', left: pct(target), transform: 'translateX(-50%)',
            fontSize: 9, color: '#22c55e', fontFamily: 'monospace' }}>{parseFloat(target).toFixed(1)}</div>
        )}
      </div>

      {/* legend */}
      <div style={{ display: 'flex', gap: 14, marginTop: 8 }}>
        {[
          { color: '#60a5fa', label: 'Entry' },
          { color: isWin ? '#22c55e' : '#ef4444', label: 'Exit' },
          { color: '#22c55e', label: 'Target' },
          { color: '#ef4444', label: 'Stop' },
        ].map((l, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: l.color }} />
            <span style={{ fontSize: 10, color: '#94a3b8' }}>{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}


// ── Real P&L Chart — drawn from entry/MFE/MAE/exit actual prices ─────────────
function PnLChart({ entry, exitPrice, mfePrice, maePrice, stopPrice, targetPrice, direction, mult, qty }) {
  const isLong = direction === 'long';
  const W = 500, H = 160, PAD = { top: 24, right: 52, bottom: 24, left: 62 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top  - PAD.bottom;

  // convert price to P&L
  const toPnl = (price) => {
    if (!price) return null;
    const pts = isLong ? parseFloat(price) - parseFloat(entry) : parseFloat(entry) - parseFloat(price);
    return Math.round(pts * mult * qty);
  };

  const exitPnl  = toPnl(exitPrice)  || 0;
  const mfePnl   = toPnl(mfePrice);
  const maePnl   = toPnl(maePrice);
  const stopPnl  = toPnl(stopPrice);
  const tgtPnl   = toPnl(targetPrice);

  // Build 4-point path: entry(0) → MAE or MFE → MFE or MAE → exit
  const path = [{ label: 'Entry', pnl: 0 }];
  if (mfePnl !== null && maePnl !== null) {
    if (exitPnl >= 0) {
      path.push({ label: 'Low', pnl: maePnl });
      path.push({ label: 'High', pnl: mfePnl });
    } else {
      path.push({ label: 'High', pnl: mfePnl });
      path.push({ label: 'Low', pnl: maePnl });
    }
  } else if (mfePnl !== null) {
    path.push({ label: 'High', pnl: mfePnl });
  } else if (maePnl !== null) {
    path.push({ label: 'Low', pnl: maePnl });
  }
  path.push({ label: 'Exit', pnl: exitPnl });

  // y scale — include stop and target in range
  const allPnls = path.map(p => p.pnl).concat(
    [stopPnl, tgtPnl].filter(v => v !== null)
  );
  const minPnl = Math.min(...allPnls) * 1.15;
  const maxPnl = Math.max(...allPnls) * 1.15 || 50;
  const range  = (maxPnl - minPnl) || 1;

  const toX = (i) => PAD.left + (i / (path.length - 1)) * innerW;
  const toY = (v) => PAD.top + ((maxPnl - v) / range) * innerH;
  const zeroY = toY(0);
  const isWin = exitPnl >= 0;
  const lineColor = isWin ? '#22c55e' : '#ef4444';
  const fmt = (v) => v >= 0 ? `+$${Math.abs(Math.round(v))}` : `-$${Math.abs(Math.round(v))}`;

  // SVG path string
  const svgPath = path.map((p, i) =>
    `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(p.pnl).toFixed(1)}`
  ).join(' ');

  // fill path
  const fillPath = `${svgPath} L${toX(path.length-1).toFixed(1)},${zeroY.toFixed(1)} L${toX(0).toFixed(1)},${zeroY.toFixed(1)} Z`;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}
      style={{ display: 'block', width: '100%', maxWidth: W }}>
      <defs>
        <linearGradient id="rc-win" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#22c55e" stopOpacity="0.4"/>
          <stop offset="100%" stopColor="#22c55e" stopOpacity="0.02"/>
        </linearGradient>
        <linearGradient id="rc-loss" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.02"/>
          <stop offset="100%" stopColor="#ef4444" stopOpacity="0.35"/>
        </linearGradient>
        <clipPath id="rc-above">
          <rect x={PAD.left} y={PAD.top} width={innerW} height={Math.max(0, zeroY - PAD.top)}/>
        </clipPath>
        <clipPath id="rc-below">
          <rect x={PAD.left} y={zeroY} width={innerW} height={Math.max(0, H - PAD.bottom - zeroY)}/>
        </clipPath>
      </defs>

      {/* zero line */}
      <line x1={PAD.left} y1={zeroY} x2={W - PAD.right} y2={zeroY}
        stroke="#ffffff22" strokeWidth="1"/>
      <text x={PAD.left - 5} y={zeroY + 4} textAnchor="end"
        fontSize="10" fill="#94a3b8" fontFamily="monospace">$0</text>

      {/* stop line */}
      {stopPnl !== null && (
        <>
          <line x1={PAD.left} y1={toY(stopPnl)} x2={W - PAD.right} y2={toY(stopPnl)}
            stroke="#ef444455" strokeWidth="1" strokeDasharray="4,3"/>
          <text x={W - PAD.right + 4} y={toY(stopPnl) + 4}
            fontSize="9" fill="#ef4444" fontFamily="monospace">STP</text>
        </>
      )}

      {/* target line */}
      {tgtPnl !== null && (
        <>
          <line x1={PAD.left} y1={toY(tgtPnl)} x2={W - PAD.right} y2={toY(tgtPnl)}
            stroke="#22c55e55" strokeWidth="1" strokeDasharray="4,3"/>
          <text x={W - PAD.right + 4} y={toY(tgtPnl) + 4}
            fontSize="9" fill="#22c55e" fontFamily="monospace">TGT</text>
        </>
      )}

      {/* fill */}
      <path d={fillPath} fill="url(#rc-win)"  clipPath="url(#rc-above)"/>
      <path d={fillPath} fill="url(#rc-loss)" clipPath="url(#rc-below)"/>

      {/* line */}
      <path d={svgPath} fill="none" stroke={lineColor} strokeWidth="2.5"
        strokeLinejoin="round" strokeLinecap="round"/>

      {/* dots + labels */}
      {path.map((p, i) => {
        const x = toX(i), y = toY(p.pnl);
        const isEntry = p.label === 'Entry';
        const isExit  = p.label === 'Exit';
        const dotColor = isEntry ? '#60a5fa' : isExit ? lineColor : p.pnl >= 0 ? '#22c55e' : '#ef4444';
        const labelY   = p.pnl >= 0 ? y - 9 : y + 17;
        return (
          <g key={i}>
            <circle cx={x} cy={y} r={isEntry || isExit ? 6 : 5}
              fill={dotColor} stroke="#0d0f14" strokeWidth="2"/>
            <text x={x} y={labelY} textAnchor="middle"
              fontSize="10" fill={dotColor} fontFamily="monospace" fontWeight="bold">
              {fmt(p.pnl)}
            </text>
            <text x={x} y={H - 6} textAnchor="middle"
              fontSize="9" fill="#64748b" fontFamily="monospace">
              {p.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── MFE/MAE manual input ──────────────────────────────────────────────────────
function MFEInput({ tradeId, entry, exitPrice, stopPrice, targetPrice, direction, mult, qty, onSaved }) {
  const [mfe, setMfe] = useState('');
  const [mae, setMae] = useState('');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const isLong = direction === 'long';

  // load existing values
  useEffect(() => {
    if (!tradeId) { setLoading(false); return; }
    supabase.from('trades').select('mfe_price, mae_price').eq('id', tradeId).single()
      .then(({ data: d }) => {
        if (d?.mfe_price) setMfe(d.mfe_price);
        if (d?.mae_price) setMae(d.mae_price);
        setLoading(false);
      });
  }, [tradeId]);

  const calcPnl = (price) => {
    if (!price || !entry) return null;
    const pts = isLong ? parseFloat(price) - parseFloat(entry) : parseFloat(entry) - parseFloat(price);
    return Math.round(pts * mult * qty);
  };

  const save = async () => {
    if (!tradeId) return;
    const { error } = await supabase.from('trades').update({
      mfe_price: mfe ? parseFloat(mfe) : null,
      mae_price: mae ? parseFloat(mae) : null,
    }).eq('id', tradeId);
    if (!error) { setSaved(true); setTimeout(() => setSaved(false), 2000); if (onSaved) onSaved(); }
  };

  const mfePnl = calcPnl(mfe);
  const maePnl = calcPnl(mae);

  if (loading) return null;

  return (
    <div style={{ padding: '12px 16px', background: '#080a0e', borderTop: '1px solid #1a2030' }}>
      <div style={{ fontSize: 10, color: '#94a3b8', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>
        Best & Worst Price Reached
        <span style={{ color: '#64748b', marginLeft: 6, fontSize: 9 }}>— enter manually after reviewing trade</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <div style={{ fontSize: 11, color: '#22c55e', marginBottom: 5, fontWeight: 600 }}>
              BEST PRICE (MFE){mfePnl !== null ? <span style={{ opacity: 0.7 }}> → {fmt(mfePnl)}</span> : ''}
            </div>
            <input type="number" step="0.1" value={mfe}
              placeholder={isLong ? '4720' : '4580'}
              onChange={e => setMfe(e.target.value)}
              style={{ width: '100%', background: '#111', border: '1px solid #1e3a1e',
                borderRadius: 6, padding: '10px', color: '#22c55e', fontSize: 14,
                fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#ef4444', marginBottom: 5, fontWeight: 600 }}>
              WORST PRICE (MAE){maePnl !== null ? <span style={{ opacity: 0.7 }}> → {fmt(maePnl)}</span> : ''}
            </div>
            <input type="number" step="0.1" value={mae}
              placeholder={isLong ? '4590' : '4640'}
              onChange={e => setMae(e.target.value)}
              style={{ width: '100%', background: '#111', border: '1px solid #3a1e1e',
                borderRadius: 6, padding: '10px', color: '#ef4444', fontSize: 14,
                fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
        </div>
        <button onClick={save} style={{
          width: '100%', padding: '11px', borderRadius: 6, border: 'none',
          background: saved ? '#22c55e' : '#1a2a3a',
          color: saved ? '#fff' : '#60a5fa', cursor: 'pointer',
          fontSize: 14, fontWeight: 700, fontFamily: 'inherit', transition: 'all 0.2s',
        }}>
          {saved ? '✓ Saved' : 'Save MFE / MAE'}
        </button>
      </div>

      {/* chart — shown when MFE or MAE is entered */}
      {(mfe || mae) && (
        <div style={{ marginTop: 12, background: '#0a0c10', border: '1px solid #1a2030', borderRadius: 6, padding: '10px 8px 4px' }}>
          <PnLChart
            entry={entry}
            exitPrice={exitPrice}
            mfePrice={mfe || null}
            maePrice={mae || null}
            stopPrice={stopPrice}
            targetPrice={targetPrice}
            direction={direction}
            mult={mult}
            qty={qty}
          />
        </div>
      )}    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function TradeReviewChart({ trade, onClose }) {
  const {
    id, symbol, direction, entry, exit_price, stop, target,
    pnl, contracts, custom_multiplier, grade, exit_reason,
    al_strength, al_touches, al_age, sl_quality, sl_touches, sl_age,
    date, time, notes,
  } = trade;

  const mult   = getMult(symbol, custom_multiplier);
  const qty    = parseFloat(contracts) || 1;
  const exitPnl = parseFloat(pnl) || 0;
  const isWin  = exitPnl >= 0;

  const gc = GRADE_COLORS[grade] || '#888';
  const gl = GRADE_LABELS[grade] || grade;

  // R:R calculation
  const entryP    = parseFloat(entry)      || 0;
  const stopP     = parseFloat(stop)       || 0;
  const targetP   = parseFloat(target)     || 0;
  const exitP     = parseFloat(exit_price) || 0;
  const stopDist   = stopP   ? Math.abs(entryP - stopP)   : 0;
  const targetDist = targetP ? Math.abs(targetP - entryP) : 0;
  const exitDist   = Math.abs(exitP - entryP);
  const rr         = stopDist > 0 ? (targetDist / stopDist).toFixed(2) : '—';
  const captured   = targetDist > 0 ? Math.round(exitDist / targetDist * 100) : null;
  const leftPts    = targetDist > exitDist ? targetDist - exitDist : 0;
  const leftDollars = Math.round(leftPts * mult * qty);

  const isStrongAL = al_strength === 'strong' && parseInt(al_touches) >= 3 && al_age === '1wk+';
  const isStrongSL = sl_quality  === 'strong' && parseInt(sl_touches) >= 3 && sl_age === '1wk+';

  return (
    <div style={{
      background: '#0d0f14',
      border: `2px solid ${isWin ? '#22c55e' : '#ef4444'}`,
      borderRadius: 10, overflow: 'hidden',
      boxShadow: `0 0 24px ${isWin ? '#22c55e33' : '#ef444433'}, 0 4px 16px rgba(0,0,0,0.6)`,
    }}>

      {/* ── header ── */}
      <div style={{
        padding: '12px 16px',
        background: isWin ? '#0d1f14' : '#1a0d0d',
        borderBottom: `1px solid ${isWin ? '#22c55e33' : '#ef444433'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', fontFamily: 'monospace' }}>
            {symbol} {direction.toUpperCase()}
          </span>
          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4,
            background: gc + '22', color: gc, fontWeight: 700 }}>{gl}</span>
          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4,
            background: isWin ? '#22c55e15' : '#ef444415',
            color: isWin ? '#22c55e' : '#ef4444', fontWeight: 700 }}>
            {(exit_reason || '—').toUpperCase()}
          </span>
          {date && <span style={{ fontSize: 11, color: '#94a3b8' }}>{date}{time ? ` ${time}` : ''}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace',
            color: isWin ? '#22c55e' : '#ef4444' }}>{fmt(exitPnl)}</span>

        </div>
      </div>

      {/* ── price outcome bar ── */}
      <OutcomeBar entry={entry} exit={exit_price} stop={stop} target={target} direction={direction} />

      {/* ── stats row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)',
        borderTop: '1px solid #1a2030', background: '#0d0f14' }}>
        {[
          { label: 'Entry',    value: entryP  || '—', mono: true },
          { label: 'Exit',     value: exitP   || '—', mono: true },
          { label: 'Stop',     value: stopP   || '—', mono: true },
          { label: 'Target',   value: targetP || '—', mono: true },
          { label: 'R:R',      value: rr !== '—' ? rr + ':1' : '—', color: '#60a5fa' },
          { label: '% of TGT', value: captured !== null ? captured + '%' : '—',
            color: captured === null ? '#64748b' : captured >= 90 ? '#22c55e' : captured >= 50 ? '#f59e0b' : '#ef4444' },
        ].map((s, i) => (
          <div key={i} style={{ padding: '10px 0', textAlign: 'center',
            borderRight: i < 5 ? '1px solid #1a2030' : 'none' }}>
            <div style={{ fontSize: 10, color: '#94a3b8', letterSpacing: '0.08em',
              textTransform: 'uppercase', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: s.color || '#94a3b8',
              fontFamily: s.mono ? 'monospace' : 'inherit' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* ── left on table row ── */}
      {targetDist > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
          borderTop: '1px solid #1a2030', background: '#080a0e' }}>
          {[
            { label: 'Stop Distance',   value: stopDist   ? `${stopDist.toFixed(1)} pts = ${fmt(-stopDist * mult * qty)}` : '—', color: '#ef4444' },
            { label: 'Target Distance', value: targetDist ? `${targetDist.toFixed(1)} pts = ${fmt(targetDist * mult * qty)}` : '—', color: '#22c55e' },
            { label: 'Left on Table',   value: leftDollars > 0 ? `-$${leftDollars.toLocaleString()}` : isWin ? '✓ Full target hit' : '—',
              color: leftDollars > 0 ? '#f59e0b' : '#22c55e' },
          ].map((s, i) => (
            <div key={i} style={{ padding: '10px 0', textAlign: 'center',
              borderRight: i < 2 ? '1px solid #1a2030' : 'none' }}>
              <div style={{ fontSize: 10, color: '#94a3b8', letterSpacing: '0.08em',
                textTransform: 'uppercase', marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: s.color, fontFamily: 'monospace' }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── MFE/MAE manual entry ── */}
      <MFEInput
        tradeId={id}
        entry={entry}
        exitPrice={exit_price}
        stopPrice={stop}
        targetPrice={target}
        direction={direction}
        mult={mult}
        qty={qty}
        onSaved={null}
      />

      {/* ── AL / SL ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr',
        borderTop: '1px solid #1a2030', background: '#080a0e' }}>
        {[
          { label: 'Action Line', strong: isStrongAL, touches: al_touches, age: al_age },
          { label: 'Safety Line', strong: isStrongSL, touches: sl_touches, age: sl_age },
        ].map((line, i) => {
          const c = line.strong ? '#22c55e' : '#f59e0b';
          return (
            <div key={i} style={{ padding: '8px 16px', borderRight: i === 0 ? '1px solid #1a2030' : 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>{line.label}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: c,
                background: c + '18', padding: '2px 8px', borderRadius: 4 }}>
                {line.strong ? '★ Strong' : '~ Standard'} · {line.touches || '?'}t · {line.age || '—'}
              </span>
            </div>
          );
        })}
      </div>

      {/* ── notes ── */}
      {notes && (
        <div style={{ padding: '10px 16px', background: '#080a0e',
          borderTop: '1px solid #1a2030' }}>
          <div style={{ fontSize: 11, color: '#94a3b8', letterSpacing: '0.08em',
            textTransform: 'uppercase', marginBottom: 4 }}>Notes</div>
          <div style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.5 }}>{notes}</div>
        </div>
      )}

      {/* ── close button — full width, easy to tap ── */}
      {onClose && (
        <div style={{ padding: '12px 16px', borderTop: '1px solid #1a2030', background: '#0a0c10' }}>
          <button onClick={onClose} style={{
            width: '100%', padding: '11px', borderRadius: 6,
            background: 'transparent', border: '1px solid #2a3545',
            color: '#94a3b8', cursor: 'pointer', fontSize: 14,
            fontWeight: 600, fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Close Review
          </button>
        </div>
      )}
    </div>
  );
}
