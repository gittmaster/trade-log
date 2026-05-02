import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from './supabase';
import { seedTrades } from './seedData';
import AIChat from './AIChat';
import Login from './Login';
import './App.css';

const GRADES = { aplus: 'A+', a: 'A', aminus: 'A-' };
const GRADE_COLORS = { aplus: '#1D9E75', a: '#185FA5', aminus: '#BA7517' };
const SESSIONS = ['Pre-open', 'Open', 'Mid-sess', 'Pre-mkt', 'Overnight', 'Late'];
const TIERS = ['Primary', 'Secondary', 'Tertiary'];
const TIER_COLORS = { Primary: '#1D9E75', Secondary: '#185FA5', Tertiary: '#E24B4A' };

function calcPnL(trade) {
  if (!trade.entry || !trade.exit_price) return null;
  const diff = trade.direction === 'long' ? trade.exit_price - trade.entry : trade.entry - trade.exit_price;
  const mult = trade.symbol === 'MGC' ? 10 : trade.symbol === 'MNQ' ? 2 : 100;
  return Math.round(diff * mult * 100) / 100;
}

function getSession(time) {
  if (!time) return 'Mid-sess';
  const h = parseInt(time.split(':')[0]);
  if (h >= 7 && h < 9) return 'Pre-open';
  if (h >= 9 && h < 11) return 'Open';
  if (h >= 11 && h < 15) return 'Mid-sess';
  if (h >= 15 && h < 19) return 'Late';
  if (h >= 19 && h < 23) return 'Pre-mkt';
  return 'Overnight';
}

function autoGrade(al_strength, al_touches, al_age, sl_quality, sl_touches, sl_age) {
  const alStrong = al_strength === 'strong' && parseInt(al_touches) >= 3 && al_age === '1wk+';
  const slStrong = sl_quality === 'strong' && parseInt(sl_touches) >= 3 && sl_age === '1wk+';
  if (alStrong && slStrong) return 'aplus';
  if (alStrong && !slStrong) return 'a';
  if (!alStrong && slStrong) return 'a';
  return 'aminus';
}

const EMPTY_FORM = {
  trade_number: '', date: new Date().toISOString().split('T')[0], time: '',
  account: 'A1', symbol: 'MGC', direction: 'long', entry: '', exit_price: '',
  stop: '', target: '', exit_reason: '', al_strength: 'standard',
  al_touches: '', al_age: '<1wk', al_tier: 'Primary',
  sl_quality: 'weak', sl_touches: '', sl_age: '<1wk', sl_tier: 'Primary',
  sl_price: '', grade: 'a', yellow_levels: '',
  confirmations: [], notes: '', chart_file: null
};

function StatCard({ label, value, color }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ color: color || 'inherit' }}>{value}</div>
    </div>
  );
}

function InsightCard({ title, data }) {
  return (
    <div className="insight-card">
      <div className="insight-title">{title}</div>
      {data.map((row, i) => (
        <div key={i} className="insight-row">
          <span className="insight-label">{row.label}</span>
          <span className="insight-value" style={{ color: row.wr >= 50 ? '#1D9E75' : '#E24B4A' }}>
            {row.wr}% · {row.net >= 0 ? '+' : ''}${row.net}
          </span>
        </div>
      ))}
      {data.length === 0 && <div className="insight-empty">No data</div>}
    </div>
  );
}

