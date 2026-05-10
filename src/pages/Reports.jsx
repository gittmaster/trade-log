import React, { useState, useEffect, useRef } from 'react';

export default function Reports({ filteredTrades, dateLabel, acctLabel }) {
  const [chartView, setChartView] = useState('daily');
  const cumulRef = useRef(null);
  const dailyRef = useRef(null);
  const cumulInstance = useRef(null);
  const dailyInstance = useRef(null);
  const [chartReady, setChartReady] = useState(!!window.Chart);

  const closed = filteredTrades.filter(t => t.pnl !== null && t.date);

  useEffect(() => {
    if (window.Chart) { setChartReady(true); return; }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js';
    script.onload = () => setChartReady(true);
    document.head.appendChild(script);
  }, []);

  const buildData = () => {
    const dateMap = {};
    [...closed].sort((a, b) => a.date.localeCompare(b.date)).forEach(t => {
      let key = t.date;
      if (chartView === 'weekly') {
        const d = new Date(t.date + 'T12:00:00');
        const day = d.getDay(), diff = day === 0 ? -6 : 1 - day;
        const mon = new Date(d); mon.setDate(d.getDate() + diff);
        key = mon.toISOString().split('T')[0];
      } else if (chartView === 'monthly') {
        key = t.date.slice(0, 7);
      }
      if (!dateMap[key]) dateMap[key] = 0;
      dateMap[key] += t.pnl;
    });

    const keys = Object.keys(dateMap).sort();
    let cum = 0;
    return keys.map(k => {
      const daily = Math.round(dateMap[k] * 100) / 100;
      cum += daily;
      let label = k;
      if (chartView === 'daily') {
        const [, m, d] = k.split('-');
        label = `${m}/${d}`;
      } else if (chartView === 'weekly') {
        const d = new Date(k + 'T12:00:00');
        label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      } else {
        const [y, m] = k.split('-');
        label = new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      }
      return { key: k, label, daily, cumulative: Math.round(cum * 100) / 100 };
    });
  };

  useEffect(() => {
    if (!chartReady || !cumulRef.current || !dailyRef.current) return;
    const data = buildData();
    if (cumulInstance.current) { cumulInstance.current.destroy(); cumulInstance.current = null; }
    if (dailyInstance.current) { dailyInstance.current.destroy(); dailyInstance.current = null; }
    if (!data.length) return;
    const Chart = window.Chart;
    const labels = data.map(d => d.label);
    const cumulValues = data.map(d => d.cumulative);
    const dailyValues = data.map(d => d.daily);

    const cCtx = cumulRef.current.getContext('2d');
    const allPos = cumulValues.every(v => v >= 0), allNeg = cumulValues.every(v => v < 0);
    let grad = cCtx.createLinearGradient(0, 0, 0, 220);
    if (allPos) { grad.addColorStop(0, 'rgba(29,158,117,0.35)'); grad.addColorStop(1, 'rgba(29,158,117,0.03)'); }
    else if (allNeg) { grad.addColorStop(0, 'rgba(226,75,74,0.08)'); grad.addColorStop(1, 'rgba(226,75,74,0.38)'); }
    else {
      const maxV = Math.max(...cumulValues), minV = Math.min(...cumulValues);
      const zr = Math.min(maxV / (maxV - minV), 0.98);
      grad.addColorStop(0, 'rgba(29,158,117,0.35)');
      grad.addColorStop(zr, 'rgba(29,158,117,0.04)');
      grad.addColorStop(Math.min(zr + 0.02, 1), 'rgba(226,75,74,0.04)');
      grad.addColorStop(1, 'rgba(226,75,74,0.35)');
    }
    const lastVal = cumulValues[cumulValues.length - 1];
    cumulInstance.current = new Chart(cCtx, {
      type: 'line',
      data: { labels, datasets: [{ data: cumulValues, borderColor: lastVal >= 0 ? '#1D9E75' : '#E24B4A', borderWidth: 2, pointRadius: data.length <= 10 ? 3 : 0, pointHoverRadius: 5, fill: true, backgroundColor: grad, tension: 0.3 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1a1a1a', borderColor: '#333', borderWidth: 1, titleColor: '#aaa', bodyColor: '#fff', callbacks: { label: ctx => ` ${ctx.raw >= 0 ? '+$' : '-$'}${Math.abs(ctx.raw).toLocaleString()}` } } }, scales: { x: { ticks: { color: '#555', font: { size: 11 }, maxTicksLimit: 10, maxRotation: 0 }, grid: { display: false }, border: { display: false } }, y: { ticks: { color: '#555', font: { size: 11 }, callback: v => (v >= 0 ? '+$' : '-$') + Math.abs(v).toLocaleString() }, grid: { color: 'rgba(255,255,255,0.05)' }, border: { display: false } } } }
    });

    const dCtx = dailyRef.current.getContext('2d');
    dailyInstance.current = new Chart(dCtx, {
      type: 'bar',
      data: { labels, datasets: [{ data: dailyValues, backgroundColor: dailyValues.map(v => v >= 0 ? 'rgba(29,158,117,0.85)' : 'rgba(226,75,74,0.85)'), borderColor: dailyValues.map(v => v >= 0 ? '#0F6E56' : '#A32D2D'), borderWidth: 1, borderRadius: 3 }] },
      options: {
        responsive: true, maintainAspectRatio: false, layout: { padding: { top: 24 } },
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: { x: { ticks: { color: '#555', font: { size: 11 }, maxTicksLimit: 10, maxRotation: 0 }, grid: { display: false }, border: { display: false } }, y: { ticks: { color: '#555', font: { size: 11 }, callback: v => (v >= 0 ? '+$' : '-$') + Math.abs(v).toLocaleString() }, grid: { color: 'rgba(255,255,255,0.05)' }, border: { display: false } } },
        animation: { onComplete: function() {
          const chart = this; const ctx = chart.ctx; ctx.save(); ctx.font = '500 10px sans-serif'; ctx.textAlign = 'center';
          chart.data.datasets.forEach((ds, i) => {
            const meta = chart.getDatasetMeta(i);
            meta.data.forEach((bar, idx) => {
              const v = ds.data[idx]; if (v === null || v === undefined) return;
              const lbl = (v >= 0 ? '+$' : '-$') + Math.abs(Math.round(v)).toLocaleString();
              ctx.fillStyle = v >= 0 ? '#1D9E75' : '#E24B4A';
              if (v >= 0) { ctx.textBaseline = 'bottom'; ctx.fillText(lbl, bar.x, bar.y - 3); }
              else { ctx.textBaseline = 'top'; ctx.fillText(lbl, bar.x, bar.y + 3); }
            });
          });
          ctx.restore();
        }}
      }
    });
    return () => {
      if (cumulInstance.current) { cumulInstance.current.destroy(); cumulInstance.current = null; }
      if (dailyInstance.current) { dailyInstance.current.destroy(); dailyInstance.current = null; }
    };
  }, [chartReady, filteredTrades, chartView]);

  // Stats
  const data = buildData();
  const netPnl = Math.round(data.reduce((s, d) => s + d.daily, 0));
  const weeklyMap = {};
  closed.forEach(t => {
    const d = new Date(t.date + 'T12:00:00'), day = d.getDay(), diff = day === 0 ? -6 : 1 - day;
    const mon = new Date(d); mon.setDate(d.getDate() + diff);
    const key = mon.toISOString().split('T')[0];
    if (!weeklyMap[key]) weeklyMap[key] = 0;
    weeklyMap[key] += t.pnl;
  });
  const weeklyVals = Object.values(weeklyMap).map(v => Math.round(v));
  const winWeeks = weeklyVals.filter(v => v > 0), lossWeeks = weeklyVals.filter(v => v < 0);
  const avgWinWeek = winWeeks.length ? Math.round(winWeeks.reduce((a, b) => a + b, 0) / winWeeks.length) : 0;
  const avgLossWeek = lossWeeks.length ? Math.round(lossWeeks.reduce((a, b) => a + b, 0) / lossWeeks.length) : 0;
  const bestWeekVal = weeklyVals.length ? Math.max(...weeklyVals) : 0;
  const worstWeekVal = weeklyVals.length ? Math.min(...weeklyVals) : 0;
  const bestWeekKey = Object.keys(weeklyMap).find(k => Math.round(weeklyMap[k]) === bestWeekVal) || '';
  const worstWeekKey = Object.keys(weeklyMap).find(k => Math.round(weeklyMap[k]) === worstWeekVal) || '';
  const fmtWk = (k) => k ? new Date(k + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';

  const dayStats = ['Mon','Tue','Wed','Thu','Fri'].map((label, i) => {
    const dayNum = i + 1;
    const ts = closed.filter(t => { const d = new Date(t.date + 'T12:00:00'); return d.getDay() === dayNum; });
    if (!ts.length) return { label, trades: 0, wr: 0, net: 0 };
    const w = ts.filter(t => t.pnl > 0).length;
    return { label, trades: ts.length, wr: Math.round(w / ts.length * 100), net: Math.round(ts.reduce((s, t) => s + t.pnl, 0)) };
  });

  const timeWindows = [
    { label: '07–09', h: [7, 9] }, { label: '09–11', h: [9, 11] }, { label: '11–13', h: [11, 13] },
    { label: '13–15', h: [13, 15] }, { label: '15–19', h: [15, 19] }, { label: '19–23', h: [19, 23] },
  ];
  const timeStats = timeWindows.map(tw => {
    const ts = closed.filter(t => { if (!t.time) return false; const h = parseInt(t.time.split(':')[0]); return h >= tw.h[0] && h < tw.h[1]; });
    if (!ts.length) return { label: tw.label, trades: 0, wr: 0, net: 0 };
    const w = ts.filter(t => t.pnl > 0).length;
    return { label: tw.label, trades: ts.length, wr: Math.round(w / ts.length * 100), net: Math.round(ts.reduce((s, t) => s + t.pnl, 0)) };
  });

  const toggleBtn = (v, label) => (
    <button key={v} onClick={() => setChartView(v)} style={{
      padding: '3px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer',
      border: '1px solid', borderColor: chartView === v ? '#185FA5' : '#2a2a2a',
      background: chartView === v ? '#185FA522' : 'transparent', color: chartView === v ? '#185FA5' : '#666',
    }}>{label}</button>
  );

  const card = (label, value, color) => (
    <div style={{ background: '#111', border: '1px solid #222', borderRadius: 8, padding: '10px 14px' }}>
      <div style={{ fontSize: 11, color: '#555', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 500, color: color || '#ccc' }}>{value}</div>
    </div>
  );

  return (
    <div style={{ padding: '16px 20px' }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 500, color: '#ccc', marginBottom: 2 }}>Reports</div>
        <div style={{ fontSize: 12, color: '#555' }}>{dateLabel} · {acctLabel}</div>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 20 }}>
        {card('Net P&L', (netPnl >= 0 ? '+$' : '-$') + Math.abs(netPnl).toLocaleString(), netPnl >= 0 ? '#1D9E75' : '#E24B4A')}
        {card('Avg Win Week', avgWinWeek > 0 ? '+$' + avgWinWeek : '—', '#1D9E75')}
        {card('Avg Loss Week', avgLossWeek < 0 ? '-$' + Math.abs(avgLossWeek) : '—', '#E24B4A')}
        {card('Win Weeks / Loss Weeks', `${winWeeks.length}W / ${lossWeeks.length}L`, winWeeks.length >= lossWeeks.length ? '#1D9E75' : '#E24B4A')}
      </div>

      {/* Chart toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {toggleBtn('daily', 'Daily')}
          {toggleBtn('weekly', 'Weekly')}
          {toggleBtn('monthly', 'Monthly')}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {card('Best week', `${fmtWk(bestWeekKey)} ${bestWeekVal > 0 ? '+$' + bestWeekVal : '—'}`, '#1D9E75')}
          {card('Worst week', `${fmtWk(worstWeekKey)} ${worstWeekVal < 0 ? '-$' + Math.abs(worstWeekVal) : '—'}`, '#E24B4A')}
        </div>
      </div>

      {data.length === 0 ? (
        <div style={{ padding: '40px 0', textAlign: 'center', color: '#444', fontSize: 13 }}>No closed trades in this period</div>
      ) : (<>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, color: '#555', marginBottom: 10, fontWeight: 500 }}>Cumulative P&L</div>
          <div style={{ position: 'relative', width: '100%', height: 220 }}><canvas ref={cumulRef} /></div>
        </div>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, color: '#555', marginBottom: 10, fontWeight: 500 }}>Net P&L per {chartView === 'daily' ? 'day' : chartView === 'weekly' ? 'week' : 'month'}</div>
          <div style={{ position: 'relative', width: '100%', height: 260 }}><canvas ref={dailyRef} /></div>
        </div>
      </>)}

      {/* Day of week + time breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ background: '#111', border: '1px solid #222', borderRadius: 8, padding: '14px 16px' }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: '#888', marginBottom: 12 }}>By day of week</div>
          {dayStats.map((d, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: '#666', width: 28 }}>{d.label}</span>
              <div style={{ flex: 1, height: 6, background: '#1a1a1a', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: d.trades ? Math.max(d.wr, 4) + '%' : '0%', height: '100%', background: d.wr >= 50 ? '#1D9E75' : '#E24B4A', borderRadius: 3 }} />
              </div>
              <span style={{ fontSize: 11, color: d.wr >= 50 ? '#1D9E75' : d.trades ? '#E24B4A' : '#444', width: 32, textAlign: 'right' }}>{d.trades ? d.wr + '%' : '—'}</span>
              <span style={{ fontSize: 11, color: d.net >= 0 ? '#1D9E75' : '#E24B4A', width: 60, textAlign: 'right' }}>{d.trades ? (d.net >= 0 ? '+$' : '-$') + Math.abs(d.net) : '—'}</span>
            </div>
          ))}
        </div>
        <div style={{ background: '#111', border: '1px solid #222', borderRadius: 8, padding: '14px 16px' }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: '#888', marginBottom: 12 }}>By time of day (EST)</div>
          {timeStats.map((d, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: '#666', width: 40 }}>{d.label}</span>
              <div style={{ flex: 1, height: 6, background: '#1a1a1a', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: d.trades ? Math.max(d.wr, 4) + '%' : '0%', height: '100%', background: d.wr >= 50 ? '#1D9E75' : '#E24B4A', borderRadius: 3 }} />
              </div>
              <span style={{ fontSize: 11, color: d.wr >= 50 ? '#1D9E75' : d.trades ? '#E24B4A' : '#444', width: 32, textAlign: 'right' }}>{d.trades ? d.wr + '%' : '—'}</span>
              <span style={{ fontSize: 11, color: d.net >= 0 ? '#1D9E75' : '#E24B4A', width: 60, textAlign: 'right' }}>{d.trades ? (d.net >= 0 ? '+$' : '-$') + Math.abs(d.net) : '—'}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
