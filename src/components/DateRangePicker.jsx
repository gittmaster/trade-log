import React, { useState, useRef, useEffect } from 'react';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHS_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

function fmt(d) {
  return MONTHS[d.getMonth()] + ' ' + String(d.getDate()).padStart(2, '0') + ', ' + d.getFullYear();
}

export default function DateRangePicker({ dateRange, setDateRange }) {
  const [open, setOpen] = useState(false);
  const [leftYear, setLeftYear] = useState(dateRange.start.getFullYear());
  const [leftMonth, setLeftMonth] = useState(dateRange.start.getMonth());
  const [tempStart, setTempStart] = useState(dateRange.start);
  const [tempEnd, setTempEnd] = useState(dateRange.end);
  const [selecting, setSelecting] = useState(false);
  const [activePreset, setActivePreset] = useState('month');
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const now = new Date();
  const presets = [
    { key: 'today', label: 'Today', fn: () => { const d = new Date(); return { s: d, e: d }; } },
    { key: 'week', label: 'This week', fn: () => {
      const d = new Date(), day = d.getDay(), diff = day === 0 ? -6 : 1 - day;
      const s = new Date(d); s.setDate(d.getDate() + diff); s.setHours(0,0,0,0);
      return { s, e: new Date() };
    }},
    { key: 'month', label: 'This month', fn: () => ({ s: new Date(now.getFullYear(), now.getMonth(), 1), e: new Date() }) },
    { key: '30days', label: 'Last 30 days', fn: () => { const s = new Date(); s.setDate(s.getDate() - 30); return { s, e: new Date() }; } },
    { key: 'lastmonth', label: 'Last month', fn: () => ({
      s: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      e: new Date(now.getFullYear(), now.getMonth(), 0),
    })},
    { key: 'quarter', label: 'This quarter', fn: () => {
      const q = Math.floor(now.getMonth() / 3);
      return { s: new Date(now.getFullYear(), q * 3, 1), e: new Date() };
    }},
    { key: 'ytd', label: 'YTD (year to date)', fn: () => ({ s: new Date(now.getFullYear(), 0, 1), e: new Date() }) },
  ];

  const rightMonth = leftMonth === 11 ? 0 : leftMonth + 1;
  const rightYear = leftMonth === 11 ? leftYear + 1 : leftYear;

  const navMonth = (dir) => {
    let m = leftMonth + dir, y = leftYear;
    if (m > 11) { m = 0; y++; }
    if (m < 0) { m = 11; y--; }
    setLeftMonth(m); setLeftYear(y);
  };

  const pickDay = (d) => {
    if (!selecting) {
      setTempStart(d); setTempEnd(null); setSelecting(true);
    } else {
      if (d < tempStart) { setTempEnd(tempStart); setTempStart(d); }
      else setTempEnd(d);
      setSelecting(false);
      setActivePreset(null);
    }
  };

  const applyPreset = (preset) => {
    const { s, e } = preset.fn();
    setTempStart(s); setTempEnd(e); setSelecting(false);
    setActivePreset(preset.key);
    setLeftMonth(s.getMonth()); setLeftYear(s.getFullYear());
  };

  const apply = () => {
    if (!tempStart) return;
    setDateRange({ start: tempStart, end: tempEnd || tempStart });
    setOpen(false);
  };

  const clearRange = (e) => {
    e.stopPropagation();
    const s = new Date(now.getFullYear(), now.getMonth(), 1);
    setDateRange({ start: s, end: new Date() });
    setTempStart(s); setTempEnd(new Date());
    setActivePreset('month');
  };

  const renderGrid = (year, month) => {
    const first = new Date(year, month, 1).getDay();
    const days = new Date(year, month + 1, 0).getDate();
    const prevDays = new Date(year, month, 0).getDate();
    const cells = [];

    DAYS.forEach(d => cells.push(<div key={'h'+d} style={{ fontSize: 12, color: '#555', textAlign: 'center', padding: '3px 0', fontWeight: 700 }}>{d}</div>));

    for (let i = 0; i < first; i++) {
      const day = new Date(year, month - 1, prevDays - first + i + 1);
      cells.push(dayCell(day, true));
    }
    for (let i = 1; i <= days; i++) {
      cells.push(dayCell(new Date(year, month, i), false));
    }
    const rem = 42 - first - days;
    for (let i = 1; i <= rem; i++) {
      cells.push(dayCell(new Date(year, month + 1, i), true));
    }
    return cells;
  };

  const dayCell = (d, other) => {
    const ts = d.getTime();
    const s = tempStart?.getTime();
    const e = (tempEnd || tempStart)?.getTime();
    const isStart = s && ts === s;
    const isEnd = e && ts === e;
    const inRange = s && e && ts > s && ts < e;

    let bg = 'transparent', color = other ? '#444' : '#ccc', radius = 4;
    if (isStart || isEnd) { bg = '#185FA5'; color = '#fff'; radius = isStart && isEnd ? 4 : isStart ? '4px 0 0 4px' : '0 4px 4px 0'; }
    else if (inRange) { bg = 'rgba(24,95,165,0.18)'; radius = 0; }

    return (
      <div key={ts} onClick={() => pickDay(d)} style={{
        fontSize: 14, textAlign: 'center', padding: '5px 2px', borderRadius: radius,
        cursor: 'pointer', color, background: bg, fontWeight: 700,
      }}
        onMouseEnter={e => { if (!isStart && !isEnd && !inRange) e.currentTarget.style.background = '#1a1a1a'; }}
        onMouseLeave={e => { if (!isStart && !isEnd && !inRange) e.currentTarget.style.background = 'transparent'; }}
      >
        {d.getDate()}
      </div>
    );
  };

  const label = `${fmt(dateRange.start)} – ${fmt(dateRange.end)}`;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div onClick={() => setOpen(o => !o)} style={{
        display: 'flex', alignItems: 'center', gap: 7, background: '#1a1a1a',
        border: '1px solid #2a2a2a', borderRadius: 8, padding: '5px 10px',
        cursor: 'pointer', fontSize: 15, fontWeight: 700, color: '#ccc', userSelect: 'none',
      }}>
        <i className="ti ti-calendar" style={{ fontSize: 16, color: '#666' }} />
        <span>{label}</span>
        <span onClick={clearRange} style={{ fontSize: 13, fontWeight: 700, color: '#555', marginLeft: 2 }}>
          <i className="ti ti-x" style={{ fontSize: 11 }} />
        </span>
        <i className="ti ti-chevron-down" style={{ fontSize: 12, color: '#555' }} />
      </div>

      {open && (
        <div style={{
          position: 'absolute', top: 38, left: 0, background: '#111', border: '1px solid #2a2a2a',
          borderRadius: 10, zIndex: 500, display: 'flex', flexDirection: 'column', minWidth: 620,
        }}>
          <div style={{ display: 'flex' }}>
            {/* Calendars */}
            <div style={{ padding: 16, display: 'flex', gap: 0 }}>
              {/* Left month */}
              <div style={{ width: 210 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#666', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontWeight: 700, color: '#aaa' }}>{tempStart ? fmt(tempStart) : '—'}</span>
                  <i className="ti ti-arrow-right" style={{ fontSize: 11 }} />
                  <span style={{ fontWeight: 700, color: '#aaa' }}>{tempEnd ? fmt(tempEnd) : '—'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <button onClick={() => navMonth(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666', fontSize: 14, padding: '2px 6px' }}>‹</button>
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#ccc' }}>{MONTHS_FULL[leftMonth]} {leftYear}</span>
                  <button onClick={() => navMonth(1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666', fontSize: 14, padding: '2px 6px' }}>›</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
                  {renderGrid(leftYear, leftMonth)}
                </div>
              </div>

              {/* Divider */}
              <div style={{ width: 1, background: '#222', margin: '0 16px' }} />

              {/* Right month */}
              <div style={{ width: 210 }}>
                <div style={{ height: 26, marginBottom: 10 }} />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ width: 28 }} />
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#ccc' }}>{MONTHS_FULL[rightMonth]} {rightYear}</span>
                  <div style={{ width: 28 }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
                  {renderGrid(rightYear, rightMonth)}
                </div>
              </div>
            </div>

            {/* Presets */}
            <div style={{ width: 160, borderLeft: '1px solid #222', padding: '12px 0', display: 'flex', flexDirection: 'column' }}>
              {presets.map(p => (
                <div key={p.key} onClick={() => applyPreset(p)} style={{
                  fontSize: 13, padding: '9px 16px', cursor: 'pointer',
                  color: activePreset === p.key ? '#185FA5' : '#888',
                  fontWeight: 700,
                  background: activePreset === p.key ? '#185FA511' : 'transparent',
                }}
                  onMouseEnter={e => { if (activePreset !== p.key) e.currentTarget.style.background = '#1a1a1a'; }}
                  onMouseLeave={e => { if (activePreset !== p.key) e.currentTarget.style.background = 'transparent'; }}
                >{p.label}</div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div style={{ padding: '10px 16px', borderTop: '1px solid #222', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button onClick={() => setOpen(false)} style={{ fontSize: 13, fontWeight: 700, padding: '5px 16px', borderRadius: 6, cursor: 'pointer', background: 'transparent', border: '1px solid #2a2a2a', color: '#888' }}>Cancel</button>
            <button onClick={apply} style={{ fontSize: 13, fontWeight: 700, padding: '5px 16px', borderRadius: 6, cursor: 'pointer', background: '#185FA5', border: 'none', color: '#fff' }}>Apply</button>
          </div>
        </div>
      )}
    </div>
  );
}