function TierInsightCard({ trades }) {
  const closed = trades.filter(t => t.pnl !== null);
  const tierData = (field) => TIERS.map(tier => {
    const ts = closed.filter(t => t[field] === tier);
    if (!ts.length) return null;
    const w = ts.filter(t => t.pnl > 0).length;
    return { label: tier, count: ts.length, wr: Math.round(w / ts.length * 100), net: Math.round(ts.reduce((s, t) => s + t.pnl, 0)), color: TIER_COLORS[tier] };
  }).filter(Boolean);

  const alData = tierData('al_tier');
  const slData = tierData('sl_tier');

  if (!alData.length && !slData.length) return (
    <div className="insight-card">
      <div className="insight-title">By Tier (AL / SL)</div>
      <div className="insight-empty">No tier data yet — start logging with tier selected</div>
    </div>
  );

  return (
    <div className="insight-card" style={{ gridColumn: 'span 2' }}>
      <div className="insight-title">By Tier (AL / SL)</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px' }}>
        <div>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Action Line</div>
          {alData.map((row, i) => (
            <div key={i} className="insight-row">
              <span className="insight-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: row.color, display: 'inline-block' }} />
                {row.label} <span style={{ color: '#555', fontSize: 11 }}>({row.count})</span>
              </span>
              <span className="insight-value" style={{ color: row.wr >= 50 ? '#1D9E75' : '#E24B4A' }}>{row.wr}% · {row.net >= 0 ? '+' : ''}${row.net}</span>
            </div>
          ))}
        </div>
        <div>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Safety Line</div>
          {slData.map((row, i) => (
            <div key={i} className="insight-row">
              <span className="insight-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: row.color, display: 'inline-block' }} />
                {row.label} <span style={{ color: '#555', fontSize: 11 }}>({row.count})</span>
              </span>
              <span className="insight-value" style={{ color: row.wr >= 50 ? '#1D9E75' : '#E24B4A' }}>{row.wr}% · {row.net >= 0 ? '+' : ''}${row.net}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Progress Chart ────────────────────────────────────────────────────────────
function ProgressChart({ trades }) {
  const pnlRef = useRef(null);
  const wrRef = useRef(null);
  const pnlChartRef = useRef(null);
  const wrChartRef = useRef(null);
  const [view, setView] = useState('weekly');
  const [chartReady, setChartReady] = useState(!!window.Chart);

  const closed = trades.filter(t => t.pnl !== null && t.date);

  const getWeeklyBuckets = () => {
    const map = {};
    closed.forEach(t => {
      const d = new Date(t.date + 'T12:00:00');
      const day = d.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      const mon = new Date(d);
      mon.setDate(d.getDate() + diff);
      const key = mon.toISOString().split('T')[0];
      if (!map[key]) map[key] = { pnl: 0, wins: 0, total: 0, label: mon.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) };
      map[key].pnl += t.pnl;
      map[key].total += 1;
      if (t.pnl > 0) map[key].wins += 1;
    });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => v);
  };

  const getMonthlyBuckets = () => {
    const map = {};
    closed.forEach(t => {
      const key = t.date.slice(0, 7);
      if (!map[key]) {
        const [y, m] = key.split('-');
        map[key] = { pnl: 0, wins: 0, total: 0, label: new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }) };
      }
      map[key].pnl += t.pnl;
      map[key].total += 1;
      if (t.pnl > 0) map[key].wins += 1;
    });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => v);
  };

  useEffect(() => {
    if (window.Chart) { setChartReady(true); return; }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js';
    script.onload = () => setChartReady(true);
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!chartReady || !pnlRef.current || !wrRef.current) return;
    const Chart = window.Chart;
    const buckets = view === 'weekly' ? getWeeklyBuckets() : getMonthlyBuckets();
    if (!buckets.length) return;

    const labels = buckets.map(b => b.label);
    const pnls = buckets.map(b => Math.round(b.pnl));
    const wrs = buckets.map(b => b.total ? Math.round(b.wins / b.total * 100) : 0);
    const barColors = pnls.map(v => v >= 0 ? '#1D9E75' : '#E24B4A');
    const barBorders = pnls.map(v => v >= 0 ? '#0F6E56' : '#A32D2D');

    if (pnlChartRef.current) { pnlChartRef.current.destroy(); pnlChartRef.current = null; }
    if (wrChartRef.current) { wrChartRef.current.destroy(); wrChartRef.current = null; }

    pnlChartRef.current = new Chart(pnlRef.current, {
      type: 'bar',
      data: {
        labels,
        datasets: [{ label: 'P&L', data: pnls, backgroundColor: barColors, borderColor: barBorders, borderWidth: 1, borderRadius: 4 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: ctx => {
                const i = ctx[0].dataIndex;
                const b = buckets[i];
                const wr = b.total ? Math.round(b.wins / b.total * 100) : 0;
                return `${b.label}  ·  ${b.total} trade${b.total !== 1 ? 's' : ''}  ·  ${wr}% WR`;
              },
              label: ctx => {
                const v = ctx.raw;
                const i = ctx.dataIndex;
                const b = buckets[i];
                return [`P&L: ${(v >= 0 ? '+$' : '-$') + Math.abs(v).toLocaleString()}`, `Wins: ${b.wins}   Losses: ${b.total - b.wins}`];
              }
            }
          }
        },
        scales: {
          x: { ticks: { autoSkip: false, maxRotation: 45, color: '#888', font: { size: 11 } }, grid: { display: false } },
          y: { grid: { color: 'rgba(128,128,128,0.12)' }, ticks: { color: '#888', font: { size: 11 }, callback: v => (v >= 0 ? '+$' : '-$') + Math.abs(v).toLocaleString() } }
        }
      }
    });

    wrChartRef.current = new Chart(wrRef.current, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Win Rate', data: wrs, borderColor: '#185FA5', backgroundColor: 'rgba(24,95,165,0.08)',
          pointBackgroundColor: wrs.map(w => w >= 50 ? '#1D9E75' : '#E24B4A'),
          pointRadius: 5, pointHoverRadius: 7, fill: true, tension: 0.3
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: {
          title: ctx => {
            const i = ctx[0].dataIndex;
            const b = buckets[i];
            return `${b.label}  ·  ${b.total} trade${b.total !== 1 ? 's' : ''}`;
          },
          label: ctx => `Win Rate: ${ctx.raw}%  (${buckets[ctx.dataIndex].wins}W / ${buckets[ctx.dataIndex].total - buckets[ctx.dataIndex].wins}L)`
        } } },
        scales: {
          x: { ticks: { autoSkip: false, maxRotation: 45, color: '#888', font: { size: 11 } }, grid: { display: false } },
          y: { min: 0, max: 100, ticks: { color: '#888', font: { size: 11 }, callback: v => v + '%' }, grid: { color: 'rgba(128,128,128,0.12)' } }
        }
      }
    });

    return () => {
      if (pnlChartRef.current) { pnlChartRef.current.destroy(); pnlChartRef.current = null; }
      if (wrChartRef.current) { wrChartRef.current.destroy(); wrChartRef.current = null; }
    };
  }, [chartReady, trades, view]);

  const buckets = view === 'weekly' ? getWeeklyBuckets() : getMonthlyBuckets();
  const totalNet = Math.round(buckets.reduce((s, b) => s + b.pnl, 0));
  const totalTrades = buckets.reduce((s, b) => s + b.total, 0);
  const totalWins = buckets.reduce((s, b) => s + b.wins, 0);
  const overallWR = totalTrades ? Math.round(totalWins / totalTrades * 100) : 0;
  const bestBucket = buckets.length ? buckets.reduce((a, b) => b.pnl > a.pnl ? b : a) : null;
  const worstBucket = buckets.length ? buckets.reduce((a, b) => b.pnl < a.pnl ? b : a) : null;

  if (!closed.length) return null;

  return (
    <div className="table-card" style={{ marginBottom: 24 }}>
      <div className="table-header" style={{ marginBottom: 16 }}>
        <h2>Progress</h2>
        <div style={{ display: 'flex', gap: 6 }}>
          {['weekly', 'monthly'].map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: '4px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer',
              border: '1px solid', borderColor: view === v ? '#185FA5' : '#2a2a2a',
              background: view === v ? '#185FA522' : 'transparent', color: view === v ? '#185FA5' : '#888',
            }}>
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: 'Net P&L', value: (totalNet >= 0 ? '+$' : '-$') + Math.abs(totalNet).toLocaleString(), color: totalNet >= 0 ? '#1D9E75' : '#E24B4A' },
          { label: 'Win Rate', value: overallWR + '%', color: overallWR >= 50 ? '#1D9E75' : '#E24B4A' },
          { label: 'Trades', value: `${totalTrades} (${totalWins}W / ${totalTrades - totalWins}L)` },
          { label: 'Best ' + (view === 'weekly' ? 'Week' : 'Month'), value: bestBucket ? `${bestBucket.label} (${bestBucket.total}t)` : '—', color: '#1D9E75' },
          { label: 'Worst ' + (view === 'weekly' ? 'Week' : 'Month'), value: worstBucket ? `${worstBucket.label} (${worstBucket.total}t)` : '—', color: '#E24B4A' },
        ].map((c, i) => (
          <div key={i} style={{ background: '#111', borderRadius: 8, padding: '8px 14px', minWidth: 90 }}>
            <div style={{ fontSize: 11, color: '#666', marginBottom: 3 }}>{c.label}</div>
            <div style={{ fontSize: 15, fontWeight: 500, color: c.color || '#ccc' }}>{c.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 10, fontSize: 12, color: '#888' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: '#1D9E75', display: 'inline-block' }} /> Profitable
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: '#E24B4A', display: 'inline-block' }} /> Down
        </span>
      </div>

      <div style={{ fontSize: 11, color: '#666', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        P&L per {view === 'weekly' ? 'week' : 'month'}
      </div>
      <div style={{ position: 'relative', width: '100%', height: 260, marginBottom: 28 }}>
        <canvas ref={pnlRef} role="img" aria-label={`Bar chart showing P&L by ${view}`} />
      </div>

      <div style={{ fontSize: 11, color: '#666', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Win rate per {view === 'weekly' ? 'week' : 'month'}
      </div>
      <div style={{ position: 'relative', width: '100%', height: 180 }}>
        <canvas ref={wrRef} role="img" aria-label={`Line chart showing win rate by ${view}`} />
      </div>
    </div>
  );
}

function ChartModal({ url, onClose }) {
  if (!url) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header"><span className="modal-title">Trade Chart</span><button className="modal-close" onClick={onClose}>×</button></div>
        <img src={url} alt="Trade chart" className="modal-img" />
      </div>
    </div>
  );
}

function TertiaryWarning({ alTier, slTier }) {
  const alTertiary = alTier === 'Tertiary';
  const slTertiary = slTier === 'Tertiary';
  if (!alTertiary && !slTertiary) return null;
  const parts = [];
  if (alTertiary) parts.push('Action Line');
  if (slTertiary) parts.push('Safety Line');
  return (
    <div style={{ background: '#E24B4A18', border: '1.5px solid #E24B4A55', borderRadius: 8, padding: '10px 14px', marginBottom: 12, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <span style={{ fontSize: 18, lineHeight: 1 }}>⚠️</span>
      <div>
        <div style={{ color: '#E24B4A', fontWeight: 600, fontSize: 13 }}>Tertiary {parts.join(' & ')} — Low Reliability</div>
        <div style={{ color: '#aaa', fontSize: 12, marginTop: 2 }}>Your April data: Tertiary SL trades cost –$460. Consider skipping or requiring stronger confluence before taking this setup.</div>
      </div>
    </div>
  );
}

function TradeForm({ form, setForm, onSubmit, onCancel, uploading, isEdit }) {
  const confOptions = ['AL crossed', 'Yellow S/R cleared', 'SL identified', 'Open space'];
  const confs = Array.isArray(form.confirmations) ? form.confirmations : (form.confirmations || '').split(',').filter(Boolean);
  const toggleConf = (c) => {
    const current = Array.isArray(form.confirmations) ? form.confirmations : (form.confirmations || '').split(',').filter(Boolean);
    setForm(f => ({ ...f, confirmations: current.includes(c) ? current.filter(x => x !== c) : [...current, c] }));
  };

  return (
    <div className="form-card">
      <h2>{isEdit ? 'Edit Trade' : 'Log New Trade'}</h2>
      <div className="form-grid-3">
        <div className="field"><label>Trade #</label><input type="number" value={form.trade_number || ''} onChange={e => setForm(f => ({ ...f, trade_number: e.target.value }))} /></div>
        <div className="field"><label>Date</label><input type="date" value={form.date || ''} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
        <div className="field"><label>Time (EST)</label><input type="time" value={form.time || ''} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} /></div>
      </div>
      <div className="form-grid-3">
        <div className="field"><label>Account</label>
          <div className="toggle-row">{['A1', 'A2'].map(a => <button key={a} className={`tog ${form.account === a ? 'tog-blue' : ''}`} onClick={() => setForm(f => ({ ...f, account: a }))}>{a}</button>)}</div>
        </div>
        <div className="field"><label>Symbol</label>
          <div className="toggle-row">{['MGC', 'MNQ'].map(s => <button key={s} className={`tog ${form.symbol === s ? 'tog-blue' : ''}`} onClick={() => setForm(f => ({ ...f, symbol: s }))}>{s}</button>)}</div>
        </div>
        <div className="field"><label>Direction</label>
          <div className="toggle-row">
            <button className={`tog ${form.direction === 'long' ? 'tog-green' : ''}`} onClick={() => setForm(f => ({ ...f, direction: 'long' }))}>Long</button>
            <button className={`tog ${form.direction === 'short' ? 'tog-red' : ''}`} onClick={() => setForm(f => ({ ...f, direction: 'short' }))}>Short</button>
          </div>
        </div>
      </div>
      <div className="form-grid-4">
        <div className="field"><label>Entry</label><input type="number" step="0.01" value={form.entry || ''} onChange={e => setForm(f => ({ ...f, entry: e.target.value }))} /></div>
        <div className="field"><label>Exit</label><input type="number" step="0.01" value={form.exit_price || ''} onChange={e => setForm(f => ({ ...f, exit_price: e.target.value }))} /></div>
        <div className="field"><label>Stop</label><input type="number" step="0.01" value={form.stop || ''} onChange={e => setForm(f => ({ ...f, stop: e.target.value }))} /></div>
        <div className="field"><label>Target</label><input type="number" step="0.01" value={form.target || ''} onChange={e => setForm(f => ({ ...f, target: e.target.value }))} /></div>
      </div>
      <div className="form-grid-2">
        <div className="field"><label>Exit Reason</label>
          <div className="toggle-row">{['target', 'stop', 'manual', 'open'].map(r => <button key={r} className={`tog ${form.exit_reason === r ? 'tog-blue' : ''}`} onClick={() => setForm(f => ({ ...f, exit_reason: r }))}>{r}</button>)}</div>
        </div>
        <div className="field">
          <label>Grade <span style={{ fontSize: 11, color: '#888', fontWeight: 400 }}>(auto-calculated)</span></label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
            <span className="grade-badge" style={{ background: GRADE_COLORS[form.grade] + '33', color: GRADE_COLORS[form.grade], fontSize: 18, fontWeight: 700, padding: '6px 18px', borderRadius: 8, border: '1.5px solid ' + GRADE_COLORS[form.grade] }}>
              {GRADES[form.grade] || form.grade}
            </span>
            <span style={{ fontSize: 12, color: '#888' }}>{form.grade === 'aplus' ? '~80% win rate' : form.grade === 'a' ? '~55% win rate' : '~40% win rate'}</span>
          </div>
        </div>
      </div>

      <TertiaryWarning alTier={form.al_tier} slTier={form.sl_tier} />

      <div style={{ background: '#111', border: '1px solid #222', borderRadius: 8, padding: '12px 14px', marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Action Line</div>
        <div className="form-grid-3">
          <div className="field"><label>Strength</label>
            <div className="toggle-row">
              <button className={`tog ${form.al_strength === 'strong' ? 'tog-green' : ''}`} onClick={() => setForm(f => { const u = { ...f, al_strength: 'strong' }; return { ...u, grade: autoGrade('strong', u.al_touches, u.al_age, u.sl_quality, u.sl_touches, u.sl_age) }; })}>★ Strong</button>
              <button className={`tog ${form.al_strength === 'standard' ? 'tog-blue' : ''}`} onClick={() => setForm(f => { const u = { ...f, al_strength: 'standard' }; return { ...u, grade: autoGrade('standard', u.al_touches, u.al_age, u.sl_quality, u.sl_touches, u.sl_age) }; })}>Standard</button>
            </div>
          </div>
          <div className="field"><label>Touches</label><input type="number" value={form.al_touches || ''} onChange={e => setForm(f => { const u = { ...f, al_touches: e.target.value }; return { ...u, grade: autoGrade(u.al_strength, u.al_touches, u.al_age, u.sl_quality, u.sl_touches, u.sl_age) }; })} /></div>
          <div className="field"><label>Age</label>
            <div className="toggle-row">{['<1day', '<1wk', '1wk+'].map(a => <button key={a} className={`tog ${form.al_age === a ? 'tog-blue' : ''}`} onClick={() => setForm(f => { const u = { ...f, al_age: a }; return { ...u, grade: autoGrade(u.al_strength, u.al_touches, a, u.sl_quality, u.sl_touches, u.sl_age) }; })}>{a}</button>)}</div>
          </div>
        </div>
        <div className="field" style={{ marginBottom: 0 }}><label>AL Tier</label>
          <div className="toggle-row">
            {TIERS.map(tier => (
              <button key={tier} className="tog" style={form.al_tier === tier ? { background: TIER_COLORS[tier] + '33', color: TIER_COLORS[tier], borderColor: TIER_COLORS[tier] } : {}} onClick={() => setForm(f => ({ ...f, al_tier: tier }))}>{tier}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ background: '#111', border: '1px solid #222', borderRadius: 8, padding: '12px 14px', marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Safety Line</div>
        <div className="form-grid-3">
          <div className="field"><label>Quality</label>
            <div className="toggle-row">
              <button className={`tog ${form.sl_quality === 'strong' ? 'tog-green' : ''}`} onClick={() => setForm(f => { const u = { ...f, sl_quality: 'strong' }; return { ...u, grade: autoGrade(u.al_strength, u.al_touches, u.al_age, 'strong', u.sl_touches, u.sl_age) }; })}>★ Strong</button>
              <button className={`tog ${form.sl_quality === 'weak' ? 'tog-red' : ''}`} onClick={() => setForm(f => { const u = { ...f, sl_quality: 'weak' }; return { ...u, grade: autoGrade(u.al_strength, u.al_touches, u.al_age, 'weak', u.sl_touches, u.sl_age) }; })}>Weak</button>
            </div>
          </div>
          <div className="field"><label>Touches</label><input type="number" value={form.sl_touches || ''} onChange={e => setForm(f => { const u = { ...f, sl_touches: e.target.value }; return { ...u, grade: autoGrade(u.al_strength, u.al_touches, u.al_age, u.sl_quality, u.sl_touches, u.sl_age) }; })} /></div>
          <div className="field"><label>Age</label>
            <div className="toggle-row">{['<1day', '<1wk', '1wk+'].map(a => <button key={a} className={`tog ${form.sl_age === a ? 'tog-blue' : ''}`} onClick={() => setForm(f => { const u = { ...f, sl_age: a }; return { ...u, grade: autoGrade(u.al_strength, u.al_touches, u.al_age, u.sl_quality, u.sl_touches, a) }; })}>{a}</button>)}</div>
          </div>
        </div>
        <div className="form-grid-2" style={{ marginTop: 8, marginBottom: 0 }}>
          <div className="field" style={{ marginBottom: 0 }}><label>SL Tier</label>
            <div className="toggle-row">
              {TIERS.map(tier => (
                <button key={tier} className="tog" style={form.sl_tier === tier ? { background: TIER_COLORS[tier] + '33', color: TIER_COLORS[tier], borderColor: TIER_COLORS[tier] } : {}} onClick={() => setForm(f => ({ ...f, sl_tier: tier }))}>{tier}</button>
              ))}
            </div>
          </div>
          <div className="field" style={{ marginBottom: 0 }}><label>SL Price</label><input type="number" step="0.01" value={form.sl_price || ''} onChange={e => setForm(f => ({ ...f, sl_price: e.target.value }))} /></div>
        </div>
      </div>

      <div className="form-grid-2">
        <div className="field"><label>Yellow Levels</label><input type="text" placeholder="e.g. 4650/4586/4420" value={form.yellow_levels || ''} onChange={e => setForm(f => ({ ...f, yellow_levels: e.target.value }))} /></div>
      </div>
      <div className="field"><label>Confirmations</label>
        <div className="toggle-row">{confOptions.map(c => <button key={c} className={`tog ${confs.includes(c) ? 'tog-green' : ''}`} onClick={() => toggleConf(c)}>{c}</button>)}</div>
      </div>
      <div className="field"><label>Notes</label><textarea value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
      <div className="field">
        <label>Chart Image&nbsp;{isEdit && form.chart_url && (<a href={form.chart_url} target="_blank" rel="noreferrer" className="chart-link">(view current chart)</a>)}</label>
        <input type="file" accept="image/*" onChange={e => setForm(f => ({ ...f, chart_file: e.target.files[0] }))} />
      </div>
      <div className="form-actions">
        <button className="btn-cancel" onClick={onCancel}>Cancel</button>
        <button className="btn-submit" onClick={onSubmit} disabled={uploading}>{uploading ? 'Saving...' : isEdit ? 'Save Changes' : 'Log Trade'}</button>
      </div>
    </div>
  );
}

// ─── Manage Levels + Pre-Trade Checklist ──────────────────────────────────────
const DEFAULT_LEVELS = [
  { id: 1, name: 'W($4900)', price: 4900, symbol: 'MGC' },
  { id: 2, name: '4($4642.1)', price: 4642.1, symbol: 'MGC' },
  { id: 3, name: 'W($4600)', price: 4600, symbol: 'MGC' },
  { id: 4, name: 'M($4600)', price: 4600, symbol: 'MGC' },
  { id: 5, name: 'M($4400)', price: 4400, symbol: 'MGC' },
];

function ManageLevels() {
  const storageKey = 'tl_key_levels';
  const [levels, setLevels] = useState(() => {
    try { const s = localStorage.getItem(storageKey); return s ? JSON.parse(s) : DEFAULT_LEVELS; } catch { return DEFAULT_LEVELS; }
  });
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newSymbol, setNewSymbol] = useState('MGC');
  const [editId, setEditId] = useState(null);
  const [editPrice, setEditPrice] = useState('');
  const [open, setOpen] = useState(false);

  // Pre-trade checklist state
  const [ptSymbol, setPtSymbol] = useState('MGC');
  const [ptDirection, setPtDirection] = useState('short');
  const [ptEntry, setPtEntry] = useState('');
  const [ptStop, setPtStop] = useState('');
  const [ptTarget, setPtTarget] = useState('');
  const [ptResult, setPtResult] = useState(null);

  const save = (updated) => {
    setLevels(updated);
    try { localStorage.setItem(storageKey, JSON.stringify(updated)); } catch {}
  };

  const addLevel = () => {
    if (!newName || !newPrice) return;
    const updated = [...levels, { id: Date.now(), name: newName, price: parseFloat(newPrice), symbol: newSymbol }];
    save(updated);
    setNewName(''); setNewPrice('');
  };

  const deleteLevel = (id) => save(levels.filter(l => l.id !== id));

  const startEdit = (l) => { setEditId(l.id); setEditPrice(String(l.price)); };
  const saveEdit = (id) => {
    save(levels.map(l => l.id === id ? { ...l, price: parseFloat(editPrice) } : l));
    setEditId(null); setEditPrice('');
  };

  const checkTrade = () => {
    const entry = parseFloat(ptEntry);
    const stop = parseFloat(ptStop);
    const target = parseFloat(ptTarget);
    if (!entry || !stop || !target) return;

    const mult = ptSymbol === 'MGC' ? 10 : 2;
    const isShort = ptDirection === 'short';

    const stopDist = isShort ? stop - entry : entry - stop;
    const targetDist = isShort ? entry - target : target - entry;
    const rr = stopDist > 0 ? Math.round((targetDist / stopDist) * 100) / 100 : 0;
    const maxGain = Math.round(targetDist * mult);
    const maxLoss = Math.round(stopDist * mult);

    // Find nearest level to target
    const symLevels = levels.filter(l => l.symbol === ptSymbol);
    let nearest = null;
    let nearestDist = Infinity;
    symLevels.forEach(l => {
      const d = Math.abs(l.price - target);
      if (d < nearestDist) { nearestDist = d; nearest = l; }
    });

    const warnings = [];
    if (rr > 2.5) warnings.push(`R:R is ${rr} — above 2.5, target may be too wide`);
    if (nearestDist > 20) warnings.push(`Target is ${Math.round(nearestDist)} pts from nearest level (${nearest ? nearest.name : 'none'}) — not sitting at a key level`);
    if (stopDist <= 0) warnings.push('Stop is on wrong side of entry');
    if (targetDist <= 0) warnings.push('Target is on wrong side of entry');

    setPtResult({ rr, maxGain, maxLoss, nearest, nearestDist: Math.round(nearestDist), warnings, stopDist: Math.round(stopDist), targetDist: Math.round(targetDist) });
  };

  const symLevels = levels.filter(l => l.symbol === ptSymbol).sort((a, b) => b.price - a.price);
  const otherLevels = levels.filter(l => l.symbol !== ptSymbol).sort((a, b) => b.price - a.price);

  return (
    <div style={{ marginBottom: 24 }}>
      <div onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#111', border: '1px solid #222', borderRadius: open ? '8px 8px 0 0' : 8, padding: '10px 16px', cursor: 'pointer', userSelect: 'none' }}>
        <span style={{ fontWeight: 600, fontSize: 14, color: '#ccc' }}>📐 Key Levels & Pre-Trade Check</span>
        <span style={{ color: '#888', fontSize: 14 }}>{open ? '▲ Hide' : '▼ Show'}</span>
      </div>
      {open && <div style={{ border: '1px solid #222', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

      {/* Key Levels Manager */}
      <div className="table-card" style={{ marginBottom: 0 }}>
        <div className="table-header" style={{ marginBottom: 16 }}>
          <h2>Key Levels</h2>
        </div>

        {/* Add new level */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 70px auto', gap: 8, marginBottom: 16 }}>
          <input placeholder="Name (e.g. W$4900)" value={newName} onChange={e => setNewName(e.target.value)}
            style={{ background: '#111', border: '1px solid #2a2a2a', borderRadius: 6, padding: '6px 10px', color: '#ccc', fontSize: 13 }} />
          <input placeholder="Price" type="number" step="0.1" value={newPrice} onChange={e => setNewPrice(e.target.value)}
            style={{ background: '#111', border: '1px solid #2a2a2a', borderRadius: 6, padding: '6px 10px', color: '#ccc', fontSize: 13 }} />
          <select value={newSymbol} onChange={e => setNewSymbol(e.target.value)}
            style={{ background: '#111', border: '1px solid #2a2a2a', borderRadius: 6, padding: '6px 8px', color: '#ccc', fontSize: 13 }}>
            <option>MGC</option><option>MNQ</option>
          </select>
          <button onClick={addLevel} style={{ background: '#185FA5', border: 'none', borderRadius: 6, padding: '6px 14px', color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>+ Add</button>
        </div>

        {/* MGC levels */}
        {['MGC', 'MNQ'].map(sym => {
          const sLevels = levels.filter(l => l.symbol === sym).sort((a, b) => b.price - a.price);
          if (!sLevels.length) return null;
          return (
            <div key={sym} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{sym}</div>
              {sLevels.map(l => (
                <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, background: '#111', borderRadius: 6, padding: '6px 10px' }}>
                  <span style={{ flex: 1, fontSize: 13, color: '#ccc' }}>{l.name}</span>
                  {editId === l.id ? (
                    <>
                      <input type="number" step="0.1" value={editPrice} onChange={e => setEditPrice(e.target.value)}
                        style={{ width: 80, background: '#1a1a1a', border: '1px solid #185FA5', borderRadius: 4, padding: '3px 6px', color: '#ccc', fontSize: 12 }} />
                      <button onClick={() => saveEdit(l.id)} style={{ background: '#1D9E75', border: 'none', borderRadius: 4, padding: '3px 10px', color: '#fff', fontSize: 12, cursor: 'pointer' }}>Save</button>
                      <button onClick={() => setEditId(null)} style={{ background: '#333', border: 'none', borderRadius: 4, padding: '3px 8px', color: '#888', fontSize: 12, cursor: 'pointer' }}>×</button>
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize: 13, color: '#1D9E75', fontWeight: 500, minWidth: 60, textAlign: 'right' }}>{l.price}</span>
                      <button onClick={() => startEdit(l)} style={{ background: '#222', border: 'none', borderRadius: 4, padding: '3px 8px', color: '#888', fontSize: 11, cursor: 'pointer' }}>Edit</button>
                      <button onClick={() => deleteLevel(l.id)} style={{ background: 'none', border: 'none', color: '#E24B4A', fontSize: 14, cursor: 'pointer', padding: '0 4px' }}>×</button>
                    </>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Pre-Trade Checklist */}
      <div className="table-card" style={{ marginBottom: 0 }}>
        <div className="table-header" style={{ marginBottom: 16 }}>
          <h2>Pre-Trade Check</h2>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {['MGC', 'MNQ'].map(s => (
            <button key={s} onClick={() => { setPtSymbol(s); setPtResult(null); }}
              style={{ padding: '5px 16px', borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: '1px solid', borderColor: ptSymbol === s ? '#185FA5' : '#2a2a2a', background: ptSymbol === s ? '#185FA522' : 'transparent', color: ptSymbol === s ? '#185FA5' : '#888' }}>{s}</button>
          ))}
          {['short', 'long'].map(d => (
            <button key={d} onClick={() => { setPtDirection(d); setPtResult(null); }}
              style={{ padding: '5px 16px', borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: '1px solid', borderColor: ptDirection === d ? (d === 'short' ? '#E24B4A' : '#1D9E75') : '#2a2a2a', background: ptDirection === d ? (d === 'short' ? '#E24B4A22' : '#1D9E7522') : 'transparent', color: ptDirection === d ? (d === 'short' ? '#E24B4A' : '#1D9E75') : '#888' }}>{d.charAt(0).toUpperCase() + d.slice(1)}</button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
          {[['Entry', ptEntry, setPtEntry], ['Stop', ptStop, setPtStop], ['Target', ptTarget, setPtTarget]].map(([label, val, setter]) => (
            <div key={label} className="field" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: 11 }}>{label}</label>
              <input type="number" step="0.1" value={val} onChange={e => { setter(e.target.value); setPtResult(null); }}
                style={{ width: '100%', background: '#111', border: '1px solid #2a2a2a', borderRadius: 6, padding: '6px 10px', color: '#ccc', fontSize: 13 }} />
            </div>
          ))}
        </div>

        <button onClick={checkTrade} style={{ width: '100%', background: '#185FA5', border: 'none', borderRadius: 8, padding: '10px', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: 16 }}>
          Check Setup
        </button>

        {ptResult && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* R:R and stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {[
                { label: 'R:R', value: ptResult.rr + ':1', color: ptResult.rr > 2.5 ? '#E24B4A' : '#1D9E75' },
                { label: 'Max Gain', value: '+$' + ptResult.maxGain, color: '#1D9E75' },
                { label: 'Max Loss', value: '-$' + ptResult.maxLoss, color: '#E24B4A' },
              ].map((c, i) => (
                <div key={i} style={{ background: '#111', borderRadius: 8, padding: '8px 12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: '#666', marginBottom: 3 }}>{c.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: c.color }}>{c.value}</div>
                </div>
              ))}
            </div>

            {/* Nearest level */}
            <div style={{ background: '#111', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>Nearest Key Level to Target</div>
              {ptResult.nearest ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#ccc', fontWeight: 500 }}>{ptResult.nearest.name} @ {ptResult.nearest.price}</span>
                  <span style={{ fontSize: 12, color: ptResult.nearestDist <= 10 ? '#1D9E75' : ptResult.nearestDist <= 20 ? '#BA7517' : '#E24B4A' }}>
                    {ptResult.nearestDist} pts away {ptResult.nearestDist <= 10 ? '✅' : ptResult.nearestDist <= 20 ? '⚠️' : '❌'}
                  </span>
                </div>
              ) : <span style={{ color: '#666' }}>No levels saved for {ptSymbol}</span>}
            </div>

            {/* Warnings */}
            {ptResult.warnings.length > 0 ? (
              <div style={{ background: '#E24B4A12', border: '1px solid #E24B4A44', borderRadius: 8, padding: '10px 12px' }}>
                {ptResult.warnings.map((w, i) => (
                  <div key={i} style={{ color: '#E24B4A', fontSize: 13, marginBottom: i < ptResult.warnings.length - 1 ? 4 : 0 }}>⚠️ {w}</div>
                ))}
              </div>
            ) : (
              <div style={{ background: '#1D9E7512', border: '1px solid #1D9E7544', borderRadius: 8, padding: '10px 12px', color: '#1D9E75', fontSize: 13 }}>
                ✅ Setup looks clean — R:R is within range and target is near a key level
              </div>
            )}
          </div>
        )}
      </div>
    </div>
    </div>}
    </div>
  );
}

export default function App() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('tl_auth') === '1');
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editingTrade, setEditingTrade] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState('');
  const [chartModal, setChartModal] = useState(null);
  const [sortCol, setSortCol] = useState('date');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
    setPage(1);
  };

  const nextTradeNumber = () => {
    if (!trades.length) return 1;
    const nums = trades.map(t => t.trade_number).filter(Boolean);
    return nums.length ? Math.max(...nums) + 1 : trades.length + 1;
  };

  const loadTrades = useCallback(async () => {
    const { data, error } = await supabase.from('trades').select('*').order('date', { ascending: false }).order('time', { ascending: false });
    if (!error) setTrades(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadTrades(); }, [loadTrades]);

  const exportCSV = () => {
    if (!trades.length) { alert('No trades to export'); return; }
    const headers = ['trade_number','date','time','account','symbol','direction','entry','exit_price','stop','target','exit_reason','al_strength','al_touches','al_age','al_tier','sl_quality','sl_touches','sl_age','sl_tier','sl_price','grade','session','yellow_levels','confirmations','notes','pnl'];
    const rows = trades.map(t => headers.map(h => {
      const v = t[h];
      if (v === null || v === undefined) return '';
      if (typeof v === 'string' && v.includes(',')) return '"' + v.replace(/"/g, '""') + '"';
      return v;
    }).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'trades_' + new Date().toISOString().split('T')[0] + '.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const seedDatabase = async () => {
    setSeeding(true); setMsg('Seeding 61 trades...');
    const { error } = await supabase.from('trades').insert(seedTrades);
    if (error) { setMsg('Error: ' + error.message); } else { setMsg('61 trades loaded!'); await loadTrades(); }
    setSeeding(false); setTimeout(() => setMsg(''), 3000);
  };

  const buildTradePayload = async (form, existingChartUrl = null) => {
    let chart_url = existingChartUrl;
    if (form.chart_file) {
      const file = form.chart_file;
      const path = `charts/trade-${form.trade_number}-${Date.now()}.${file.name.split('.').pop()}`;
      const { error: upErr } = await supabase.storage.from('trade-charts').upload(path, file);
      if (!upErr) { const { data: urlData } = supabase.storage.from('trade-charts').getPublicUrl(path); chart_url = urlData.publicUrl; }
    }
    const pnl = calcPnL({ ...form, exit_price: parseFloat(form.exit_price), entry: parseFloat(form.entry) });
    const session = getSession(form.time);
    const confs = Array.isArray(form.confirmations) ? form.confirmations.join(',') : (form.confirmations || '');
    const trade = {
      ...form,
      entry: form.entry ? parseFloat(form.entry) : null,
      exit_price: form.exit_price ? parseFloat(form.exit_price) : null,
      stop: form.stop ? parseFloat(form.stop) : null,
      target: form.target ? parseFloat(form.target) : null,
      sl_price: form.sl_price ? parseFloat(form.sl_price) : null,
      trade_number: form.trade_number ? parseInt(form.trade_number) : null,
      al_touches: form.al_touches ? parseInt(form.al_touches) : null,
      sl_touches: form.sl_touches ? parseInt(form.sl_touches) : null,
      al_tier: form.al_tier || 'Primary', sl_tier: form.sl_tier || 'Primary',
      confirmations: confs, session, chart_url, pnl
    };
    delete trade.chart_file;
    return trade;
  };

  const submitTrade = async () => {
    setUploading(true);
    const trade = await buildTradePayload(form);
    const { error } = await supabase.from('trades').insert([trade]);
    if (error) { setMsg('Error: ' + error.message); } else { setMsg('Trade logged!'); setShowForm(false); setForm({ ...EMPTY_FORM }); await loadTrades(); }
    setUploading(false); setTimeout(() => setMsg(''), 3000);
  };

  const updateTrade = async () => {
    setUploading(true);
    const trade = await buildTradePayload(form, form.chart_url);
    const { id, created_at, ...rest } = trade;
    const { error } = await supabase.from('trades').update(rest).eq('id', editingTrade.id);
    if (error) { setMsg('Error: ' + error.message); } else { setMsg('Trade updated!'); setEditingTrade(null); setShowForm(false); setForm({ ...EMPTY_FORM }); await loadTrades(); }
    setUploading(false); setTimeout(() => setMsg(''), 3000);
  };

  const startEdit = (trade) => {
    const confs = typeof trade.confirmations === 'string' ? trade.confirmations.split(',').filter(Boolean) : (trade.confirmations || []);
    setForm({ ...trade, confirmations: confs, chart_file: null, al_tier: trade.al_tier || 'Primary', sl_tier: trade.sl_tier || 'Primary' });
    setEditingTrade(trade); setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelForm = () => { setShowForm(false); setEditingTrade(null); setForm({ ...EMPTY_FORM }); };
  const openNewTradeForm = () => { cancelForm(); setForm({ ...EMPTY_FORM, trade_number: nextTradeNumber() }); setShowForm(true); };
  const deleteTrade = async (id) => { if (!window.confirm('Delete this trade?')) return; await supabase.from('trades').delete().eq('id', id); await loadTrades(); };

  const getWeekRange = () => {
    const now = new Date(); const day = now.getDay(); const diffToMon = day === 0 ? -6 : 1 - day;
    const monday = new Date(now); monday.setDate(now.getDate() + diffToMon); monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6); sunday.setHours(23, 59, 59, 999);
    return { monday, sunday };
  };

  const filteredTrades = () => {
    if (activeFilter === 'all') return trades;
    if (activeFilter === 'win') return trades.filter(t => t.pnl > 0);
    if (activeFilter === 'loss') return trades.filter(t => t.pnl < 0);
    if (activeFilter === 'week') { const { monday, sunday } = getWeekRange(); return trades.filter(t => { if (!t.date) return false; const d = new Date(t.date + 'T12:00:00'); return d >= monday && d <= sunday; }); }
    if (activeFilter === 'A1' || activeFilter === 'A2') return trades.filter(t => t.account === activeFilter);
    if (['aplus', 'a', 'aminus'].includes(activeFilter)) return trades.filter(t => t.grade === activeFilter);
    if (['MGC', 'MNQ'].includes(activeFilter)) return trades.filter(t => t.symbol === activeFilter);
    if (activeFilter === 'al-primary') return trades.filter(t => t.al_tier === 'Primary');
    if (activeFilter === 'al-secondary') return trades.filter(t => t.al_tier === 'Secondary');
    if (activeFilter === 'al-tertiary') return trades.filter(t => t.al_tier === 'Tertiary');
    if (activeFilter === 'sl-primary') return trades.filter(t => t.sl_tier === 'Primary');
    if (activeFilter === 'sl-secondary') return trades.filter(t => t.sl_tier === 'Secondary');
    if (activeFilter === 'sl-tertiary') return trades.filter(t => t.sl_tier === 'Tertiary');
    return trades;
  };

  const closed = trades.filter(t => t.pnl !== null);
  const wins = closed.filter(t => t.pnl > 0);
  const losses = closed.filter(t => t.pnl < 0);
  const net = closed.reduce((s, t) => s + (t.pnl || 0), 0);
  const avgW = wins.length ? Math.round(wins.reduce((s, t) => s + t.pnl, 0) / wins.length) : null;
  const avgL = losses.length ? Math.round(losses.reduce((s, t) => s + t.pnl, 0) / losses.length) : null;
  const wr = closed.length ? Math.round(wins.length / closed.length * 100) : null;

  const insightData = (key, labels) => labels.map(({ k, l }) => {
    const ts = closed.filter(t => t[key] === k);
    if (!ts.length) return null;
    const w = ts.filter(t => t.pnl > 0).length;
    return { label: l, wr: Math.round(w / ts.length * 100), net: Math.round(ts.reduce((s, t) => s + t.pnl, 0)) };
  }).filter(Boolean);

  const ft = (() => {
    const base = filteredTrades();
    return [...base].sort((a, b) => {
      let av = a[sortCol], bv = b[sortCol];
      if (av === null || av === undefined) av = ''; if (bv === null || bv === undefined) bv = '';
      if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av;
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  })();

  const totalPages = Math.ceil(ft.length / PAGE_SIZE);
  const paginatedFt = ft.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const weekTrades = filteredTrades().filter(t => activeFilter === 'week' && t.pnl !== null);
  const weekNet = weekTrades.reduce((s, t) => s + (t.pnl || 0), 0);
  const weekWins = weekTrades.filter(t => t.pnl > 0).length;
  const weekLosses = weekTrades.filter(t => t.pnl < 0).length;

  const tierFilterGroups = [
    { key: 'al-primary', label: 'AL: Primary', color: TIER_COLORS['Primary'] },
    { key: 'al-secondary', label: 'AL: Secondary', color: TIER_COLORS['Secondary'] },
    { key: 'al-tertiary', label: 'AL: Tertiary', color: TIER_COLORS['Tertiary'] },
    { key: 'sl-primary', label: 'SL: Primary', color: TIER_COLORS['Primary'] },
    { key: 'sl-secondary', label: 'SL: Secondary', color: TIER_COLORS['Secondary'] },
    { key: 'sl-tertiary', label: 'SL: Tertiary', color: TIER_COLORS['Tertiary'] },
  ];

  return (
    <div className="app">
      {!authed && <Login onSuccess={() => setAuthed(true)} />}
      {authed && (<>
        <div className="header">
          <div><h1>Trade Log</h1><p className="subtitle">Trendline Break Strategy · MGC / MNQ · Both Accounts</p></div>
          <div className="header-actions">
            {msg && <span className="msg">{msg}</span>}
            {trades.length === 0 && <button className="btn-seed" onClick={seedDatabase} disabled={seeding}>{seeding ? 'Loading...' : 'Load 61 trades'}</button>}
            <button className="btn-export" onClick={exportCSV}>↓ Export CSV</button>
            <button className="btn-primary" onClick={() => { if (showForm && !editingTrade) { cancelForm(); } else { openNewTradeForm(); } }}>{showForm && !editingTrade ? 'Cancel' : '+ New Trade'}</button>
          </div>
        </div>

        <div className="stats-grid">
          <StatCard label="Total Trades" value={trades.length} />
          <StatCard label="Win Rate" value={wr !== null ? wr + '%' : '—'} color={wr >= 50 ? '#1D9E75' : wr !== null ? '#E24B4A' : undefined} />
          <StatCard label="Net P&L" value={closed.length ? (net >= 0 ? '+$' : '-$') + Math.abs(Math.round(net)) : '$0'} color={net > 0 ? '#1D9E75' : net < 0 ? '#E24B4A' : undefined} />
          <StatCard label="Avg Winner" value={avgW !== null ? '+$' + avgW : '—'} color="#1D9E75" />
          <StatCard label="Avg Loser" value={avgL !== null ? '-$' + Math.abs(avgL) : '—'} color="#E24B4A" />
        </div>

        <div className="insights-grid">
          <InsightCard title="By Instrument" data={insightData('symbol', [{ k: 'MGC', l: 'MGC Gold' }, { k: 'MNQ', l: 'MNQ NQ' }])} />
          <InsightCard title="By Grade" data={insightData('grade', [{ k: 'aplus', l: 'A+' }, { k: 'a', l: 'A' }, { k: 'aminus', l: 'A-' }])} />
          <InsightCard title="By Safety Line" data={insightData('sl_quality', [{ k: 'strong', l: '★ Strong' }, { k: 'weak', l: 'Weak' }])} />
          <InsightCard title="By Session" data={insightData('session', SESSIONS.map(s => ({ k: s, l: s })))} />
          <TierInsightCard trades={trades} />
        </div>

        <ProgressChart trades={trades} />

        <ManageLevels />

        {showForm && (
          <TradeForm form={form} setForm={setForm} onSubmit={editingTrade ? updateTrade : submitTrade} onCancel={cancelForm} uploading={uploading} isEdit={!!editingTrade} />
        )}

        <div className="table-card">
          <div className="table-header">
            <h2>Trade History ({ft.length})</h2>
            {activeFilter === 'week' && weekTrades.length > 0 && (
              <div style={{ fontSize: 13, fontFamily: 'var(--mono)', display: 'flex', gap: 16, alignItems: 'center' }}>
                <span style={{ color: weekNet >= 0 ? '#1D9E75' : '#E24B4A', fontWeight: 600 }}>{weekNet >= 0 ? '+$' : '-$'}{Math.abs(Math.round(weekNet))} net</span>
                <span style={{ color: '#1D9E75' }}>{weekWins}W</span>
                <span style={{ color: '#E24B4A' }}>{weekLosses}L</span>
                <span style={{ color: '#888' }}>{weekTrades.length > 0 ? Math.round(weekWins / weekTrades.length * 100) : 0}%</span>
              </div>
            )}
          </div>
          <div className="filter-row">
            {['all', 'A1', 'A2', 'MGC', 'MNQ', 'aplus', 'a', 'aminus', 'win', 'loss', 'week'].map(f => (
              <button key={f} className={`filter-btn ${activeFilter === f ? 'active' : ''}`} onClick={() => { setActiveFilter(f); setPage(1); }}>
                {f === 'aplus' ? 'A+' : f === 'aminus' ? 'A-' : f === 'week' ? 'This Week' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <div className="filter-row" style={{ marginTop: 4 }}>
            <span style={{ fontSize: 11, color: '#555', alignSelf: 'center', marginRight: 4, whiteSpace: 'nowrap' }}>Tier:</span>
            {tierFilterGroups.map(({ key, label, color }) => (
              <button key={key} className={`filter-btn ${activeFilter === key ? 'active' : ''}`}
                style={activeFilter === key ? { borderColor: color, color: color, background: color + '22' } : { borderColor: '#2a2a2a' }}
                onClick={() => { setActiveFilter(activeFilter === key ? 'all' : key); setPage(1); }}>{label}</button>
            ))}
          </div>

          {loading ? <div className="empty">Loading...</div> : ft.length === 0 ? (
            <div className="empty">No trades. {trades.length === 0 && <button className="btn-link" onClick={seedDatabase}>Load 61 historical trades</button>}</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {[['trade_number','#'],['date','Date'],['time','Time'],['account','Acct'],['symbol','Symbol'],['direction','Dir'],['grade','Grade'],['al_strength','AL'],['al_tier','AL Tier'],['sl_quality','SL'],['sl_tier','SL Tier'],['entry','Entry'],['exit_price','Exit'],['pnl','P&L'],['exit_reason','Result'],['session','Session']].map(([col, label]) => (
                      <th key={col} onClick={() => handleSort(col)} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                        {label} {sortCol === col ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                      </th>
                    ))}
                    <th>Chart</th><th>Edit</th><th>Del</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedFt.map(t => {
                    const pnl = t.pnl;
                    const alTier = t.al_tier || '—'; const slTier = t.sl_tier || '—';
                    const alTierColor = TIER_COLORS[alTier]; const slTierColor = TIER_COLORS[slTier];
                    return (
                      <tr key={t.id}>
                        <td>{t.trade_number || '—'}</td><td>{t.date}</td>
                        <td style={{ fontSize: 11 }}>{t.time || '—'}</td>
                        <td><span className={`badge ${t.account === 'A1' ? 'badge-purple' : 'badge-amber'}`}>{t.account}</span></td>
                        <td style={{ fontWeight: 500 }}>{t.symbol}</td>
                        <td><span className={`badge ${t.direction === 'long' ? 'badge-green' : 'badge-red'}`}>{t.direction}</span></td>
                        <td><span className="grade-badge" style={{ background: GRADE_COLORS[t.grade] + '22', color: GRADE_COLORS[t.grade] }}>{GRADES[t.grade] || t.grade}</span></td>
                        <td><span className={`badge ${t.al_strength === 'strong' ? 'badge-green' : 'badge-blue'}`}>{t.al_strength === 'strong' ? '★1wk+' : 'Std'}</span></td>
                        <td>{alTierColor ? <span className="badge" style={{ background: alTierColor + '22', color: alTierColor, border: '1px solid ' + alTierColor + '55' }}>{alTier}</span> : <span style={{ color: '#555' }}>—</span>}</td>
                        <td><span className={`badge ${t.sl_quality === 'strong' ? 'badge-teal' : 'badge-amber'}`}>{t.sl_quality === 'strong' ? '★Str' : 'Weak'}</span></td>
                        <td>{slTierColor ? <span className="badge" style={{ background: slTierColor + '22', color: slTierColor, border: '1px solid ' + slTierColor + '55' }}>{slTier}</span> : <span style={{ color: '#555' }}>—</span>}</td>
                        <td>{t.entry || '—'}</td><td>{t.exit_price || '—'}</td>
                        <td style={{ color: pnl > 0 ? '#1D9E75' : pnl < 0 ? '#E24B4A' : undefined, fontWeight: 500 }}>
                          {pnl !== null ? (pnl >= 0 ? '+$' : '-$') + Math.abs(pnl) : '—'}
                        </td>
                        <td><span className={`badge ${pnl > 0 ? 'badge-green' : pnl < 0 ? 'badge-red' : 'badge-blue'}`}>{t.exit_reason}</span></td>
                        <td style={{ fontSize: 11, color: '#888' }}>{t.session || '—'}</td>
                        <td>{t.chart_url ? <button className="chart-view-btn" onClick={() => setChartModal(t.chart_url)} title="View chart">📷</button> : <span style={{ color: '#333' }}>—</span>}</td>
                        <td><button className="edit-btn" onClick={() => startEdit(t)} title="Edit trade">✎</button></td>
                        <td><button className="del-btn" onClick={() => deleteTrade(t.id)}>×</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderTop: '1px solid #1a1a1a', marginTop: 4 }}>
              <div style={{ fontSize: 12, color: '#666' }}>
                Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, ft.length)} of {ft.length} trades
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button onClick={() => setPage(1)} disabled={page === 1} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #2a2a2a', background: 'transparent', color: page === 1 ? '#444' : '#888', cursor: page === 1 ? 'default' : 'pointer', fontSize: 12 }}>«</button>
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #2a2a2a', background: 'transparent', color: page === 1 ? '#444' : '#888', cursor: page === 1 ? 'default' : 'pointer', fontSize: 12 }}>‹ Prev</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <button key={p} onClick={() => setPage(p)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid', borderColor: page === p ? '#185FA5' : '#2a2a2a', background: page === p ? '#185FA522' : 'transparent', color: page === p ? '#185FA5' : '#888', cursor: 'pointer', fontSize: 12, fontWeight: page === p ? 600 : 400 }}>{p}</button>
                ))}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #2a2a2a', background: 'transparent', color: page === totalPages ? '#444' : '#888', cursor: page === totalPages ? 'default' : 'pointer', fontSize: 12 }}>Next ›</button>
                <button onClick={() => setPage(totalPages)} disabled={page === totalPages} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #2a2a2a', background: 'transparent', color: page === totalPages ? '#444' : '#888', cursor: page === totalPages ? 'default' : 'pointer', fontSize: 12 }}>»</button>
              </div>
            </div>
          )}
        </div>

        <ChartModal url={chartModal} onClose={() => setChartModal(null)} />
        <AIChat trades={trades} />
      </>)}
    </div>
  );
}
