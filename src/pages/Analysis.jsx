import { useState, useCallback, useEffect, useRef } from 'react';
import TOSUploader from '../components/TOSUploader';

function StatCard({ label, value, color }) {
  return (
    <div style={{ background: '#111', border: '1px solid #222', borderRadius: 8, padding: '10px 14px' }}>
      <div style={{ fontSize: 11, color: '#bbb', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: color || '#fff' }}>{value}</div>
    </div>
  );
}

// ── Chart wrapper — destroys and recreates Chart.js instance safely ────────────
function ChartCanvas({ id, build }) {
  const ref = useRef(null);
  const inst = useRef(null);

  useEffect(() => {
    if (!ref.current || !window.Chart) return;
    if (inst.current) { inst.current.destroy(); inst.current = null; }
    inst.current = build(ref.current);
    return () => { if (inst.current) { inst.current.destroy(); inst.current = null; } };
  }, [build]);

  return (
    <div style={{ position: 'relative', height: 200 }}>
      <canvas ref={ref} id={id} role="img" aria-label={id} />
    </div>
  );
}

// ── Shared Chart.js config ────────────────────────────────────────────────────
function baseOpts(extraPlugins) {
  const gc = 'rgba(255,255,255,0.06)';
  const tc = 'rgba(255,255,255,0.45)';
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { enabled: true, backgroundColor: '#1a1a2a', titleColor: '#ccc', bodyColor: '#aaa', borderColor: '#2a2a3a', borderWidth: 1 },
      ...extraPlugins,
    },
    scales: {
      x: { grid: { color: gc }, ticks: { color: tc, font: { size: 10 } } },
      y: { grid: { color: gc }, ticks: { color: tc, font: { size: 10 }, callback: v => (v >= 0 ? '+$' : '-$') + Math.abs(Math.round(v)).toLocaleString() } },
    },
  };
}

