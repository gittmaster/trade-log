import { useMemo, useState, useEffect } from 'react';
import { useTOSTradeData } from './TOSUploader';

const MULT = { MGC: 10, MNQ: 2, MYM: 0.5, MCL: 100 };

function getMultiplier(symbol, custom_multiplier) {
  if (MULT[symbol]) return MULT[symbol];
  return custom_multiplier ? parseFloat(custom_multiplier) : 1;
}

// ── Generate a plausible price path between entry and exit ───────────────────
// Uses stop/target as bounds. Simulates a realistic-looking trade path
// with noise, a peak (MFE), a trough (MAE), and exits at the actual price.
function generatePath(entry, exit, stop, target, direction, points = 80) {
  const isLong = direction === 'long';
  const mult   = 1; // we work in price-space, convert to $ later

  // bounds
  const stopDist   = stop   ? Math.abs(entry - stop)   : Math.abs(exit - entry) * 1.5;
  const targetDist = target ? Math.abs(target - entry) : Math.abs(exit - entry) * 2;
  const exitDist   = (isLong ? exit - entry : entry - exit);

  // generate a path using a random walk biased toward exit
  const path = [0]; // P&L in points relative to entry
  let current = 0;
  const bias  = exitDist / points;  // drift toward final exit
  const noise = Math.max(stopDist, targetDist) * 0.06;

  // inject a MFE peak around 55-75% of the way through
  const mfePt   = Math.floor(points * (0.55 + Math.random() * 0.2));
  const mfeVal  = exitDist > 0
    ? targetDist * (0.6 + Math.random() * 0.35)   // winner — got close to target
    : targetDist * (0.2 + Math.random() * 0.3);   // loser — ran up briefly

  // inject a MAE trough around 15-35%
  const maePt   = Math.floor(points * (0.1 + Math.random() * 0.25));
  const maeVal  = -stopDist * (0.3 + Math.random() * 0.5);

  for (let i = 1; i < points; i++) {
    const progress = i / points;
    let step = bias + (Math.random() - 0.48) * noise;

    // pull toward MFE peak
    if (i === mfePt) { current = mfeVal; path.push(current); continue; }
    // pull toward MAE trough
    if (i === maePt) { current = maeVal; path.push(current); continue; }

    // smooth convergence to exit in final 20%
    if (progress > 0.8) {
      const remaining = (exitDist - current) / ((1 - progress) * points + 1);
      step = remaining * 0.3 + (Math.random() - 0.48) * noise * 0.5;
    }

    current = Math.max(maeVal * 1.1, Math.min(mfeVal * 1.1, current + step));
    path.push(current);
  }
  path.push(exitDist); // always end at exact exit

  return path; // in points, need * mult * contracts for $
}

