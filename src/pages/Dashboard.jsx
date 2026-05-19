import React, { useState } from 'react';
import { GRADE_COLORS, GRADES, SESSIONS, TIERS, TIER_COLORS } from '../App';

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

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
    <div style={{ background: '#111', border: '1px solid #222', borderRadius: 8, padding: '12px 14px', gridColumn: 'span 2' }}>
      <div style={{ fontSize: 11, color: '#bbb', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>By Tier (AL / SL)</div>
      <div style={{ fontSize: 12, color: '#444' }}>No tier data yet</div>
    </div>
  );
  return (
    <div style={{ background: '#111', border: '1px solid #222', borderRadius: 8, padding: '12px 14px', gridColumn: 'span 2' }}>
      <div style={{ fontSize: 11, color: '#bbb', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>By Tier (AL / SL)</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 20px' }}>
        {[['Action Line', alData], ['Safety Line', slData]].map(([title, data]) => (
          <div key={title}>
            <div style={{ fontSize: 10, color: '#fff', marginBottom: 4 }}>{title}</div>
            {data.map((row, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: '#ccc', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: row.color, display: 'inline-block' }} />
                  {row.label} <span style={{ color: '#444', fontSize: 10 }}>({row.count})</span>
                </span>
                <span style={{ fontSize: 12, color: row.wr >= 50 ? '#1D9E75' : '#E24B4A' }}>{row.wr}% · {row.net >= 0 ? '+' : ''}${row.net}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function ProgressCalendar({ trades, dateRange }) {
  const closed = trades.filter(t => t.pnl !== null && t.date);
  const now = new Date();
  const [calYear, setCalYear] = useState(dateRange.start.getFullYear());
  const [calMonth, setCalMonth] = useState(dateRange.start.getMonth());
  const [open, setOpen] = useState(true);

  const changeMonth = (dir) => {
    setCalMonth(m => {
      let nm = m + dir;
      if (nm > 11) { setCalYear(y => y + 1); return 0; }
      if (nm < 0) { setCalYear(y => y - 1); return 11; }
      return nm;
    });
  };

  const dayMap = {};
  closed.forEach(t => {
    const [ty, tm, td] = t.date.split('-').map(Number);
    if (ty === calYear && tm - 1 === calMonth) {
      if (!dayMap[td]) dayMap[td] = { pnl: 0, count: 0, wins: 0 };
      dayMap[td].pnl += t.pnl;
      dayMap[td].count += 1;
      if (t.pnl > 0) dayMap[td].wins += 1;
    }
  });

  const monthNet = Object.values(dayMap).reduce((s, d) => s + d.pnl, 0);
  const tradeDays = Object.keys(dayMap).length;
  const fmt = (v) => (v >= 0 ? '+$' : '-$') + Math.abs(Math.round(v)).toLocaleString();

  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  if (!closed.length) return null;

  return (
    <div style={{ marginBottom: 20 }}>
      <div onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#111', border: '1px solid #222', borderRadius: open ? '8px 8px 0 0' : 8, padding: '10px 16px', cursor: 'pointer', userSelect: 'none' }}>
        <span style={{ fontWeight: 700, fontSize: 16, color: '#ccc' }}>📅 Progress</span>
        <span style={{ color: '#666', fontSize: 14, fontWeight: 600 }}>{open ? '▲ Hide' : '▼ Show'}</span>
      </div>
      {open && (
        <div style={{ border: '1px solid #222', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={e => { e.stopPropagation(); changeMonth(-1); }} style={{ background: 'transparent', border: '1px solid #2a2a2a', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', color: '#ccc' }}>‹</button>
              <span style={{ fontSize: 17, fontWeight: 700, color: '#ccc', minWidth: 130, textAlign: 'center' }}>{MONTH_NAMES[calMonth]} {calYear}</span>
              <button onClick={e => { e.stopPropagation(); changeMonth(1); }} style={{ background: 'transparent', border: '1px solid #2a2a2a', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', color: '#ccc' }}>›</button>
              <button onClick={e => { e.stopPropagation(); setCalYear(now.getFullYear()); setCalMonth(now.getMonth()); }} style={{ background: 'transparent', border: '1px solid #2a2a2a', borderRadius: 6, padding: '3px 12px', cursor: 'pointer', color: '#888', fontSize: 13, fontWeight: 600 }}>This month</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#aaa' }}>Monthly:</span>
              <span style={{ background: monthNet >= 0 ? '#1D9E7522' : '#E24B4A22', color: monthNet >= 0 ? '#1D9E75' : '#E24B4A', borderRadius: 20, padding: '3px 12px', fontSize: 15, fontWeight: 700 }}>{fmt(monthNet)}</span>
              <span style={{ background: '#1a1a1a', color: '#ccc', borderRadius: 20, padding: '3px 12px', fontSize: 14, fontWeight: 600 }}>{tradeDays} days</span>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 0, alignItems: 'start' }}>
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 3 }}>
                {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                  <div key={d} style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#aaa', padding: '3px 0' }}>{d}</div>
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {weeks.map((week, wi) => (
                  <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
                    {week.map((day, di) => {
                      if (!day) return <div key={di} style={{ minHeight: 68 }} />;
                      const d = dayMap[day];
                      const isToday = now.getFullYear() === calYear && now.getMonth() === calMonth && now.getDate() === day;
                      let bg = '#111', borderColor = '#1e1e1e';
                      if (d) { bg = d.pnl >= 0 ? '#1D9E7512' : '#E24B4A10'; borderColor = d.pnl >= 0 ? '#1D9E7535' : '#E24B4A35'; }
                      if (isToday) borderColor = '#185FA5';
                      const wr = d && d.count ? Math.round(d.wins / d.count * 100) : 0;
                      return (
                        <div key={di} style={{ background: bg, border: `${isToday ? '1.5px' : '1px'} solid ${borderColor}`, borderRadius: 6, padding: '4px 6px', minHeight: 68, display: 'flex', flexDirection: 'column', gap: 2, position: 'relative' }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#aaa', textAlign: 'right' }}>{day}</span>
                          {d && (<>
                            <span style={{ fontSize: 14, fontWeight: 700, color: d.pnl >= 0 ? '#1D9E75' : '#E24B4A' }}>{d.pnl >= 0 ? '+$' : '-$'}{Math.abs(Math.round(d.pnl)).toLocaleString()}</span>
                            <span style={{ fontSize: 12, fontWeight: 600, color: '#999' }}>{d.count} trade{d.count !== 1 ? 's' : ''}</span>
                            <span style={{ fontSize: 12, fontWeight: 600, color: '#999' }}>{wr}%</span>
                            {d.pnl < 0 && <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#E24B4A', position: 'absolute', bottom: 4, left: 6 }} />}
                          </>)}
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
  );
}

export default function Dashboard({ filteredTrades, dateLabel, acctLabel, dateRange }) {
  const closed = filteredTrades.filter(t => t.pnl !== null);
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

  const symbols = [...new Set(filteredTrades.map(t => t.symbol === 'OTHER' ? (t.custom_symbol || 'OTHER') : t.symbol))];

  return (
    <div style={{ padding: '16px 20px' }}>
      {/* Page header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 500, color: '#ccc', marginBottom: 2 }}>Dashboard</div>
        <div style={{ fontSize: 12, color: '#555' }}>{dateLabel} · {acctLabel}</div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 16 }}>
        <StatCard label="Total Trades" value={filteredTrades.length} />
        <StatCard label="Win Rate" value={wr !== null ? wr + '%' : '—'} color={wr >= 50 ? '#1D9E75' : wr !== null ? '#E24B4A' : undefined} />
        <StatCard label="Net P&L" value={closed.length ? (net >= 0 ? '+$' : '-$') + Math.abs(Math.round(net)).toLocaleString() : '$0'} color={net > 0 ? '#1D9E75' : net < 0 ? '#E24B4A' : undefined} />
        <StatCard label="Avg Winner" value={avgW !== null ? '+$' + avgW : '—'} color="#1D9E75" />
        <StatCard label="Avg Loser" value={avgL !== null ? '-$' + Math.abs(avgL) : '—'} color="#E24B4A" />
      </div>

      {/* Insight cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
        <InsightCard title="By Instrument" data={insightData('symbol', symbols.map(s => ({ k: s, l: s })))} />
        <InsightCard title="By Grade" data={insightData('grade', [{ k: 'aplus', l: 'A+' }, { k: 'a', l: 'A' }, { k: 'aminus', l: 'A-' }])} />
        <InsightCard title="By Safety Line" data={insightData('sl_quality', [{ k: 'strong', l: '★ Strong' }, { k: 'weak', l: 'Weak' }])} />
        <InsightCard title="By Session" data={insightData('session', SESSIONS.map(s => ({ k: s, l: s })))} />
        <TierInsightCard trades={filteredTrades} />
      </div>

      {/* Progress calendar */}
      <ProgressCalendar trades={filteredTrades} dateRange={dateRange} />
    </div>
  );
}
