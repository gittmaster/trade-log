import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import TOSUploader from '../components/TOSUploader';
import { supabase } from '../supabase';

function StatCard({ label, value, color }) {
  return (
    <div style={{ background: '#111', border: '1px solid #222', borderRadius: 8, padding: '10px 14px' }}>
      <div style={{ fontSize: 11, color: '#bbb', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: color || '#fff' }}>{value}</div>
    </div>
  );
}

function ChartCanvas({ id, build }) {
  const ref       = useRef(null);
  const inst      = useRef(null);
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

// ─── Month label helper ────────────────────────────────────────────────────────
function fmtMonth(iso) {
  if (!iso) return '—';
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}


// ─── TOS Daily Calendar ────────────────────────────────────────────────────────
const MONTH_NAMES_CAL = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DOW_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function TOSCalendar({ trips }) {
  const now = new Date();
  const [navYear,  setNavYear]  = useState(now.getFullYear());
  const [navMonth, setNavMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState(null);
  const [viewAcct, setViewAcct] = useState('both');

  const goMonth = (dir) => {
    let m = navMonth + dir, y = navYear;
    if (m > 11) { m = 0; y++; }
    if (m < 0)  { m = 11; y--; }
    setNavMonth(m); setNavYear(y);
  };

  // Filter trips by account
  const visibleTrips = trips.filter(t => {
    if (viewAcct === 'both') return true;
    return (t.account || '').toUpperCase() === viewAcct.toUpperCase();
  });

  // Build day map for current nav month
  const dayMap = {};
  visibleTrips.forEach(t => {
    if (!t.entry_dt) return;
    const d = new Date(t.entry_dt);
    if (d.getFullYear() !== navYear || d.getMonth() !== navMonth) return;
    const day = d.getDate();
    if (!dayMap[day]) dayMap[day] = { pnl: 0, trades: 0, wins: 0, items: [] };
    dayMap[day].pnl    += t.pnl;
    dayMap[day].trades += 1;
    if (t.pnl > 0) dayMap[day].wins += 1;
    dayMap[day].items.push(t);
  });

  const monthNet   = Object.values(dayMap).reduce((s, d) => s + d.pnl, 0);
  const tradeDays  = Object.keys(dayMap).length;
  const monthWins  = Object.values(dayMap).filter(d => d.pnl > 0).length;
  const fmt = v => (v >= 0 ? '+$' : '-$') + Math.abs(Math.round(v)).toLocaleString();
  const fmtSmall = v => (v >= 0 ? '+$' : '-$') + Math.abs(Math.round(v)).toLocaleString();

  const firstDay    = new Date(navYear, navMonth, 1).getDay();
  const daysInMonth = new Date(navYear, navMonth + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const accounts = [...new Set(trips.map(t => t.account).filter(Boolean))];

  return (
    <div style={{ background: '#111', border: '1px solid #222', borderRadius: 8, padding: '14px 16px', marginTop: 12 }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <button onClick={() => goMonth(-1)} style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 6, color: '#888', fontSize: 16, cursor: 'pointer', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#ccc', minWidth: 130, textAlign: 'center' }}>{MONTH_NAMES_CAL[navMonth]} {navYear}</span>
        <button onClick={() => goMonth(1)} style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 6, color: '#888', fontSize: 16, cursor: 'pointer', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
        <button onClick={() => { setNavMonth(now.getMonth()); setNavYear(now.getFullYear()); }} style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 6, color: '#888', fontSize: 12, cursor: 'pointer', padding: '4px 12px', fontWeight: 600 }}>This month</button>

        {/* Account filter */}
        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
          {['both', ...accounts].map(a => (
            <button key={a} onClick={() => setViewAcct(a)} style={{
              padding: '4px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontWeight: 600,
              border: '1px solid', borderColor: viewAcct === a ? '#185FA5' : '#2a2a2a',
              background: viewAcct === a ? '#185FA522' : 'transparent',
              color: viewAcct === a ? '#85B7EB' : '#666',
            }}>{a === 'both' ? 'Both' : a}</button>
          ))}
        </div>

        {/* Monthly stats */}
        <span style={{ background: monthNet >= 0 ? '#1D9E7522' : '#E24B4A22', color: monthNet >= 0 ? '#1D9E75' : '#E24B4A', borderRadius: 20, padding: '3px 12px', fontSize: 13, fontWeight: 700 }}>{fmt(monthNet)}</span>
        <span style={{ background: '#1a1a1a', color: '#888', borderRadius: 20, padding: '3px 10px', fontSize: 12 }}>{tradeDays} days</span>
        <span style={{ background: '#1a1a1a', color: '#888', borderRadius: 20, padding: '3px 10px', fontSize: 12 }}>{monthWins}/{tradeDays} green</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'start' }}>
        <div>
          {/* Day of week headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 3 }}>
            {DOW_SHORT.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#555', padding: '3px 0' }}>{d}</div>
            ))}
          </div>
          {/* Weeks */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {weeks.map((week, wi) => (
              <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
                {week.map((day, di) => {
                  if (!day) return <div key={di} style={{ minHeight: 72 }} />;
                  const d = dayMap[day];
                  const isToday = now.getFullYear() === navYear && now.getMonth() === navMonth && now.getDate() === day;
                  const isSelected = selectedDay === day;
                  let bg = '#0d0d0d', borderColor = '#1e1e1e';
                  if (d) { bg = d.pnl >= 0 ? '#1D9E7510' : '#E24B4A0e'; borderColor = d.pnl >= 0 ? '#1D9E7535' : '#E24B4A35'; }
                  if (isToday) borderColor = '#185FA5';
                  if (isSelected) borderColor = '#C9973A';
                  const wr = d ? Math.round(d.wins / d.trades * 100) : 0;
                  return (
                    <div key={di}
                      onClick={() => d && setSelectedDay(selectedDay === day ? null : day)}
                      style={{
                        background: bg, border: `${isToday || isSelected ? '1.5px' : '1px'} solid ${borderColor}`,
                        borderRadius: 6, padding: '4px 6px', minHeight: 72,
                        display: 'flex', flexDirection: 'column', gap: 2,
                        cursor: d ? 'pointer' : 'default', transition: 'all 0.1s',
                      }}
                      onMouseEnter={e => { if (d) e.currentTarget.style.borderColor = '#555'; }}
                      onMouseLeave={e => { if (d && !isSelected) e.currentTarget.style.borderColor = borderColor; }}
                    >
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#555', textAlign: 'right' }}>{day}</span>
                      {d && (<>
                        <span style={{ fontSize: 13, fontWeight: 700, color: d.pnl >= 0 ? '#1D9E75' : '#E24B4A' }}>{fmtSmall(d.pnl)}</span>
                        <span style={{ fontSize: 11, color: '#666' }}>{d.trades} trade{d.trades !== 1 ? 's' : ''}</span>
                        <span style={{ fontSize: 11, color: '#666' }}>{wr}%</span>
                      </>)}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Week summaries */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 22 }}>
          {weeks.map((week, wi) => {
            let wNet = 0, wDays = 0;
            week.forEach(day => { if (day && dayMap[day]) { wNet += dayMap[day].pnl; wDays++; } });
            return (
              <div key={wi} style={{ background: '#0d0d0d', border: '1px solid #1e1e1e', borderRadius: 6, padding: '6px 10px', minWidth: 90, minHeight: 72, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#444' }}>Week {wi + 1}</span>
                {wDays > 0 ? (<>
                  <span style={{ fontSize: 16, fontWeight: 700, color: wNet >= 0 ? '#1D9E75' : '#E24B4A' }}>{fmt(wNet)}</span>
                  <span style={{ fontSize: 11, color: '#555' }}>{wDays} day{wDays !== 1 ? 's' : ''}</span>
                </>) : <span style={{ fontSize: 13, color: '#333' }}>—</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Day detail panel */}
      {selectedDay && dayMap[selectedDay] && (() => {
        const d = dayMap[selectedDay];
        const dow = new Date(navYear, navMonth, selectedDay).toLocaleDateString('en-US', { weekday: 'long' });
        return (
          <div style={{ marginTop: 14, background: '#0d0d0d', border: '1px solid #2a2a2a', borderRadius: 8, padding: '12px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#ccc' }}>{dow}, {MONTH_NAMES_CAL[navMonth]} {selectedDay}</span>
                <span style={{ marginLeft: 10, fontSize: 14, fontWeight: 700, color: d.pnl >= 0 ? '#1D9E75' : '#E24B4A' }}>{fmt(d.pnl)}</span>
              </div>
              <button onClick={() => setSelectedDay(null)} style={{ background: 'none', border: 'none', color: '#555', fontSize: 18, cursor: 'pointer' }}>×</button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>{['Time','Acct','Symbol','Dir','Entry','Exit','P&L','Hold'].map(h => (
                  <th key={h} style={{ padding: '5px 8px', textAlign: 'left', color: '#444', fontSize: 10, textTransform: 'uppercase', borderBottom: '1px solid #1e1e1e' }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {d.items.sort((a,b) => new Date(a.entry_dt) - new Date(b.entry_dt)).map((t, i) => {
                  const entryTime = t.entry_dt ? new Date(t.entry_dt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) : '—';
                  const holdStr = t.duration_hrs > 0 ? (t.duration_hrs < 1 ? Math.round(t.duration_hrs * 60) + 'm' : Math.round(t.duration_hrs * 10) / 10 + 'h') : '—';
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #181818' }}>
                      <td style={{ padding: '7px 8px', color: '#666' }}>{entryTime}</td>
                      <td style={{ padding: '7px 8px' }}><span style={{ background: '#1a2535', color: '#85B7EB', borderRadius: 4, padding: '1px 6px', fontSize: 11, fontWeight: 700 }}>{t.account}</span></td>
                      <td style={{ padding: '7px 8px', color: '#ccc', fontWeight: 700 }}>{t.symbol}</td>
                      <td style={{ padding: '7px 8px', color: t.direction === 'long' ? '#1D9E75' : '#E24B4A', fontWeight: 700, textTransform: 'uppercase', fontSize: 11 }}>{t.direction}</td>
                      <td style={{ padding: '7px 8px', color: '#aaa', fontFamily: 'monospace' }}>{t.entry}</td>
                      <td style={{ padding: '7px 8px', color: '#aaa', fontFamily: 'monospace' }}>{t.exit || '—'}</td>
                      <td style={{ padding: '7px 8px', fontWeight: 700, color: t.pnl > 0 ? '#1D9E75' : '#E24B4A', fontFamily: 'monospace' }}>{t.pnl >= 0 ? '+$' : '-$'}{Math.abs(Math.round(t.pnl)).toLocaleString()}</td>
                      <td style={{ padding: '7px 8px', color: '#555' }}>{holdStr}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })()}
    </div>
  );
}


// ─── Markdown renderer ────────────────────────────────────────────────────────
function renderMarkdown(text) {
  if (!text) return null;
  const lines = text.split('\n');
  const elements = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.includes('|') && i + 1 < lines.length && lines[i+1].match(/^[|\s\-:]+$/)) {
      const tableLines = [line];
      i += 2;
      while (i < lines.length && lines[i].includes('|')) { tableLines.push(lines[i]); i++; }
      const headers = tableLines[0].split('|').map(h => h.trim()).filter(Boolean);
      const rows = tableLines.slice(1).map(r => r.split('|').map(c => c.trim()).filter(Boolean));
      elements.push(
        <div key={i} style={{ overflowX: 'auto', margin: '8px 0' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
            <thead><tr>{headers.map((h, hi) => (
              <th key={hi} style={{ padding: '6px 10px', textAlign: 'left', borderBottom: '1px solid #333', color: '#ccc', fontWeight: 600, whiteSpace: 'nowrap', background: '#1a1a1a' }}>{h}</th>
            ))}</tr></thead>
            <tbody>{rows.map((row, ri) => (
              <tr key={ri} style={{ borderBottom: '1px solid #222' }}>
                {row.map((cell, ci) => {
                  const isNeg = /^-\$/.test(cell); const isPos = /^\+?\$[0-9]/.test(cell) && !isNeg;
                  return <td key={ci} style={{ padding: '6px 10px', color: isPos ? '#1D9E75' : isNeg ? '#E24B4A' : '#bbb', whiteSpace: 'nowrap' }}>{cell}</td>;
                })}
              </tr>
            ))}</tbody>
          </table>
        </div>
      );
      continue;
    }
    if (line.match(/^#{1,3}\s/)) { elements.push(<div key={i} style={{ fontWeight: 700, color: '#ccc', marginTop: 10, marginBottom: 4, fontSize: 13 }}>{line.replace(/^#{1,3}\s/, '')}</div>); i++; continue; }
    if (line.match(/^[\-\*]\s/)) { elements.push(<div key={i} style={{ paddingLeft: 12, color: '#bbb', fontSize: 13, lineHeight: 1.6 }}>• {inlineFmt(line.slice(2))}</div>); i++; continue; }
    if (!line.trim()) { elements.push(<div key={i} style={{ height: 6 }} />); i++; continue; }
    elements.push(<div key={i} style={{ color: '#bbb', fontSize: 13, lineHeight: 1.6 }}>{inlineFmt(line)}</div>);
    i++;
  }
  return <div>{elements}</div>;
}
function inlineFmt(text) {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((p, i) => i % 2 === 1 ? <strong key={i} style={{ color: '#ccc' }}>{p}</strong> : p);
}

export default function Analysis({ filteredTrades, dateLabel, acctLabel, dateRange, account, tosData, setTosData }) {
  const [savedStatements, setSavedStatements] = useState([]);  // [{id, account, month, data}]
  const [loadingDB, setLoadingDB]             = useState(true);
  const [saveMsg, setSaveMsg]                 = useState('');
  const [selectedMonths, setSelectedMonths]   = useState([]); // months toggled on in history panel
  const [activeTab, setActiveTab]             = useState('charts'); // 'charts' | 'aichat'

  // ─── AI Chat state ──────────────────────────────────────────────────────────
  const [chatMessages, setChatMessages] = useState([
    { role: 'assistant', content: "Hi! I'm your TOS Analysis assistant. I have full access to your imported broker statements — ask me anything about your equity curve, commissions, symbols, or month-over-month performance." }
  ]);
  const [chatInput, setChatInput]   = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  // ─── Load Chart.js ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (window.Chart) return;
    const existing = document.getElementById('chartjs-cdn');
    if (existing) return;
    const s = document.createElement('script');
    s.id  = 'chartjs-cdn';
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js';
    document.head.appendChild(s);
  }, []);

  // ─── Load saved statements from Supabase on mount ──────────────────────────
  useEffect(() => {
    async function load() {
      setLoadingDB(true);
      const { data, error } = await supabase
        .from('tos_statements')
        .select('*')
        .order('month', { ascending: false });
      if (!error && data) {
        setSavedStatements(data);
        // Auto-load the most recent statement into tosData if nothing loaded yet
        if (data.length > 0 && !tosData) {
          const merged = mergeStatements(data);
          setTosData(merged);
        }
      }
      setLoadingDB(false);
    }
    load();
  }, []);

  // ─── Merge multiple saved statement rows into one tosData object ────────────
  function mergeStatements(rows) {
    const allTrips    = rows.flatMap(r => r.data?.trips    || []);
    const allEquity   = rows.flatMap(r => r.data?.equityCurve || [])
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    const symMap = {};
    allTrips.forEach(t => { symMap[t.symbol] = (symMap[t.symbol] || 0) + t.pnl; });
    return {
      account:     [...new Set(allTrips.map(t => t.account))].join('+'),
      trips:       allTrips,
      equityCurve: allEquity,
      symMap,
      totalComm:   allTrips.reduce((s, t) => s + (t.comm || 0), 0),
      netPnl:      allTrips.reduce((s, t) => s + t.pnl, 0),
      wins:        allTrips.filter(t => t.pnl > 0).length,
      total:       allTrips.length,
      avgHold:     allTrips.length ? allTrips.reduce((s, t) => s + (t.duration_hrs || 0), 0) / allTrips.length : 0,
    };
  }

  // ─── Handle new TOS import — save to Supabase ──────────────────────────────
  const handleImport = useCallback(async (parsed) => {
    const trips = parsed.roundTrips || [];
    if (!trips.length) return;

    const taggedTrips = trips.map(t => ({ ...t, account: parsed.account }));
    const eqMap = {};
    (parsed.cashBalances || []).forEach(b => { eqMap[b.date] = b.balance; });
    const equityCurve = Object.entries(eqMap)
      .sort((a, b) => new Date(a[0]) - new Date(b[0]))
      .map(([date, balance]) => ({ date, balance, account: parsed.account }));

    // Derive month from first trip date
    let month = 'unknown';
    if (taggedTrips[0]?.entry_dt) {
      const d = new Date(taggedTrips[0].entry_dt);
      month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }

    const payload = {
      account: parsed.account,
      month,
      data: { trips: taggedTrips, equityCurve },
    };

    setSaveMsg('Saving…');

    // Upsert — one row per account+month
    const { error } = await supabase
      .from('tos_statements')
      .upsert(payload, { onConflict: 'account,month' });

    if (error) {
      setSaveMsg('❌ Save failed: ' + error.message);
    } else {
      setSaveMsg('✅ Saved to Supabase');
      // Refresh saved list
      const { data: refreshed } = await supabase
        .from('tos_statements')
        .select('*')
        .order('month', { ascending: false });
      if (refreshed) {
        setSavedStatements(refreshed);
        const merged = mergeStatements(refreshed);
        setTosData(merged);
      }
    }
    setTimeout(() => setSaveMsg(''), 3000);

    // Also update local tosData immediately
    setTosData(prev => {
      const prevTrips  = prev?.trips || [];
      const otherTrips = prevTrips.filter(t => t.account !== parsed.account);
      const allTrips   = [...otherTrips, ...taggedTrips];
      const prevEquity = (prev?.equityCurve || []).filter(e => e.account !== parsed.account);
      const allEquity  = [...prevEquity, ...equityCurve].sort((a,b) => new Date(a.date) - new Date(b.date));
      const symMap = {};
      allTrips.forEach(t => { symMap[t.symbol] = (symMap[t.symbol] || 0) + t.pnl; });
      return {
        account:     allTrips.map(t => t.account).filter((v,i,a) => a.indexOf(v)===i).join('+'),
        trips:       allTrips,
        equityCurve: allEquity,
        symMap,
        totalComm:   allTrips.reduce((s, t) => s + (t.comm || 0), 0),
        netPnl:      allTrips.reduce((s, t) => s + t.pnl, 0),
        wins:        allTrips.filter(t => t.pnl > 0).length,
        total:       allTrips.length,
        avgHold:     allTrips.reduce((s, t) => s + (t.duration_hrs || 0), 0) / allTrips.length,
      };
    });
  }, [setTosData]);

  // ─── Toggle month selection in history panel ────────────────────────────────
  const toggleMonth = (id) => {
    setSelectedMonths(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      // Merge selected rows and push into tosData
      const rows = next.length > 0
        ? savedStatements.filter(r => next.includes(r.id))
        : savedStatements; // if none selected, show all
      setTosData(mergeStatements(rows));
      return next;
    });
  };

  // ─── Delete a saved statement ───────────────────────────────────────────────
  const deleteStatement = async (id) => {
    if (!window.confirm('Delete this statement?')) return;
    await supabase.from('tos_statements').delete().eq('id', id);
    const updated = savedStatements.filter(r => r.id !== id);
    setSavedStatements(updated);
    setTosData(updated.length ? mergeStatements(updated) : null);
    setSelectedMonths(prev => prev.filter(x => x !== id));
  };

  // ─── AI Chat — scroll to bottom ────────────────────────────────────────────
  useEffect(() => {
    if (activeTab === 'aichat') chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, activeTab]);

  // ─── AI Chat — send message with TOS context ────────────────────────────────
  const sendChat = useCallback(async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;
    setChatInput('');
    const userMsg = { role: 'user', content: text };
    setChatMessages(prev => [...prev, userMsg]);
    setChatLoading(true);

    // Build TOS context summary
    const tosContext = (() => {
      if (!tosData?.trips?.length) return 'No TOS statements have been imported yet.';
      const trips = tosData.trips;
      const netPnl = trips.reduce((s, t) => s + t.pnl, 0);
      const winTrips  = trips.filter(t => t.pnl > 0);
      const lossTrips = trips.filter(t => t.pnl <= 0);
      const wr     = trips.length ? Math.round(winTrips.length / trips.length * 100) : 0;
      const comm   = trips.reduce((s, t) => s + (t.comm || 0), 0);

      // Symbol breakdown
      const symMap = {};
      trips.forEach(t => { symMap[t.symbol] = (symMap[t.symbol] || 0) + t.pnl; });
      const symSummary = Object.entries(symMap).map(([s, p]) => `${s}: ${p >= 0 ? '+' : ''}$${Math.round(p)}`).join(', ');

      // Hold time: winners vs losers
      const fmtHrs = h => h < 1 ? `${Math.round(h * 60)}min` : `${Math.round(h * 10) / 10}hrs`;
      const winHrs  = winTrips.filter(t => t.duration_hrs > 0).map(t => t.duration_hrs);
      const lossHrs = lossTrips.filter(t => t.duration_hrs > 0).map(t => t.duration_hrs);
      const avgWinHold  = winHrs.length  ? winHrs.reduce((s,h)=>s+h,0)  / winHrs.length  : null;
      const avgLossHold = lossHrs.length ? lossHrs.reduce((s,h)=>s+h,0) / lossHrs.length : null;
      const holdSummary = (avgWinHold !== null && avgLossHold !== null)
        ? `Avg hold — Winners: ${fmtHrs(avgWinHold)}, Losers: ${fmtHrs(avgLossHold)}`
        : 'Hold time data available on individual trades';

      // Direction breakdown
      const longTrips  = trips.filter(t => t.direction === 'long');
      const shortTrips = trips.filter(t => t.direction === 'short');
      const longPnl    = longTrips.reduce((s,t) => s+t.pnl, 0);
      const shortPnl   = shortTrips.reduce((s,t) => s+t.pnl, 0);
      const longWR     = longTrips.length  ? Math.round(longTrips.filter(t=>t.pnl>0).length  / longTrips.length  * 100) : 0;
      const shortWR    = shortTrips.length ? Math.round(shortTrips.filter(t=>t.pnl>0).length / shortTrips.length * 100) : 0;

      // Month breakdown
      const monthMap = {};
      trips.forEach(t => {
        if (!t.entry_dt) return;
        const dt = t.entry_dt instanceof Date ? t.entry_dt : new Date(t.entry_dt);
        const m = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`;
        if (!monthMap[m]) monthMap[m] = { pnl: 0, wins: 0, total: 0, holdWin: [], holdLoss: [] };
        monthMap[m].pnl   += t.pnl;
        monthMap[m].wins  += t.pnl > 0 ? 1 : 0;
        monthMap[m].total += 1;
        if (t.duration_hrs > 0) {
          if (t.pnl > 0) monthMap[m].holdWin.push(t.duration_hrs);
          else monthMap[m].holdLoss.push(t.duration_hrs);
        }
      });
      const monthLines = Object.entries(monthMap)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([m, d]) => {
          const mWH = d.holdWin.length  ? fmtHrs(d.holdWin.reduce((s,h)=>s+h,0)/d.holdWin.length)   : '—';
          const mLH = d.holdLoss.length ? fmtHrs(d.holdLoss.reduce((s,h)=>s+h,0)/d.holdLoss.length) : '—';
          return `  ${m}: ${d.pnl >= 0 ? '+' : ''}$${Math.round(d.pnl)}, ${d.total}t, ${Math.round(d.wins/d.total*100)}% WR, avg hold win=${mWH} loss=${mLH}`;
        })
        .join('\n');

      // Equity curve summary
      const eq = tosData.equityCurve || [];
      const eqSummary = eq.length
        ? `Equity curve: ${eq.length} data points, start $${Math.round(eq[0]?.balance||0).toLocaleString()}, end $${Math.round(eq[eq.length-1]?.balance||0).toLocaleString()}`
        : 'No equity curve data.';

      // All individual trades (capped at 200 for context size)
      const tradeLines = trips.slice(0, 200).map(t => {
        const dt = t.entry_dt instanceof Date ? t.entry_dt.toISOString().slice(0,16) : String(t.entry_dt||'').slice(0,16);
        const hold = t.duration_hrs > 0 ? fmtHrs(t.duration_hrs) : '—';
        return `  ${dt} ${t.symbol} ${t.direction||''} P&L:${t.pnl>=0?'+':''}$${Math.round(t.pnl)} hold:${hold}`;
      }).join('\n');

      return `TOS BROKER STATEMENT DATA:
- Accounts: ${[...new Set(trips.map(t => t.account))].join(', ')}
- Total trades: ${trips.length} (${winTrips.length}W / ${lossTrips.length}L)
- Net P&L: ${netPnl >= 0 ? '+' : ''}$${Math.round(netPnl).toLocaleString()}
- Win rate: ${wr}%
- Commissions paid: -$${Math.round(comm).toLocaleString()}
- By symbol: ${symSummary}
- Longs: ${longTrips.length}t, ${longWR}% WR, ${longPnl>=0?'+':''}$${Math.round(longPnl)}
- Shorts: ${shortTrips.length}t, ${shortWR}% WR, ${shortPnl>=0?'+':''}$${Math.round(shortPnl)}
- ${holdSummary}
- ${eqSummary}

Month-over-month (with avg hold times per outcome):
${monthLines || '  (no monthly data)'}

All trades (entry date, symbol, direction, P&L, hold time):
${tradeLines}`;
    })();

    const systemPrompt = `You are a trading performance analyst assistant embedded in a trading journal app.
You have access to the user's ThinkOrSwim (TOS) broker account statement data shown below.
Answer questions about their performance, equity curve, commissions, symbols, and patterns.
Be concise, specific, and use the actual numbers from the data. Format dollar amounts with $ signs.
If asked something the data doesn't cover, say so clearly.

IMPORTANT FORMATTING RULES:
- Always use markdown tables (with | pipes and --- separator row) when showing comparisons, monthly breakdowns, or multi-column data.
- Use **bold** for key metrics and section headers.
- Use bullet points (- item) for lists.
- Never apologize for not being able to show tables — always use pipe-format markdown tables.

${tosContext}`;

    try {
      const history = chatMessages.filter(m => m.role !== 'system').slice(-10);
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.REACT_APP_ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: systemPrompt,
          messages: [...history, userMsg],
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || `API error ${response.status}`);
      const reply = data.content?.find(b => b.type === 'text')?.text || 'No response.';
      setChatMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (err) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: '❌ Error: ' + err.message }]);
    }
    setChatLoading(false);
  }, [chatInput, chatLoading, chatMessages, tosData]);

  // ─── Filter trips by date range + account ──────────────────────────────────
  const filteredTrips = useMemo(() => {
    if (!tosData?.trips) return [];
    return tosData.trips.filter(t => {
      if (account && account !== 'both') {
        if ((t.account || '').toUpperCase() !== account.toUpperCase()) return false;
      }
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

  // ─── Chart builders (unchanged) ────────────────────────────────────────────
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

  const buildMultiday = useCallback((canvas) => {
    if (!filteredTrips.length) return null;
    const multiday = filteredTrips
      .filter(t => (t.duration_hrs || 0) >= 20)
      .sort((a, b) => b.duration_hrs - a.duration_hrs)
      .slice(0, 5);
    if (!multiday.length) return null;
    const colors = ['#185FA5', '#1D9E75', '#BA7517', '#E24B4A', '#7c3aed'];
    const datasets = multiday.map((t, i) => {
      const points = (t.pnl_points && t.pnl_points.length > 2) ? t.pnl_points.map(p => p.pnl) : [0, t.pnl];
      return {
        label: `${t.symbol} ${t.direction} ${t.pnl >= 0 ? '+' : ''}$${Math.round(t.pnl)} (${Math.round(t.duration_hrs)}h)`,
        data: points, borderColor: colors[i], borderWidth: 2, pointRadius: 4, fill: false,
        borderDash: i === 0 ? [] : i === 1 ? [5, 3] : [2, 2],
      };
    });
    const maxLen = Math.max(...datasets.map(d => d.data.length));
    const labels = ['Entry', ...Array.from({ length: maxLen - 2 }, (_, i) => `Day ${i + 1}`), 'Exit'].slice(0, maxLen);
    return new window.Chart(canvas, {
      type: 'line',
      data: { labels, datasets },
      options: { ...baseOpts(), plugins: { legend: { display: true, labels: { color: 'rgba(255,255,255,0.45)', font: { size: 10 }, boxWidth: 10 } }, tooltip: { ...baseOpts().plugins.tooltip, callbacks: { label: c => ` ${c.dataset.label}: ${c.parsed.y >= 0 ? '+' : ''}$${Math.round(c.parsed.y).toLocaleString()}` } } } },
    });
  }, [filteredTrips]);

  const fmtPnl = v => (v >= 0 ? '+$' : '-$') + Math.abs(Math.round(v)).toLocaleString();
  const tw = filteredTrips.filter(t => t.pnl > 0).length;
  const tt = filteredTrips.length;
  const tn = filteredTrips.reduce((s, t) => s + t.pnl, 0);
  const tc = filteredTrips.reduce((s, t) => s + (t.comm || 0), 0);
  const loadedAccounts = tosData ? [...new Set((tosData.trips || []).map(t => t.account))].join(' + ') : null;

  // ─── Month-over-month summary ───────────────────────────────────────────────
  const monthSummary = useMemo(() => {
    const map = {};
    savedStatements.forEach(row => {
      const trips = row.data?.trips || [];
      const pnl   = trips.reduce((s, t) => s + t.pnl, 0);
      const wins  = trips.filter(t => t.pnl > 0).length;
      const key   = `${row.account}|${row.month}`;
      map[key] = { id: row.id, account: row.account, month: row.month, pnl, trades: trips.length, wins };
    });
    return Object.values(map).sort((a, b) => b.month.localeCompare(a.month));
  }, [savedStatements]);

  // Hide global floating AI bot while on Analysis page
  useEffect(() => {
    const btn = document.getElementById('global-ai-chat-btn');
    if (btn) btn.style.display = 'none';
    return () => { if (btn) btn.style.display = ''; };
  }, []);

  return (
    <div style={{ padding: '16px 20px' }}>
      {/* Header + Tab bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 500, color: '#ccc', marginBottom: 2 }}>Analysis</div>
          <div style={{ fontSize: 12, color: '#555' }}>{dateLabel} · {acctLabel}</div>
        </div>
        <div style={{ display: 'flex', gap: 4, background: '#111', border: '1px solid #222', borderRadius: 8, padding: 4 }}>
          <button
            onClick={() => setActiveTab('charts')}
            style={{
              padding: '6px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
              background: activeTab === 'charts' ? '#1a1a2a' : 'transparent',
              color: activeTab === 'charts' ? '#ccc' : '#555',
              transition: 'all 0.15s',
            }}>
            📊 Charts
          </button>
          <button
            onClick={() => setActiveTab('aichat')}
            style={{
              padding: '6px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
              background: activeTab === 'aichat' ? '#1a1a2a' : 'transparent',
              color: activeTab === 'aichat' ? '#1D9E75' : '#555',
              transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
            📈 AI Analysis
            {!tosData && <span style={{ fontSize: 10, color: '#444' }}>(no data)</span>}
          </button>
        </div>
      </div>

      {/* ── Import + History row — always visible ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>

        {/* Import panel */}
        <div style={{ background: '#111', border: '1px solid #222', borderRadius: 8, padding: '12px 14px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#ccc', marginBottom: 8 }}>
            📊 Import TOS Account Statement
            {loadedAccounts && <span style={{ marginLeft: 8, fontSize: 11, color: '#1D9E75' }}>✅ {loadedAccounts}</span>}
            {saveMsg && <span style={{ marginLeft: 8, fontSize: 11, color: saveMsg.startsWith('❌') ? '#E24B4A' : '#1D9E75' }}>{saveMsg}</span>}
          </div>
          <TOSUploader trades={filteredTrades} onComplete={handleImport} />
          <div style={{ fontSize: 11, color: '#444', marginTop: 8 }}>Imports are saved to Supabase and persist across sessions.</div>
        </div>

        {/* Month-over-month history panel */}
        <div style={{ background: '#111', border: '1px solid #222', borderRadius: 8, padding: '12px 14px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#ccc', marginBottom: 8 }}>
            📅 Statement History
            {loadingDB && <span style={{ marginLeft: 8, fontSize: 11, color: '#555' }}>Loading…</span>}
            {monthSummary.length > 0 && <span style={{ marginLeft: 8, fontSize: 11, color: '#555' }}>{monthSummary.length} months · click to toggle</span>}
          </div>

          {!loadingDB && monthSummary.length === 0 && (
            <div style={{ fontSize: 12, color: '#444', padding: '12px 0' }}>No statements saved yet — import one above.</div>
          )}

          {monthSummary.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 220, overflowY: 'auto' }}>
              {monthSummary.map(row => {
                const selected = selectedMonths.length === 0 || selectedMonths.includes(row.id);
                const wr = row.trades ? Math.round(row.wins / row.trades * 100) : 0;
                return (
                  <div key={row.id}
                    onClick={() => toggleMonth(row.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '6px 10px', borderRadius: 6, cursor: 'pointer',
                      background: selected ? '#1a1a2a' : '#0d0d0d',
                      border: `1px solid ${selected ? '#185FA5' : '#1a1a1a'}`,
                      transition: 'all 0.12s',
                    }}>
                    <span style={{ fontSize: 10, color: '#185FA5', fontWeight: 700, width: 20 }}>{row.account}</span>
                    <span style={{ fontSize: 12, color: '#ccc', flex: 1 }}>{fmtMonth(row.month + '-01')}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: row.pnl >= 0 ? '#1D9E75' : '#E24B4A', width: 70, textAlign: 'right' }}>{fmtPnl(row.pnl)}</span>
                    <span style={{ fontSize: 11, color: '#888', width: 40, textAlign: 'right' }}>{wr}% WR</span>
                    <span style={{ fontSize: 11, color: '#555', width: 24, textAlign: 'right' }}>{row.trades}t</span>
                    <button
                      onClick={e => { e.stopPropagation(); deleteStatement(row.id); }}
                      style={{ background: 'none', border: 'none', color: '#333', cursor: 'pointer', fontSize: 14, padding: '0 2px', lineHeight: 1 }}
                      title="Delete">×</button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Month-over-month P&L bar */}
          {monthSummary.length > 1 && (
            <div style={{ marginTop: 12, borderTop: '1px solid #1a1a1a', paddingTop: 10 }}>
              <div style={{ fontSize: 11, color: '#555', marginBottom: 6 }}>Monthly P&L trend</div>
              <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 48 }}>
                {[...monthSummary].reverse().map(row => {
                  const max = Math.max(...monthSummary.map(r => Math.abs(r.pnl)), 1);
                  const pct = Math.abs(row.pnl) / max;
                  return (
                    <div key={row.id} title={`${fmtMonth(row.month + '-01')}: ${fmtPnl(row.pnl)}`}
                      style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <div style={{ width: '100%', background: row.pnl >= 0 ? '#1D9E75' : '#E24B4A', borderRadius: '3px 3px 0 0', height: Math.max(pct * 36, 3), opacity: 0.8 }} />
                      <div style={{ fontSize: 9, color: '#555', whiteSpace: 'nowrap', overflow: 'hidden', maxWidth: '100%', textAlign: 'center' }}>{fmtMonth(row.month + '-01').split(' ')[0]}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── CHARTS TAB ── */}
      {activeTab === 'charts' && (
        <>
          {!tosData && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#444', fontSize: 13 }}>
              {loadingDB ? 'Loading saved statements…' : 'Upload a TOS account statement above to see charts'}
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

              {/* ── TOS Daily Calendar ── */}
              <div style={{ background: '#111', border: '1px solid #222', borderRadius: 8, padding: '12px 14px', marginTop: 12 }}>
                <div style={{ fontSize: 11, color: '#bbb', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                  Daily P&L Calendar — TOS Broker Data
                </div>
                <div style={{ fontSize: 11, color: '#444', marginBottom: 8 }}>Click any day to see trade details</div>
                <TOSCalendar trips={filteredTrips} />
              </div>
            </>
          )}
        </>
      )}

      {/* ── AI CHAT TAB ── */}
      {activeTab === 'aichat' && (
        <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 260px)', minHeight: 400 }}>
          {/* Context indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '8px 12px', background: '#0d1a14', border: '1px solid #163d26', borderRadius: 8 }}>
            <span style={{ fontSize: 18 }}>📈</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#1D9E75' }}>TOS Statement AI — Context loaded</div>
              <div style={{ fontSize: 11, color: '#4a7a5e' }}>
                {tosData?.trips?.length
                  ? `${tosData.trips.length} trades · ${[...new Set(tosData.trips.map(t => t.account))].join(', ')} · Net ${tosData.netPnl >= 0 ? '+' : ''}$${Math.round(tosData.netPnl || 0).toLocaleString()}`
                  : 'No TOS data loaded — import a statement above first'}
              </div>
            </div>
            <button
              onClick={() => setChatMessages([{ role: 'assistant', content: "Chat cleared. Ask me anything about your TOS broker statements." }])}
              style={{ background: 'none', border: '1px solid #163d26', borderRadius: 6, color: '#4a7a5e', fontSize: 11, padding: '4px 8px', cursor: 'pointer' }}>
              Clear
            </button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 8 }}>
            {chatMessages.map((msg, i) => (
              <div key={i} style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}>
                {msg.role === 'assistant' && (
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#0d1a14', border: '1px solid #163d26', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0, marginRight: 8, marginTop: 2 }}>📈</div>
                )}
                <div style={{
                  maxWidth: '75%', padding: '10px 14px', borderRadius: msg.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                  background: msg.role === 'user' ? '#185FA5' : '#131313',
                  border: msg.role === 'user' ? 'none' : '1px solid #222',
                  fontSize: 13, color: '#ddd', lineHeight: 1.5,
                  whiteSpace: msg.role === 'user' ? 'pre-wrap' : 'normal',
                }}>
                  {msg.role === 'assistant' ? renderMarkdown(msg.content) : msg.content}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#0d1a14', border: '1px solid #163d26', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>📈</div>
                <div style={{ padding: '10px 14px', background: '#131313', border: '1px solid #222', borderRadius: '12px 12px 12px 4px', fontSize: 13, color: '#555' }}>
                  Analyzing your data…
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Suggested prompts — show only when no user messages yet */}
          {chatMessages.filter(m => m.role === 'user').length === 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              {[
                'How did I perform month over month?',
                'Which symbol made me the most money?',
                'How much did I pay in commissions?',
                'What was my best and worst month?',
              ].map(q => (
                <button key={q} onClick={() => { setChatInput(q); }}
                  style={{ fontSize: 12, padding: '6px 10px', background: '#111', border: '1px solid #222', borderRadius: 20, color: '#888', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input bar */}
          <div style={{ display: 'flex', gap: 8, paddingTop: 8, borderTop: '1px solid #1a1a1a' }}>
            <input
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
              placeholder={tosData ? 'Ask about your TOS data…' : 'Import a TOS statement first…'}
              disabled={chatLoading}
              style={{
                flex: 1, background: '#111', border: '1px solid #222', borderRadius: 8,
                color: '#ccc', fontSize: 13, padding: '10px 14px', outline: 'none',
              }}
            />
            <button
              onClick={sendChat}
              disabled={chatLoading || !chatInput.trim()}
              style={{
                padding: '10px 18px', background: chatLoading || !chatInput.trim() ? '#111' : '#1D9E75',
                border: '1px solid #222', borderRadius: 8, color: chatLoading || !chatInput.trim() ? '#444' : '#fff',
                fontSize: 13, fontWeight: 600, cursor: chatLoading || !chatInput.trim() ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s',
              }}>
              {chatLoading ? '…' : 'Send'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