// ── SVG chart ────────────────────────────────────────────────────────────────
function PnLCurve({ path, mult, contracts, stopDist, targetDist, exitPnl, direction }) {
  const W = 560, H = 180, PAD = { top: 20, right: 16, bottom: 28, left: 58 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top  - PAD.bottom;

  const pnlPath = path.map(p => p * mult * contracts);
  const minPnl  = Math.min(...pnlPath, -stopDist * mult * contracts * 0.5);
  const maxPnl  = Math.max(...pnlPath,  targetDist * mult * contracts * 0.5);
  const range   = maxPnl - minPnl || 1;

  const toX = (i) => PAD.left + (i / (pnlPath.length - 1)) * innerW;
  const toY = (v) => PAD.top  + ((maxPnl - v) / range) * innerH;

  const zeroY = toY(0);

  // build SVG path string
  const pts = pnlPath.map((v, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(' ');
  const fillPts = `${pts} L${toX(pnlPath.length-1).toFixed(1)},${zeroY.toFixed(1)} L${toX(0).toFixed(1)},${zeroY.toFixed(1)} Z`;

  // find MFE and MAE points
  let mfeIdx = 0, maeIdx = 0;
  pnlPath.forEach((v, i) => {
    if (v > pnlPath[mfeIdx]) mfeIdx = i;
    if (v < pnlPath[maeIdx]) maeIdx = i;
  });
  const mfePnl = pnlPath[mfeIdx];
  const maePnl = pnlPath[maeIdx];

  const isWin  = exitPnl >= 0;
  const lineColor = isWin ? '#22c55e' : '#ef4444';

  const fmt = (v) => v >= 0 ? `+$${Math.abs(Math.round(v))}` : `-$${Math.abs(Math.round(v))}`;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', width: '100%', maxWidth: W }}>
      <defs>
        <linearGradient id="fill-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={lineColor} stopOpacity="0.35" />
          <stop offset="100%" stopColor={lineColor} stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id="loss-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.02" />
          <stop offset="100%" stopColor="#ef4444" stopOpacity="0.25" />
        </linearGradient>
        <clipPath id="above-zero">
          <rect x={PAD.left} y={PAD.top} width={innerW} height={Math.max(0, zeroY - PAD.top)} />
        </clipPath>
        <clipPath id="below-zero">
          <rect x={PAD.left} y={zeroY} width={innerW} height={Math.max(0, H - PAD.bottom - zeroY)} />
        </clipPath>
      </defs>

      {/* grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map(t => {
        const v  = minPnl + t * range;
        const y  = toY(v);
        const lbl = fmt(v);
        return (
          <g key={t}>
            <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
              stroke={Math.abs(v) < range * 0.02 ? '#ffffff22' : '#ffffff0d'}
              strokeWidth={Math.abs(v) < range * 0.02 ? 1.5 : 0.5}
              strokeDasharray={Math.abs(v) < range * 0.02 ? '0' : '3,4'}
            />
            <text x={PAD.left - 6} y={y + 4} textAnchor="end"
              fontSize="10" fill={v >= 0 ? '#4ade8088' : '#f8717188'} fontFamily="monospace">
              {lbl}
            </text>
          </g>
        );
      })}

      {/* zero line label */}
      <text x={PAD.left - 6} y={zeroY + 4} textAnchor="end"
        fontSize="10" fill="#ffffff55" fontFamily="monospace">$0</text>

      {/* fill above zero */}
      <path d={fillPts} fill="url(#fill-grad)" clipPath="url(#above-zero)" />
      {/* fill below zero */}
      <path d={fillPts} fill="url(#loss-grad)" clipPath="url(#below-zero)" />

      {/* main curve */}
      <path d={pts} fill="none" stroke={lineColor} strokeWidth="1.8"
        strokeLinejoin="round" strokeLinecap="round" />

      {/* stop line */}
      {stopDist > 0 && (
        <g>
          <line x1={PAD.left} y1={toY(-stopDist * mult * contracts)}
            x2={W - PAD.right} y2={toY(-stopDist * mult * contracts)}
            stroke="#ef444455" strokeWidth="1" strokeDasharray="4,4" />
          <text x={W - PAD.right + 2} y={toY(-stopDist * mult * contracts) + 4}
            fontSize="9" fill="#ef444488" fontFamily="monospace">STP</text>
        </g>
      )}

      {/* target line */}
      {targetDist > 0 && (
        <g>
          <line x1={PAD.left} y1={toY(targetDist * mult * contracts)}
            x2={W - PAD.right} y2={toY(targetDist * mult * contracts)}
            stroke="#22c55e55" strokeWidth="1" strokeDasharray="4,4" />
          <text x={W - PAD.right + 2} y={toY(targetDist * mult * contracts) + 4}
            fontSize="9" fill="#22c55e88" fontFamily="monospace">TGT</text>
        </g>
      )}

      {/* MFE dot */}
      {mfePnl !== exitPnl && (
        <g>
          <circle cx={toX(mfeIdx)} cy={toY(mfePnl)} r="4"
            fill="#22c55e" stroke="#0d0f14" strokeWidth="1.5" />
          <text x={toX(mfeIdx)} y={toY(mfePnl) - 8}
            textAnchor="middle" fontSize="9" fill="#22c55e" fontFamily="monospace">
            {fmt(mfePnl)}
          </text>
        </g>
      )}

      {/* MAE dot */}
      {maePnl < -5 && (
        <g>
          <circle cx={toX(maeIdx)} cy={toY(maePnl)} r="4"
            fill="#ef4444" stroke="#0d0f14" strokeWidth="1.5" />
          <text x={toX(maeIdx)} y={toY(maePnl) + 16}
            textAnchor="middle" fontSize="9" fill="#ef4444" fontFamily="monospace">
            {fmt(maePnl)}
          </text>
        </g>
      )}

      {/* exit dot */}
      <circle cx={toX(pnlPath.length - 1)} cy={toY(exitPnl)} r="5"
        fill={isWin ? '#22c55e' : '#ef4444'} stroke="#0d0f14" strokeWidth="2" />

      {/* entry dot */}
      <circle cx={toX(0)} cy={zeroY} r="4"
        fill="#60a5fa" stroke="#0d0f14" strokeWidth="1.5" />
    </svg>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function TradeReviewChart({ trade }) {
  const tosData = useTOSTradeData(trade?.id);
  const {
    symbol, direction, entry, exit_price, stop, target,
    pnl, contracts, custom_multiplier, grade, exit_reason,
    al_strength, al_touches, al_age, sl_quality, sl_touches, sl_age,
  } = trade;

  const mult      = getMultiplier(symbol, custom_multiplier);
  const qty       = parseFloat(contracts) || 1;
  const entryP    = parseFloat(entry)      || 0;
  const exitP     = parseFloat(exit_price) || 0;
  const stopP     = parseFloat(stop)       || 0;
  const targetP   = parseFloat(target)     || 0;
  const isLong    = direction === 'long';

  const actualStop = tosData?.tos_stop || stopP;
  const stopDist   = actualStop ? Math.abs(entryP - actualStop) : 0;
  const targetDist = targetP ? Math.abs(targetP - entryP) : 0;
  const exitPnl    = parseFloat(pnl) || 0;

  // Use real TOS P&L points if available, otherwise estimate
  const tosPoints = tosData?.pnl_points?.length > 2 ? tosData.pnl_points : null;

  const path = useMemo(() => {
    if (!entryP || !exitP) return null;
    if (tosPoints) {
      // Convert real TOS checkpoints to a path array (in $)
      return tosPoints.map(p => p.pnl / (mult * qty));
    }
    return generatePath(entryP, exitP, stopP, targetP, direction);
  }, [entryP, exitP, stopP, targetP, direction, tosPoints, mult, qty]);

  if (!path) return null;

  const mfePnl = tosData?.mfe ?? Math.max(...path) * mult * qty;
  const maePnl = tosData?.mae ?? Math.min(...path) * mult * qty;
  const rr = stopDist > 0 ? (targetDist / stopDist).toFixed(2) : '—';
  const captured = targetDist > 0 ? Math.round((Math.abs(exitP - entryP) / targetDist) * 100) : null;

  const GRADE_COLORS = { aplus: '#22c55e', a: '#60a5fa', aminus: '#f59e0b' };
  const GRADE_LABELS = { aplus: 'A+', a: 'A', aminus: 'A-' };
  const gc = GRADE_COLORS[grade] || '#888';
  const gl = GRADE_LABELS[grade] || grade;

  const fmt   = (v) => v >= 0 ? `+$${Math.abs(Math.round(v))}` : `-$${Math.abs(Math.round(v))}`;
  const isWin = exitPnl >= 0;

  return (
    <div style={{
      background: '#0d0f14',
      border: `1px solid ${isWin ? '#22c55e22' : '#ef444422'}`,
      borderRadius: 10,
      overflow: 'hidden',
      marginBottom: 0,
    }}>

      {/* header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid #1a2030',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: '#111520',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            fontSize: 13, fontWeight: 700, color: '#e2e8f0',
            fontFamily: 'monospace',
          }}>
            {symbol} {direction.toUpperCase()}
          </span>
          <span style={{
            fontSize: 11, padding: '2px 8px', borderRadius: 4,
            background: gc + '22', color: gc, fontWeight: 700,
          }}>{gl}</span>
          <span style={{
            fontSize: 11, padding: '2px 8px', borderRadius: 4,
            background: isWin ? '#22c55e15' : '#ef444415',
            color: isWin ? '#22c55e' : '#ef4444', fontWeight: 700,
          }}>
            {exit_reason?.toUpperCase() || '—'}
          </span>
        </div>
        <span style={{
          fontSize: 17, fontWeight: 700, fontFamily: 'monospace',
          color: isWin ? '#22c55e' : '#ef4444',
        }}>
          {fmt(exitPnl)}
        </span>
      </div>

      {/* chart */}
      <div style={{ padding: '12px 16px 8px', background: '#0a0c10' }}>
        <div style={{ fontSize: 10, color: '#4a5568', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          Running P&L
          {tosData?.pnl_points?.length > 2 ? (
            <span style={{ color: '#22c55e', fontSize: 9 }}>● FROM TOS DATA</span>
          ) : (
            <span style={{ color: '#4a5568', fontSize: 9 }}>● ESTIMATED</span>
          )}
        </div>
        <PnLCurve
          path={path}
          mult={mult}
          contracts={qty}
          stopDist={stopDist}
          targetDist={targetDist}
          exitPnl={exitPnl}
          direction={direction}
        />
      </div>

      {/* stats row */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)',
        borderTop: '1px solid #1a2030',
        background: '#0d0f14',
      }}>
        {[
          { label: 'Entry',   value: entryP,                       mono: true },
          { label: 'Exit',    value: exitP,                        mono: true },
          { label: 'Stop',    value: stopP  || '—',                mono: true },
          { label: 'Target',  value: targetP || '—',               mono: true },
          { label: 'R:R',     value: rr + ':1',                    color: '#60a5fa' },
          { label: '% of TGT', value: captured !== null ? captured + '%' : '—',
            color: captured >= 90 ? '#22c55e' : captured >= 50 ? '#f59e0b' : '#ef4444' },
        ].map((s, i) => (
          <div key={i} style={{
            padding: '10px 0', textAlign: 'center',
            borderRight: i < 5 ? '1px solid #1a2030' : 'none',
          }}>
            <div style={{ fontSize: 10, color: '#4a5568', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
              {s.label}
            </div>
            <div style={{
              fontSize: 13, fontWeight: 600,
              color: s.color || '#94a3b8',
              fontFamily: s.mono ? 'monospace' : 'inherit',
            }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* MFE / MAE row */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
        borderTop: '1px solid #1a2030',
        background: '#080a0e',
      }}>
        {[
          { label: 'Best P&L Reached (MFE)', value: fmt(mfePnl), color: '#22c55e' },
          { label: 'Worst Drawdown (MAE)',    value: fmt(maePnl), color: '#ef4444' },
          { label: 'Left on Table',
            value: mfePnl > exitPnl ? fmt(-(mfePnl - exitPnl)) : '—',
            color: mfePnl > exitPnl ? '#f59e0b' : '#4a5568',
          },
        ].map((s, i) => (
          <div key={i} style={{
            padding: '10px 0', textAlign: 'center',
            borderRight: i < 2 ? '1px solid #1a2030' : 'none',
          }}>
            <div style={{ fontSize: 10, color: '#4a5568', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
              {s.label}
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: s.color, fontFamily: 'monospace' }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* AL / SL quality bar */}
      <div style={{
        display: 'flex', gap: 0,
        borderTop: '1px solid #1a2030',
        background: '#080a0e',
      }}>
        {[
          { label: 'Action Line', strength: al_strength, touches: al_touches, age: al_age },
          { label: 'Safety Line', strength: sl_quality,  touches: sl_touches, age: sl_age },
        ].map((line, i) => {
          const strong = line.strength === 'strong' && parseInt(line.touches) >= 3 && line.age === '1wk+';
          const c = strong ? '#22c55e' : '#f59e0b';
          return (
            <div key={i} style={{
              flex: 1, padding: '8px 16px',
              borderRight: i === 0 ? '1px solid #1a2030' : 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: 11, color: '#4a5568' }}>{line.label}</span>
              <span style={{
                fontSize: 11, fontWeight: 600, color: c,
                background: c + '18', padding: '2px 8px', borderRadius: 4,
              }}>
                {strong ? '★ Strong' : '~ Standard'} · {line.touches || '?'}t · {line.age || '—'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
