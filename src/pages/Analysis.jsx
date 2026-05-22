import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import TOSUploader from '../components/TOSUploader';

function StatCard({ label, value, color }) {
  return (
    <div style={{ background: '#111', border: '1px solid #222', borderRadius: 8, padding: '10px 14px' }}>
      <div style={{ fontSize: 11, color: '#bbb', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: color || '#fff' }}>{value}</div>
    </div>
  );
}

function ChartCanvas({ id, build }) {
  const ref      = useRef(null);
  const inst     = useRef(null);
  const cancelled = useRef(false);

  useEffect(() => {
    if (!ref.current) return;
    cancelled.current = false;
    const attempt = () => {
      if (cancelled.current) return;
      if (!window.Chart) { setTimeout(attempt, 100); return; }
      if (!ref.current || cancelled.current) return;
      if (inst.current) { try { inst.current.destroy(); } catch {} inst.current = null; }
      try { inst.current = build(ref.current); } catch(e) { console.error('Chart:', e); }
    };
    attempt();
    return () => {
      cancelled.current = true;
      if (inst.current) { try { inst.current.destroy(); } catch {} inst.current = null; }
    };
  }, [build]);

  return (
    <div style={{ position: 'relative', height: 200 }}>
      <canvas ref={ref} id={id} role="img" aria-label={id} />
    </div>
  );
}

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