// ── Analysis page ─────────────────────────────────────────────────────────────
export default function Analysis({ filteredTrades, dateLabel, acctLabel }) {
  const [tosData,    setTosData]    = useState(null);
  const [chartReady, setChartReady] = useState(!!window.Chart);

  useEffect(() => {
    if (window.Chart) { setChartReady(true); return; }
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js';
    s.onload = () => setChartReady(true);
    document.head.appendChild(s);
  }, []);

  const handleImport = useCallback((parsed) => {
    const trips = parsed.roundTrips || [];
    if (!trips.length) return;

    // Equity curve — deduplicated daily cash balance
    const eqMap = {};
    (parsed.cashBalances || []).forEach(b => { eqMap[b.date] = b.balance; });
    const equityCurve = Object.entries(eqMap)
      .sort((a, b) => new Date(a[0]) - new Date(b[0]))
      .map(([date, balance]) => ({ date, balance }));

    // P&L by symbol
    const symMap = {};
    trips.forEach(t => { symMap[t.symbol] = (symMap[t.symbol] || 0) + t.pnl; });

    setTosData({
      account:     parsed.account,
      period:      parsed.period || '',
      trips,
      equityCurve,
      symMap,
      totalComm:   trips.reduce((s, t) => s + (t.comm || 0), 0),
      netPnl:      trips.reduce((s, t) => s + t.pnl, 0),
      wins:        trips.filter(t => t.pnl > 0).length,
      total:       trips.length,
      avgHold:     trips.reduce((s, t) => s + (t.duration_hrs || 0), 0) / trips.length,
    });
  }, []);

  // ── chart builders (memoised on tosData) ─────────────────────────────────
  const buildEquity = useCallback((canvas) => {
    if (!tosData?.equityCurve?.length) return null;
    const labels = tosData.equityCurve.map(d => d.date);
    const data   = tosData.equityCurve.map(d => d.balance);
    return new window.Chart(canvas, {
      type: 'line',
      data: { labels, datasets: [{ data, borderColor: '#185FA5', borderWidth: 2, pointRadius: 0, fill: true, backgroundColor: 'rgba(24,95,165,0.08)' }] },
      options: {
        ...baseOpts(),
        plugins: { ...baseOpts().plugins, tooltip: { ...baseOpts().plugins.tooltip, callbacks: { label: c => ' $' + Math.round(c.parsed.y).toLocaleString() } } },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: 'rgba(255,255,255,0.45)', font: { size: 9 }, maxTicksLimit: 8, maxRotation: 0 } },
          y: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: 'rgba(255,255,255,0.45)', font: { size: 10 }, callback: v => '$' + Math.round(v / 1000) + 'k' } },
        },
      },
    });
  }, [tosData]);

  const buildSymbol = useCallback((canvas) => {
    if (!tosData?.symMap) return null;
    const labels = Object.keys(tosData.symMap);
    const data   = Object.values(tosData.symMap);
    return new window.Chart(canvas, {
      type: 'bar',
      data: { labels, datasets: [{ data, backgroundColor: data.map(v => v >= 0 ? '#1D9E75' : '#E24B4A'), borderRadius: 4 }] },
      options: { ...baseOpts(), plugins: { ...baseOpts().plugins, tooltip: { ...baseOpts().plugins.tooltip, callbacks: { label: c => (c.parsed.y >= 0 ? ' +$' : ' -$') + Math.abs(Math.round(c.parsed.y)).toLocaleString() } } } },
    });
  }, [tosData]);

  const buildStop = useCallback((canvas) => {
    if (!tosData?.trips) return null;
    const wins   = tosData.trips.filter(t => t.pnl > 0 && t.stop_dist > 0);
    const losses = tosData.trips.filter(t => t.pnl <= 0 && t.stop_dist > 0);
    return new window.Chart(canvas, {
      type: 'scatter',
      data: { datasets: [
        { label: 'Win',  data: wins.map(t  => ({ x: Math.round(t.stop_dist * 10) / 10, y: t.pnl })), backgroundColor: '#1D9E75', pointRadius: 6, pointStyle: 'circle' },
        { label: 'Loss', data: losses.map(t => ({ x: Math.round(t.stop_dist * 10) / 10, y: t.pnl })), backgroundColor: '#E24B4A', pointRadius: 6, pointStyle: 'triangle' },
      ]},
      options: {
        ...baseOpts(),
        plugins: { legend: { display: true, labels: { color: 'rgba(255,255,255,0.45)', font: { size: 10 }, boxWidth: 8, usePointStyle: true } }, tooltip: { ...baseOpts().plugins.tooltip, callbacks: { label: c => ` Stop: ${c.parsed.x}pts  P&L: ${c.parsed.y >= 0 ? '+' : ''}$${Math.round(c.parsed.y)}` } } },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: 'rgba(255,255,255,0.45)', font: { size: 10 } }, title: { display: true, text: 'Stop distance (pts)', color: 'rgba(255,255,255,0.35)', font: { size: 10 } } },
          y: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: 'rgba(255,255,255,0.45)', font: { size: 10 }, callback: v => (v >= 0 ? '+$' : '-$') + Math.abs(Math.round(v)).toLocaleString() } },
        },
      },
    });
  }, [tosData]);

  const buildHold = useCallback((canvas) => {
    if (!tosData?.trips) return null;
    // Use log2(hrs+1) on x to spread intraday trades, show real hours in tooltip
    const wins   = tosData.trips.filter(t => t.pnl > 0);
    const losses = tosData.trips.filter(t => t.pnl <= 0);
    const toLogX = h => Math.round(Math.log2((h || 0) + 1) * 100) / 100;
    // x-axis tick labels: convert log back to hours
    const tickMap = { 0: '0h', 1: '1h', 2: '3h', 3: '7h', 4: '15h', 5: '31h', 6: '63h', 7: '127h' };
    return new window.Chart(canvas, {
      type: 'scatter',
      data: { datasets: [
        { label: 'Win',  data: wins.map(t   => ({ x: toLogX(t.duration_hrs), y: t.pnl, raw_hrs: Math.round(t.duration_hrs * 10) / 10 })), backgroundColor: '#1D9E75', pointRadius: 6, pointStyle: 'circle' },
        { label: 'Loss', data: losses.map(t => ({ x: toLogX(t.duration_hrs), y: t.pnl, raw_hrs: Math.round(t.duration_hrs * 10) / 10 })), backgroundColor: '#E24B4A', pointRadius: 6, pointStyle: 'triangle' },
      ]},
      options: {
        ...baseOpts(),
        plugins: { legend: { display: true, labels: { color: 'rgba(255,255,255,0.45)', font: { size: 10 }, boxWidth: 8, usePointStyle: true } }, tooltip: { ...baseOpts().plugins.tooltip, callbacks: { label: c => ` Hold: ${c.raw?.raw_hrs ?? '?'}h  P&L: ${c.parsed.y >= 0 ? '+' : ''}$${Math.round(c.parsed.y)}` } } },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: 'rgba(255,255,255,0.45)', font: { size: 10 }, callback: v => tickMap[Math.round(v)] || '' }, title: { display: true, text: 'Hold time (log scale)', color: 'rgba(255,255,255,0.35)', font: { size: 10 } } },
          y: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: 'rgba(255,255,255,0.45)', font: { size: 10 }, callback: v => (v >= 0 ? '+$' : '-$') + Math.abs(Math.round(v)).toLocaleString() } },
        },
      },
    });
  }, [tosData]);

  const buildMultiday = useCallback((canvas) => {
    if (!tosData?.trips) return null;
    const multiday = tosData.trips.filter(t => t.duration_hrs >= 20 && t.checkpoints?.length > 0).slice(0, 5);
    if (!multiday.length) return null;
    const colors = ['#185FA5', '#1D9E75', '#BA7517', '#E24B4A', '#7c3aed'];
    const maxPts = Math.max(...multiday.map(t => t.checkpoints.length + 2));
    const labels = ['Entry', ...Array.from({ length: maxPts - 2 }, (_, i) => `Day ${i + 1}`), 'Exit'];
    return new window.Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: multiday.map((t, i) => ({
          label: `${t.symbol} ${t.direction} ${t.pnl >= 0 ? '+' : ''}$${Math.round(t.pnl)}`,
          data:  [0, ...t.checkpoints.map(c => c.running_pnl ?? 0), t.pnl],
          borderColor: colors[i], borderWidth: 2, pointRadius: 5, fill: false,
          borderDash: i === 0 ? [] : i === 1 ? [5, 3] : [2, 2],
        })),
      },
      options: {
        ...baseOpts(),
        plugins: { legend: { display: true, labels: { color: 'rgba(255,255,255,0.45)', font: { size: 10 }, boxWidth: 10 } }, tooltip: { ...baseOpts().plugins.tooltip, callbacks: { label: c => ` ${c.dataset.label}: ${c.parsed.y >= 0 ? '+' : ''}$${Math.round(c.parsed.y).toLocaleString()}` } } },
      },
    });
  }, [tosData]);

  const fmtPnl = v => (v >= 0 ? '+$' : '-$') + Math.abs(Math.round(v)).toLocaleString();

  return (
    <div style={{ padding: '16px 20px' }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 500, color: '#ccc', marginBottom: 2 }}>Analysis</div>
        <div style={{ fontSize: 12, color: '#555' }}>{dateLabel} · {acctLabel}</div>
      </div>

      <div style={{ background: '#111', border: '1px solid #222', borderRadius: 8, padding: '12px 14px', marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#ccc', marginBottom: 8 }}>📊 Import TOS Account Statement</div>
        <TOSUploader trades={filteredTrades} onComplete={handleImport} />
      </div>

      {!tosData && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#444', fontSize: 13 }}>
          Upload a TOS account statement above to see charts
        </div>
      )}

      {tosData && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 16 }}>
            <StatCard label="Account"   value={tosData.account} />
            <StatCard label="Trades"    value={tosData.total} />
            <StatCard label="Win Rate"  value={tosData.total ? Math.round(tosData.wins / tosData.total * 100) + '%' : '—'} color={tosData.wins / tosData.total >= 0.5 ? '#1D9E75' : '#E24B4A'} />
            <StatCard label="Net P&L"   value={fmtPnl(tosData.netPnl)} color={tosData.netPnl >= 0 ? '#1D9E75' : '#E24B4A'} />
            <StatCard label="Comm paid" value={`-$${Math.round(tosData.totalComm)}`} color="#E24B4A" />
          </div>

          <div style={{ background: '#111', border: '1px solid #222', borderRadius: 8, padding: '12px 14px', marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: '#bbb', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Account Equity Curve</div>
            <ChartCanvas id="eq-chart" build={buildEquity} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div style={{ background: '#111', border: '1px solid #222', borderRadius: 8, padding: '12px 14px' }}>
              <div style={{ fontSize: 11, color: '#bbb', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>P&L by Symbol</div>
              <ChartCanvas id="sym-chart" build={buildSymbol} />
            </div>
            <div style={{ background: '#111', border: '1px solid #222', borderRadius: 8, padding: '12px 14px' }}>
              <div style={{ fontSize: 11, color: '#bbb', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Stop Distance vs Outcome</div>
              <ChartCanvas id="stop-chart" build={buildStop} />
            </div>
            <div style={{ background: '#111', border: '1px solid #222', borderRadius: 8, padding: '12px 14px' }}>
              <div style={{ fontSize: 11, color: '#bbb', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Hold Time vs P&L</div>
              <ChartCanvas id="hold-chart" build={buildHold} />
            </div>
          </div>

          <div style={{ background: '#111', border: '1px solid #222', borderRadius: 8, padding: '12px 14px' }}>
            <div style={{ fontSize: 11, color: '#bbb', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Multiday Trades — Real P&L from Daily Settlements</div>
            <ChartCanvas id="md-chart" build={buildMultiday} />
          </div>
        </>
      )}

    </div>
  );
}
