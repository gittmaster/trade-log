import React, { useState, useEffect, useRef } from 'react';

const STRATEGY_COLORS = {
  'strat-aplus-prime':       '#1D9E75',
  'strat-strong-al-weak-sl': '#185FA5',
  'strat-weak-al-strong-sl': '#BA7517',
  'strat-both-weak':         '#E24B4A',
};

export default function Reports({ filteredTrades, dateLabel, acctLabel, strategies }) {
  const [tab, setTab] = useState('overview'); // 'overview' | 'strategy'
  const [chartView, setChartView] = useState('daily');
  const cumulRef = useRef(null);
  const dailyRef = useRef(null);
  const cumulInstance = useRef(null);
  const dailyInstance = useRef(null);
  const wrBarRef = useRef(null);
  const pnlBarRef = useRef(null);
  const donutRef = useRef(null);
  const wrBarInstance = useRef(null);
  const pnlBarInstance = useRef(null);
  const donutInstance = useRef(null);
  const [chartReady, setChartReady] = useState(!!window.Chart);

  const closed = filteredTrades.filter(t => t.pnl !== null && t.date);

  useEffect(() => {
    if (window.Chart) { setChartReady(true); return; }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js';
    script.onload = () => setChartReady(true);
    document.head.appendChild(script);
  }, []);

  // ─── Overview chart data ───────────────────────────────────────────────────
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
      if (chartView === 'daily') { const [, m, d] = k.split('-'); label = `${m}/${d}`; }
      else if (chartView === 'weekly') { const d = new Date(k + 'T12:00:00'); label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
      else { const [y, m] = k.split('-'); label = new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }); }
      return { key: k, label, daily, cumulative: Math.round(cum * 100) / 100 };
    });
  };

  // ─── Strategy stats ────────────────────────────────────────────────────────
  const effectiveStrategies = strategies && strategies.length > 0 ? strategies : [];

  const getStratStats = (stratId) => {
    const ts = closed.filter(t => t.strategy_id === stratId);
    if (!ts.length) return { trades: 0, wins: 0, losses: 0, totalPnl: 0, avgWin: 0, avgLoss: 0, pf: 0, wr: 0, longTrades: 0, shortTrades: 0 };
    const wins = ts.filter(t => t.pnl > 0);
    const losses = ts.filter(t => t.pnl < 0);
    const totalPnl = Math.round(ts.reduce((s, t) => s + t.pnl, 0));
    const avgWin = wins.length ? Math.round(wins.reduce((s, t) => s + t.pnl, 0) / wins.length) : 0;
    const avgLoss = losses.length ? Math.round(losses.reduce((s, t) => s + t.pnl, 0) / losses.length) : 0;
    const grossWin = wins.reduce((s, t) => s + t.pnl, 0);
    const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
    const pf = grossLoss > 0 ? Math.round((grossWin / grossLoss) * 100) / 100 : grossWin > 0 ? 999 : 0;
    const wr = Math.round(wins.length / ts.length * 100);
    return {
      trades: ts.length, wins: wins.length, losses: losses.length,
      totalPnl, avgWin, avgLoss, pf, wr,
      longTrades: ts.filter(t => t.direction === 'long').length,
      shortTrades: ts.filter(t => t.direction === 'short').length,
    };
  };

  const stratData = effectiveStrategies.map(s => ({ ...s, stats: getStratStats(s.id) }));
  const untaggedCount = closed.filter(t => !t.strategy_id).length;

  // What if only A+ Prime trades were taken
  const aprimeSt = getStratStats('strat-aplus-prime');
  const allPnl = Math.round(closed.reduce((s, t) => s + t.pnl, 0));
  const bothWeakSt = getStratStats('strat-both-weak');

  // ─── Draw overview charts ──────────────────────────────────────────────────
  useEffect(() => {
    if (!chartReady || tab !== 'overview' || !cumulRef.current || !dailyRef.current) return;
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
      data: { labels, datasets: [{ data: cumulValues, borderColor: lastVal >= 0 ? '#1D9E75' : '#E24B4A', borderWidth: 2, pointRadius: 0, pointHoverRadius: 5, fill: true, backgroundColor: grad, tension: 0.3 }] },
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
  }, [chartReady, filteredTrades, chartView, tab]);

  // ─── Draw strategy charts ──────────────────────────────────────────────────
  useEffect(() => {
    if (!chartReady || tab !== 'strategy' || !stratData.length) return;
    if (!wrBarRef.current || !pnlBarRef.current || !donutRef.current) return;

    if (wrBarInstance.current) { wrBarInstance.current.destroy(); wrBarInstance.current = null; }
    if (pnlBarInstance.current) { pnlBarInstance.current.destroy(); pnlBarInstance.current = null; }
    if (donutInstance.current) { donutInstance.current.destroy(); donutInstance.current = null; }

    const Chart = window.Chart;
    const labels = stratData.map(s => s.name);
    const colors = stratData.map(s => STRATEGY_COLORS[s.id] || '#888');

    // Win rate horizontal bar
    const wrCtx = wrBarRef.current.getContext('2d');
    wrBarInstance.current = new Chart(wrCtx, {
      type: 'bar',
      data: { labels, datasets: [{ data: stratData.map(s => s.stats.wr), backgroundColor: colors.map(c => c + 'cc'), borderColor: colors, borderWidth: 1, borderRadius: 4 }] },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false, layout: { padding: { right: 50 } },
        plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1a1a1a', borderColor: '#333', borderWidth: 1, callbacks: { label: ctx => ` ${ctx.raw}% win rate · ${stratData[ctx.dataIndex].stats.trades} trades` } } },
        scales: {
          x: { min: 0, max: 100, ticks: { color: '#555', font: { size: 11 }, callback: v => v + '%' }, grid: { color: 'rgba(255,255,255,0.05)' }, border: { display: false } },
          y: { ticks: { color: '#aaa', font: { size: 12 } }, grid: { display: false }, border: { display: false } }
        },
        animation: { onComplete: function() {
          const chart = this; const ctx = chart.ctx; ctx.save(); ctx.font = '500 11px sans-serif'; ctx.textBaseline = 'middle';
          chart.data.datasets.forEach((ds, i) => {
            const meta = chart.getDatasetMeta(i);
            meta.data.forEach((bar, idx) => {
              const v = ds.data[idx];
              ctx.fillStyle = v >= 50 ? '#1D9E75' : '#E24B4A';
              ctx.textAlign = 'left';
              ctx.fillText(v + '%', bar.x + 6, bar.y);
            });
          });
          ctx.restore();
        }}
      }
    });

    // Net P&L bar
    const pnlCtx = pnlBarRef.current.getContext('2d');
    const pnlVals = stratData.map(s => s.stats.totalPnl);
    pnlBarInstance.current = new Chart(pnlCtx, {
      type: 'bar',
      data: { labels, datasets: [{ data: pnlVals, backgroundColor: pnlVals.map(v => v >= 0 ? 'rgba(29,158,117,0.85)' : 'rgba(226,75,74,0.85)'), borderColor: pnlVals.map(v => v >= 0 ? '#0F6E56' : '#A32D2D'), borderWidth: 1, borderRadius: 4 }] },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false, layout: { padding: { right: 80 } },
        plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1a1a1a', borderColor: '#333', borderWidth: 1, callbacks: { label: ctx => ` ${ctx.raw >= 0 ? '+$' : '-$'}${Math.abs(ctx.raw).toLocaleString()}` } } },
        scales: {
          x: { ticks: { color: '#555', font: { size: 11 }, callback: v => (v >= 0 ? '+$' : '-$') + Math.abs(v).toLocaleString() }, grid: { color: 'rgba(255,255,255,0.05)' }, border: { display: false } },
          y: { ticks: { color: '#aaa', font: { size: 12 } }, grid: { display: false }, border: { display: false } }
        },
        animation: { onComplete: function() {
          const chart = this; const ctx = chart.ctx; ctx.save(); ctx.font = '500 11px sans-serif'; ctx.textBaseline = 'middle';
          chart.data.datasets.forEach((ds, i) => {
            const meta = chart.getDatasetMeta(i);
            meta.data.forEach((bar, idx) => {
              const v = ds.data[idx];
              ctx.fillStyle = v >= 0 ? '#1D9E75' : '#E24B4A';
              ctx.textAlign = 'left';
              ctx.fillText((v >= 0 ? '+$' : '-$') + Math.abs(v).toLocaleString(), bar.x + 6, bar.y);
            });
          });
          ctx.restore();
        }}
      }
    });

    // Trade distribution donut
    const donutCtx = donutRef.current.getContext('2d');
    const tradeCounts = stratData.map(s => s.stats.trades);
    donutInstance.current = new Chart(donutCtx, {
      type: 'doughnut',
      data: { labels, datasets: [{ data: tradeCounts, backgroundColor: colors.map(c => c + 'cc'), borderColor: colors, borderWidth: 2, hoverOffset: 6 }] },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '65%',
        plugins: {
          legend: { display: false },
          tooltip: { backgroundColor: '#1a1a1a', borderColor: '#333', borderWidth: 1, callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw} trades (${Math.round(ctx.raw / tradeCounts.reduce((a,b)=>a+b,0) * 100)}%)` } }
        }
      }
    });

    return () => {
      if (wrBarInstance.current) { wrBarInstance.current.destroy(); wrBarInstance.current = null; }
      if (pnlBarInstance.current) { pnlBarInstance.current.destroy(); pnlBarInstance.current = null; }
      if (donutInstance.current) { donutInstance.current.destroy(); donutInstance.current = null; }
    };
  }, [chartReady, filteredTrades, tab, strategies]);

  // ─── Overview stats ────────────────────────────────────────────────────────
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

  // ── Trade duration calc ───────────────────────────────────────────────────
  const tradesWithDuration = closed.filter(t => t.time && t.exit_time);
  const durations = tradesWithDuration.map(t => {
    const [eh, em] = t.time.split(':').map(Number);
    const [xh, xm] = t.exit_time.split(':').map(Number);
    return (xh * 60 + xm) - (eh * 60 + em);
  }).filter(d => d > 0);
  const avgDurMins = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null;
  const fmtDur = (mins) => mins >= 60 ? `${Math.floor(mins/60)}h ${mins%60}m` : `${mins}m`;
  const winDurs = closed.filter(t => t.time && t.exit_time && t.pnl > 0).map(t => {
    const [eh,em]=t.time.split(':').map(Number),[xh,xm]=t.exit_time.split(':').map(Number);
    return (xh*60+xm)-(eh*60+em);
  }).filter(d => d > 0);
  const lossDurs = closed.filter(t => t.time && t.exit_time && t.pnl < 0).map(t => {
    const [eh,em]=t.time.split(':').map(Number),[xh,xm]=t.exit_time.split(':').map(Number);
    return (xh*60+xm)-(eh*60+em);
  }).filter(d => d > 0);
  const avgWinDur = winDurs.length ? Math.round(winDurs.reduce((a,b)=>a+b,0)/winDurs.length) : null;
  const avgLossDur = lossDurs.length ? Math.round(lossDurs.reduce((a,b)=>a+b,0)/lossDurs.length) : null;


  const toggleBtn = (v, label) => (
    <button key={v} onClick={() => setChartView(v)} style={{ padding: '3px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: '1px solid', borderColor: chartView === v ? '#185FA5' : '#2a2a2a', background: chartView === v ? '#185FA522' : 'transparent', color: chartView === v ? '#185FA5' : '#666' }}>{label}</button>
  );

  const card = (label, value, color) => (
    <div style={{ background: '#111', border: '1px solid #222', borderRadius: 8, padding: '10px 14px' }}>
      <div style={{ fontSize: 14, color: '#fff', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 600, color: color || '#ccc' }}>{value}</div>
    </div>
  );

  const tabBtn = (v, label, icon) => (
    <button key={v} onClick={() => setTab(v)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: '1px solid', borderColor: tab === v ? '#185FA5' : '#2a2a2a', background: tab === v ? '#185FA522' : 'transparent', color: tab === v ? '#185FA5' : '#666' }}>
      <i className={`ti ${icon}`} style={{ fontSize: 15 }} />{label}
    </button>
  );

  return (
    <div style={{ padding: '16px 20px' }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 500, color: '#ccc', marginBottom: 2 }}>Reports</div>
        <div style={{ fontSize: 12, color: '#555' }}>{dateLabel} · {acctLabel}</div>
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {tabBtn('overview', 'Overview', 'ti-chart-line')}
        {tabBtn('strategy', 'By Strategy', 'ti-bulb')}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {tab === 'overview' && (<>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 20 }}>
          {card('Net P&L', (netPnl >= 0 ? '+$' : '-$') + Math.abs(netPnl).toLocaleString(), netPnl >= 0 ? '#1D9E75' : '#E24B4A')}
          {card('Avg win week', winWeeks.length ? '+$' + avgWinWeek : '—', '#1D9E75')}
          {card('Avg loss week', lossWeeks.length ? '-$' + Math.abs(avgLossWeek) : '—', '#E24B4A')}
          {card('Win / loss weeks', `${winWeeks.length}W · ${lossWeeks.length}L`, winWeeks.length >= lossWeeks.length ? '#1D9E75' : '#E24B4A')}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {toggleBtn('daily', 'Daily')}
            {toggleBtn('weekly', 'Weekly')}
            {toggleBtn('monthly', 'Monthly')}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {card('Best week', bestWeekKey ? `${fmtWk(bestWeekKey)} ${bestWeekVal >= 0 ? '+$' : '-$'}${Math.abs(bestWeekVal)}` : '—', '#1D9E75')}
            {card('Worst week', worstWeekKey ? `${fmtWk(worstWeekKey)} ${worstWeekVal >= 0 ? '+$' : '-$'}${Math.abs(worstWeekVal)}` : '—', '#E24B4A')}
          </div>
        </div>

        {data.length === 0 ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: '#444', fontSize: 13 }}>No closed trades in this period</div>
        ) : (<>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 12, color: '#555', marginBottom: 10, fontWeight: 500 }}>Cumulative P&L</div>
            <div style={{ position: 'relative', width: '100%', height: 220 }}><canvas ref={cumulRef} /></div>
          </div>
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 12, color: '#555', marginBottom: 10, fontWeight: 500 }}>Net P&L per {chartView === 'daily' ? 'day' : chartView === 'weekly' ? 'week' : 'month'}</div>
            <div style={{ position: 'relative', width: '100%', height: 260 }}><canvas ref={dailyRef} /></div>
          </div>
        </>)}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ background: '#111', border: '1px solid #222', borderRadius: 8, padding: '14px 16px' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#aaa', marginBottom: 12 }}>By day of week</div>
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
            <div style={{ fontSize: 13, fontWeight: 600, color: '#aaa', marginBottom: 12 }}>By time of day (EST)</div>
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
      </>)}


      {/* ── DURATION SECTION ── */}
      {tab === 'overview' && avgDurMins !== null && (
        <div style={{ background: '#111', border: '1px solid #222', borderRadius: 8, padding: '14px 16px', marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#aaa', marginBottom: 14 }}>Trade Duration ({tradesWithDuration.length} trades with exit time)</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
            <div style={{ background: '#1a1a1a', borderRadius: 8, padding: '10px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#555', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Avg Duration</div>
              <div style={{ fontSize: 20, fontWeight: 600, color: '#ccc' }}>{fmtDur(avgDurMins)}</div>
            </div>
            <div style={{ background: '#1a1a1a', borderRadius: 8, padding: '10px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#555', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Avg Winner</div>
              <div style={{ fontSize: 20, fontWeight: 600, color: '#1D9E75' }}>{avgWinDur !== null ? fmtDur(avgWinDur) : '—'}</div>
            </div>
            <div style={{ background: '#1a1a1a', borderRadius: 8, padding: '10px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#555', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Avg Loser</div>
              <div style={{ fontSize: 20, fontWeight: 600, color: '#E24B4A' }}>{avgLossDur !== null ? fmtDur(avgLossDur) : '—'}</div>
            </div>
          </div>
          {durations.length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: '#444', marginBottom: 8 }}>Duration distribution</div>
              <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 56 }}>
                {['0-30m','30-60m','1-2h','2-4h','4h+'].map((label, i) => {
                  const ranges = [[0,30],[30,60],[60,120],[120,240],[240,9999]];
                  const [lo,hi] = ranges[i];
                  const count = durations.filter(d => d >= lo && d < hi).length;
                  const pct = durations.length ? count / durations.length : 0;
                  return (
                    <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                      <div style={{ fontSize: 10, color: '#555' }}>{count || ''}</div>
                      <div style={{ width: '100%', background: '#185FA5', borderRadius: '3px 3px 0 0', height: Math.max(pct * 40, count ? 3 : 0) }} />
                      <div style={{ fontSize: 10, color: '#444', whiteSpace: 'nowrap' }}>{label}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── BY STRATEGY TAB ── */}
      {tab === 'strategy' && (<>

        {/* Insight cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 20 }}>
          {card('Total tagged trades', `${closed.filter(t => t.strategy_id).length} / ${closed.length}`, '#185FA5')}
          {card('If A+ Prime only', aprimeSt.trades > 0 ? `+$${aprimeSt.totalPnl.toLocaleString()} · ${aprimeSt.wr}% WR` : '—', '#1D9E75')}
          {card('Both Weak cost', bothWeakSt.trades > 0 ? (bothWeakSt.totalPnl >= 0 ? '+$' : '-$') + Math.abs(bothWeakSt.totalPnl).toLocaleString() + ` · ${bothWeakSt.trades} trades` : '—', bothWeakSt.totalPnl < 0 ? '#E24B4A' : '#555')}
          {card('Untagged trades', untaggedCount > 0 ? `${untaggedCount} — go to Strategies to assign` : 'All tagged ✓', untaggedCount > 0 ? '#BA7517' : '#1D9E75')}
        </div>

        {stratData.length === 0 ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: '#444', fontSize: 13 }}>No strategies found — go to the Strategies page to set them up.</div>
        ) : (<>

          {/* Strategy comparison table */}
          <div style={{ background: '#111', border: '1px solid #222', borderRadius: 8, overflow: 'hidden', marginBottom: 20 }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #222', fontSize: 13, fontWeight: 500, color: '#888' }}>Strategy comparison</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1a1a1a' }}>
                  {[['Strategy','left'],['Trades','right'],['Win rate','right'],['Net P&L','right'],['Avg winner','right'],['Avg loser','right'],['Profit factor','right'],['Long','right'],['Short','right']].map(([l,a]) => (
                    <th key={l} style={{ fontSize: 10, fontWeight: 500, color: '#444', padding: '8px 14px', textAlign: a, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{l}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stratData.map((s, i) => {
                  const st = s.stats;
                  const pnlColor = st.totalPnl > 0 ? '#1D9E75' : st.totalPnl < 0 ? '#E24B4A' : '#555';
                  const wrColor = st.wr >= 50 ? '#1D9E75' : st.trades > 0 ? '#E24B4A' : '#555';
                  const pfColor = st.pf >= 1 ? '#1D9E75' : st.pf > 0 ? '#E24B4A' : '#555';
                  const color = STRATEGY_COLORS[s.id] || '#888';
                  return (
                    <tr key={s.id} style={{ borderBottom: i < stratData.length - 1 ? '1px solid #1a1a1a' : 'none' }}>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0, display: 'inline-block' }} />
                          <span style={{ fontSize: 13, color: '#ccc' }}>{s.icon} {s.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 13, color: st.trades ? '#ccc' : '#444' }}>{st.trades || '—'}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 13, fontWeight: 500, color: wrColor }}>{st.trades ? st.wr + '%' : '—'}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 13, fontWeight: 500, color: pnlColor }}>{st.trades ? (st.totalPnl >= 0 ? '+$' : '-$') + Math.abs(st.totalPnl).toLocaleString() : '—'}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 13, color: st.avgWin > 0 ? '#1D9E75' : '#555' }}>{st.avgWin > 0 ? '+$' + st.avgWin : '—'}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 13, color: st.avgLoss < 0 ? '#E24B4A' : '#555' }}>{st.avgLoss < 0 ? '-$' + Math.abs(st.avgLoss) : '—'}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 13, fontWeight: 500, color: pfColor }}>{st.pf > 0 ? (st.pf === 999 ? '∞' : st.pf.toFixed(2)) : '—'}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 12, color: '#666' }}>{st.longTrades || '—'}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 12, color: '#666' }}>{st.shortTrades || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Charts row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            {/* Win rate chart */}
            <div style={{ background: '#111', border: '1px solid #222', borderRadius: 8, padding: '14px 16px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#aaa', marginBottom: 12 }}>Win rate by strategy</div>
              <div style={{ position: 'relative', width: '100%', height: stratData.length * 52 + 20 }}>
                <canvas ref={wrBarRef} />
              </div>
            </div>
            {/* Net P&L chart */}
            <div style={{ background: '#111', border: '1px solid #222', borderRadius: 8, padding: '14px 16px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#aaa', marginBottom: 12 }}>Net P&L by strategy</div>
              <div style={{ position: 'relative', width: '100%', height: stratData.length * 52 + 20 }}>
                <canvas ref={pnlBarRef} />
              </div>
            </div>
          </div>

          {/* Donut + direction breakdown */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Trade distribution donut */}
            <div style={{ background: '#111', border: '1px solid #222', borderRadius: 8, padding: '14px 16px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#aaa', marginBottom: 12 }}>Trade distribution</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ position: 'relative', width: 140, height: 140, flexShrink: 0 }}>
                  <canvas ref={donutRef} />
                </div>
                <div style={{ flex: 1 }}>
                  {stratData.map(s => {
                    const total = stratData.reduce((acc, x) => acc + x.stats.trades, 0);
                    const pct = total > 0 ? Math.round(s.stats.trades / total * 100) : 0;
                    const color = STRATEGY_COLORS[s.id] || '#888';
                    return (
                      <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 2, background: color, flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: '#888', flex: 1 }}>{s.name}</span>
                        <span style={{ fontSize: 12, fontWeight: 500, color: '#ccc' }}>{s.stats.trades}</span>
                        <span style={{ fontSize: 11, color: '#555', width: 30, textAlign: 'right' }}>{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Long vs Short per strategy */}
            <div style={{ background: '#111', border: '1px solid #222', borderRadius: 8, padding: '14px 16px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#aaa', marginBottom: 12 }}>Long vs Short per strategy</div>
              {stratData.map(s => {
                const total = s.stats.longTrades + s.stats.shortTrades;
                const longPct = total > 0 ? Math.round(s.stats.longTrades / total * 100) : 0;
                const color = STRATEGY_COLORS[s.id] || '#888';
                return (
                  <div key={s.id} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: '#888', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                        {s.name}
                      </span>
                      <span style={{ fontSize: 11, color: '#555' }}>{s.stats.longTrades}L · {s.stats.shortTrades}S</span>
                    </div>
                    <div style={{ height: 8, background: '#1a1a1a', borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
                      <div style={{ width: longPct + '%', background: '#1D9E75', borderRadius: '4px 0 0 4px' }} />
                      <div style={{ flex: 1, background: '#E24B4A', borderRadius: '0 4px 4px 0' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
                      <span style={{ fontSize: 10, color: '#1D9E75' }}>Long {longPct}%</span>
                      <span style={{ fontSize: 10, color: '#E24B4A' }}>Short {100 - longPct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>)}
      </>)}
    </div>
  );
}