export default function Analysis({ filteredTrades, dateLabel, acctLabel, dateRange, account, tosData, setTosData }) {
  useEffect(() => {
    if (window.Chart) return;
    const existing = document.getElementById('chartjs-cdn');
    if (existing) return;
    const s = document.createElement('script');
    s.id  = 'chartjs-cdn';
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js';
    document.head.appendChild(s);
  }, []);

  // Merge trips from multiple uploads — keep all accounts in tosData.trips
  const handleImport = useCallback((parsed) => {
    const trips = parsed.roundTrips || [];
    if (!trips.length) return;

    // Tag each trip with its account
    const taggedTrips = trips.map(t => ({ ...t, account: parsed.account }));

    const eqMap = {};
    (parsed.cashBalances || []).forEach(b => { eqMap[b.date] = b.balance; });
    const equityCurve = Object.entries(eqMap)
      .sort((a, b) => new Date(a[0]) - new Date(b[0]))
      .map(([date, balance]) => ({ date, balance, account: parsed.account }));

    setTosData(prev => {
      const prevTrips = prev?.trips || [];
      // Remove old trips for this account, add new ones
      const otherTrips = prevTrips.filter(t => t.account !== parsed.account);
      const allTrips = [...otherTrips, ...taggedTrips];

      const prevEquity = (prev?.equityCurve || []).filter(e => e.account !== parsed.account);
      const allEquity  = [...prevEquity, ...equityCurve].sort((a,b) => new Date(a.date) - new Date(b.date));

      const symMap = {};
      allTrips.forEach(t => { symMap[t.symbol] = (symMap[t.symbol] || 0) + t.pnl; });

      return {
        account:   allTrips.map(t => t.account).filter((v,i,a) => a.indexOf(v)===i).join('+'),
        trips:     allTrips,
        equityCurve: allEquity,
        symMap,
        totalComm: allTrips.reduce((s, t) => s + (t.comm || 0), 0),
        netPnl:    allTrips.reduce((s, t) => s + t.pnl, 0),
        wins:      allTrips.filter(t => t.pnl > 0).length,
        total:     allTrips.length,
        avgHold:   allTrips.reduce((s, t) => s + (t.duration_hrs || 0), 0) / allTrips.length,
      };
    });
  }, [setTosData]);

  // Filter by date range AND account
  const filteredTrips = useMemo(() => {
    if (!tosData?.trips) return [];
    return tosData.trips.filter(t => {
      // Account filter
      if (account && account !== 'both') {
        if ((t.account || '').toUpperCase() !== account.toUpperCase()) return false;
      }
      // Date filter
      if (dateRange && t.entry_dt) {
        const d = new Date(t.entry_dt);
        if (d < dateRange.start || d > dateRange.end) return false;
      }
      return true;
    });
  }, [tosData, account, dateRange?.start?.getTime(), dateRange?.end?.getTime()]);

  const filteredEquity = useMemo(() => {
    if (!tosData?.equityCurve) return [];
    return tosData.equityCurve.filter(e => {
      if (account && account !== 'both') {
        if ((e.account || '').toUpperCase() !== account.toUpperCase()) return false;
      }
      if (!dateRange || !e.date) return true;
      try {
        const parts = e.date.split('/');
        const yr = parts[2].length === 2 ? '20' + parts[2] : parts[2];
        const d = new Date(`${yr}-${parts[0].padStart(2,'0')}-${parts[1].padStart(2,'0')}`);
        return d >= dateRange.start && d <= dateRange.end;
      } catch { return true; }
    });
  }, [tosData, account, dateRange?.start?.getTime(), dateRange?.end?.getTime()]);

  const buildEquity = useCallback((canvas) => {
    if (!filteredEquity?.length) return null;
    const labels = filteredEquity.map(d => d.date);
    const data   = filteredEquity.map(d => d.balance);
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
  }, [filteredEquity]);

  const buildSymbol = useCallback((canvas) => {
    if (!filteredTrips.length) return null;
    const symMap = {};
    filteredTrips.forEach(t => { symMap[t.symbol] = (symMap[t.symbol] || 0) + t.pnl; });
    const labels = Object.keys(symMap);
    const data   = Object.values(symMap);
    return new window.Chart(canvas, {
      type: 'bar',
      data: { labels, datasets: [{ data, backgroundColor: data.map(v => v >= 0 ? '#1D9E75' : '#E24B4A'), borderRadius: 4 }] },
      options: { ...baseOpts(), plugins: { ...baseOpts().plugins, tooltip: { ...baseOpts().plugins.tooltip, callbacks: { label: c => (c.parsed.y >= 0 ? ' +$' : ' -$') + Math.abs(Math.round(c.parsed.y)).toLocaleString() } } } },
    });
  }, [filteredTrips]);

  const buildStop = useCallback((canvas) => {
    if (!filteredTrips.length) return null;
    const wins   = filteredTrips.filter(t => t.pnl > 0 && t.stop_dist > 0);
    const losses = filteredTrips.filter(t => t.pnl <= 0 && t.stop_dist > 0);
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
  }, [filteredTrips]);

  const buildHold = useCallback((canvas) => {
    if (!filteredTrips.length) return null;
    const wins   = filteredTrips.filter(t => t.pnl > 0);
    const losses = filteredTrips.filter(t => t.pnl <= 0);
    const toLogX = h => Math.round(Math.log2((h || 0) + 1) * 100) / 100;
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
  }, [filteredTrips]);

  // FIX: multiday — removed checkpoints requirement, build from pnl_points or entry/exit only
  const buildMultiday = useCallback((canvas) => {
    if (!filteredTrips.length) return null;
    const multiday = filteredTrips
      .filter(t => (t.duration_hrs || 0) >= 20)
      .sort((a, b) => b.duration_hrs - a.duration_hrs)
      .slice(0, 5);
    if (!multiday.length) return null;

    const colors = ['#185FA5', '#1D9E75', '#BA7517', '#E24B4A', '#7c3aed'];

    // Build datasets — use pnl_points if available, else just entry+exit
    const datasets = multiday.map((t, i) => {
      let points;
      if (t.pnl_points && t.pnl_points.length > 2) {
        points = t.pnl_points.map(p => p.pnl);
      } else {
        points = [0, t.pnl];
      }
      const hrs = Math.round(t.duration_hrs);
      return {
        label: `${t.symbol} ${t.direction} ${t.pnl >= 0 ? '+' : ''}$${Math.round(t.pnl)} (${hrs}h)`,
        data: points,
        borderColor: colors[i], borderWidth: 2, pointRadius: 4, fill: false,
        borderDash: i === 0 ? [] : i === 1 ? [5, 3] : [2, 2],
      };
    });

    const maxLen = Math.max(...datasets.map(d => d.data.length));
    const labels = ['Entry', ...Array.from({ length: maxLen - 2 }, (_, i) => `Day ${i + 1}`), 'Exit'].slice(0, maxLen);

    return new window.Chart(canvas, {
      type: 'line',
      data: { labels, datasets },
      options: {
        ...baseOpts(),
        plugins: {
          legend: { display: true, labels: { color: 'rgba(255,255,255,0.45)', font: { size: 10 }, boxWidth: 10 } },
          tooltip: { ...baseOpts().plugins.tooltip, callbacks: { label: c => ` ${c.dataset.label}: ${c.parsed.y >= 0 ? '+' : ''}$${Math.round(c.parsed.y).toLocaleString()}` } },
        },
      },
    });
  }, [filteredTrips]);

  const fmtPnl = v => (v >= 0 ? '+$' : '-$') + Math.abs(Math.round(v)).toLocaleString();

  // Compute stats from filteredTrips (respects account + date filter)
  const tw = filteredTrips.filter(t => t.pnl > 0).length;
  const tt = filteredTrips.length;
  const tn = filteredTrips.reduce((s, t) => s + t.pnl, 0);
  const tc = filteredTrips.reduce((s, t) => s + (t.comm || 0), 0);

  // Label for which accounts are loaded
  const loadedAccounts = tosData
    ? [...new Set((tosData.trips || []).map(t => t.account))].join(' + ')
    : null;

  return (
    <div style={{ padding: '16px 20px' }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 500, color: '#ccc', marginBottom: 2 }}>Analysis</div>
        <div style={{ fontSize: 12, color: '#555' }}>{dateLabel} · {acctLabel}</div>
      </div>

      <div style={{ background: '#111', border: '1px solid #222', borderRadius: 8, padding: '12px 14px', marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#ccc', marginBottom: 8 }}>
          📊 Import TOS Account Statement
          {loadedAccounts && <span style={{ marginLeft: 8, fontSize: 11, color: '#1D9E75' }}>✅ Loaded: {loadedAccounts}</span>}
        </div>
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
            <StatCard label="Showing"   value={acctLabel} />
            <StatCard label="Trades"    value={tt} />
            <StatCard label="Win Rate"  value={tt ? Math.round(tw/tt*100)+'%' : '—'} color={tt && tw/tt>=0.5?'#1D9E75':'#E24B4A'} />
            <StatCard label="Net P&L"   value={fmtPnl(tn)} color={tn>=0?'#1D9E75':'#E24B4A'} />
            <StatCard label="Comm paid" value={'-$'+Math.round(tc)} color="#E24B4A" />
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
            <div style={{ fontSize: 11, color: '#bbb', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
              Multiday Trades — Real P&L from Daily Settlements
            </div>
            <div style={{ fontSize: 11, color: '#444', marginBottom: 8 }}>
              Trades held 20h+ · showing up to 5 longest
              {filteredTrips.filter(t => (t.duration_hrs||0) >= 20).length === 0 &&
                <span style={{ color: '#666' }}> — none found in current filter</span>}
            </div>
            <ChartCanvas id="md-chart" build={buildMultiday} />
          </div>
        </>
      )}
    </div>
  );
}
