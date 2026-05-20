import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';

export function defaultFilters() {
  return {
    instruments: [],
    tradeType:   null,
    openClosed:  null,
    reviewed:    null,
    side:        null,
    status:      null,
    tradeRating: null,
    sessions:    [],
    days:        [],
    hours:       [],
    strategies:  [],
    grade:       null,
    direction:   null,
    exitReason:  null,
  };
}

function countActive(f) {
  return [
    ...f.instruments,
    ...(f.tradeType  ? [f.tradeType]  : []),
    ...(f.openClosed ? [f.openClosed] : []),
    ...(f.reviewed   ? [f.reviewed]   : []),
    ...(f.side       ? [f.side]       : []),
    ...(f.status     ? [f.status]     : []),
    ...(f.tradeRating? [f.tradeRating]: []),
    ...f.sessions,
    ...f.days,
    ...f.hours,
    ...f.strategies,
    ...(f.grade      ? [f.grade]      : []),
    ...(f.direction  ? [f.direction]  : []),
    ...(f.exitReason ? [f.exitReason] : []),
  ].length;
}

function activeChipLabels(f, strategies) {
  return [
    ...f.instruments,
    ...(f.tradeType   ? [f.tradeType]   : []),
    ...(f.openClosed  ? [f.openClosed]  : []),
    ...(f.reviewed    ? [f.reviewed]    : []),
    ...(f.side        ? [f.side]        : []),
    ...(f.status      ? [f.status]      : []),
    ...(f.tradeRating ? [f.tradeRating] : []),
    ...f.sessions.map(s => s.split(' ')[0]),
    ...f.days.map(d => d.slice(0, 3)),
    ...f.hours,
    ...f.strategies.map(id => {
      const s = strategies.find(x => x.id === id);
      return s ? s.name : null;
    }).filter(Boolean),
    ...(f.grade      ? [`Grade: ${f.grade}`]     : []),
    ...(f.direction  ? [f.direction]              : []),
    ...(f.exitReason ? [`Exit: ${f.exitReason}`]  : []),
  ];
}

const S = {
  sidebar: {
    width: 210,
    background: '#0d0f14',
    borderRight: '0.5px solid #1e2530',
    padding: '10px 0',
    flexShrink: 0,
  },
  catRowBase: {
    display: 'flex', alignItems: 'center', gap: 11,
    padding: '13px 16px', cursor: 'pointer',
    borderRadius: 6, margin: '2px 8px',
    transition: 'background 0.15s',
  },
  rightPanel: {
    flex: 1, padding: '6px 20px 16px', overflowY: 'auto', maxHeight: 360,
  },
  sectionLabel: {
    fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
    textTransform: 'uppercase', color: '#7c3aed',
    margin: '14px 0 6px',
  },
  checkRowBase: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '9px 12px', cursor: 'pointer',
    borderRadius: 6, marginBottom: 3,
    transition: 'background 0.1s',
  },
};

function CheckRow({ label, checked, onChange }) {
  const [hov, setHov] = useState(false);
  return (
    <label
      style={{
        ...S.checkRowBase,
        background: checked ? '#1a1040' : hov ? '#13111e' : 'transparent',
        border: `0.5px solid ${checked ? '#4c1d95' : 'transparent'}`,
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      <span style={{
        width: 18, height: 18, borderRadius: 4, flexShrink: 0,
        border: `1.5px solid ${checked ? '#7c3aed' : '#2a3040'}`,
        background: checked ? '#7c3aed' : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.15s',
      }}>
        {checked && (
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <path d="M1.5 5.5l3 3 5-5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </span>
      <span style={{ fontSize: 13, fontWeight: 500, color: checked ? '#e2e8f0' : '#94a3b8' }}>
        {label}
      </span>
    </label>
  );
}

function SectionHead({ label }) {
  return <div style={S.sectionLabel}>{label}</div>;
}

function Divider() {
  return <div style={{ height: '0.5px', background: '#1e2530', margin: '8px 0' }} />;
}

const CATS = [
  { key: 'general',  label: 'General',    icon: '👥' },
  { key: 'daytime',  label: 'Day & Time', icon: '📅' },
  { key: 'strategy', label: 'Strategy',   icon: '📖' },
  { key: 'insights', label: 'Insights',   icon: '✨' },
];

const INSTRUMENTS = ['MGC', 'MNQ', 'MCL', 'MYM'];
const SESSIONS    = ['Morning 07–15 ✅', 'Late zone 15–19 ❌', 'Overnight 19–23 ✅', 'Dead zone 23–07 ❌'];
const DAYS        = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const HOURS       = ['07–09', '09–11', '11–13', '13–15', '19–23'];

export default function FilterBar({ filters, onChange }) {
  const [open,       setOpen]    = useState(false);
  const [activeCat,  setCat]     = useState('general');
  const [strategies, setStrats]  = useState([]);
  const ref = useRef(null);

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    supabase.from('strategies').select('id, name').then(({ data }) => {
      if (data) setStrats(data);
    });
  }, []);

  function toggle(key, val) {
    const cur = filters[key] || [];
    onChange({ ...filters, [key]: cur.includes(val) ? cur.filter(x => x !== val) : [...cur, val] });
  }
  function radio(key, val) {
    onChange({ ...filters, [key]: filters[key] === val ? null : val });
  }

  const activeCount = countActive(filters);
  const chips       = activeChipLabels(filters, strategies);

  const catActive = {
    general:  [filters.instruments, filters.tradeType, filters.openClosed, filters.reviewed, filters.side, filters.status, filters.tradeRating].flat().filter(Boolean).length,
    daytime:  [...filters.sessions, ...filters.days, ...filters.hours].length,
    strategy: filters.strategies.length,
    insights: [filters.grade, filters.direction, filters.exitReason].filter(Boolean).length,
  };

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 8 }}>

      {/* ── trigger ── */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '0 14px', height: 36, borderRadius: 8,
          background: open ? '#13111e' : '#111418',
          border: `0.5px solid ${open ? '#7c3aed' : '#252b35'}`,
          color: '#e2e8f0', cursor: 'pointer', fontSize: 13, fontWeight: 500,
          transition: 'all 0.15s', fontFamily: 'inherit',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M1 3h12M3 7h8M5 11h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        Filters
        {activeCount > 0 && (
          <span style={{
            background: '#7c3aed', color: '#fff', fontSize: 10, fontWeight: 700,
            minWidth: 18, height: 18, borderRadius: 9,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px',
          }}>
            {activeCount}
          </span>
        )}
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* ── chips ── */}
      {chips.slice(0, 4).map((label, i) => (
        <span key={i} style={{
          display: 'inline-flex', alignItems: 'center',
          padding: '3px 10px', background: '#1a1040',
          color: '#a78bfa', border: '0.5px solid #4c1d95',
          borderRadius: 99, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
        }}>
          {label}
        </span>
      ))}
      {chips.length > 4 && (
        <span style={{ fontSize: 11, color: '#5a6a7a' }}>+{chips.length - 4} more</span>
      )}
      {activeCount > 0 && (
        <button
          onClick={() => onChange(defaultFilters())}
          style={{
            padding: '3px 10px', borderRadius: 6,
            background: 'transparent', border: '0.5px solid #2a3040',
            color: '#6b7280', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit',
          }}
        >
          Clear all
        </button>
      )}

      {/* ── dropdown ── */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 1000,
          width: 560, background: '#0d0f14',
          border: '0.5px solid #252b35', borderRadius: 10,
          boxShadow: '0 16px 48px rgba(0,0,0,0.7)',
          overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', minHeight: 360 }}>

            {/* left sidebar */}
            <div style={S.sidebar}>
              {CATS.map(cat => {
                const isActive = activeCat === cat.key;
                const count    = catActive[cat.key];
                return (
                  <div
                    key={cat.key}
                    onClick={() => setCat(cat.key)}
                    style={{
                      ...S.catRowBase,
                      background: isActive ? '#3b1fa8' : 'transparent',
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#13111e'; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span style={{ fontSize: 15 }}>{cat.icon}</span>
                    <span style={{
                      flex: 1, fontSize: 13,
                      fontWeight: isActive ? 600 : 500,
                      color: isActive ? '#e2e8f0' : '#94a3b8',
                    }}>
                      {cat.label}
                    </span>
                    {count > 0 && (
                      <span style={{
                        background: isActive ? '#6d28d9' : '#2a1a4a',
                        color: '#a78bfa', fontSize: 10, fontWeight: 700,
                        minWidth: 18, height: 18, borderRadius: 9,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px',
                      }}>
                        {count}
                      </span>
                    )}
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ color: isActive ? '#a78bfa' : '#4a5568' }}>
                      {isActive
                        ? <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        : <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      }
                    </svg>
                  </div>
                );
              })}
            </div>

            {/* right panel */}
            <div style={S.rightPanel}>

              {/* GENERAL */}
              {activeCat === 'general' && (
                <div>
                  <SectionHead label="Instrument" />
                  {INSTRUMENTS.map(v => (
                    <CheckRow key={v} label={v}
                      checked={filters.instruments.includes(v)}
                      onChange={() => toggle('instruments', v)}
                    />
                  ))}
                  <Divider />
                  <SectionHead label="Intraday / Multiday" />
                  {['Intraday', 'Multiday'].map(v => (
                    <CheckRow key={v} label={v}
                      checked={filters.tradeType === v}
                      onChange={() => radio('tradeType', v)}
                    />
                  ))}
                  <Divider />
                  <SectionHead label="Open / Closed" />
                  {['Open', 'Closed'].map(v => (
                    <CheckRow key={v} label={v}
                      checked={filters.openClosed === v}
                      onChange={() => radio('openClosed', v)}
                    />
                  ))}
                  <Divider />
                  <SectionHead label="Reviewed / Unreviewed" />
                  {['Reviewed', 'Unreviewed'].map(v => (
                    <CheckRow key={v} label={v}
                      checked={filters.reviewed === v}
                      onChange={() => radio('reviewed', v)}
                    />
                  ))}
                  <Divider />
                  <SectionHead label="Side" />
                  {['Long', 'Short'].map(v => (
                    <CheckRow key={v} label={v}
                      checked={filters.side === v}
                      onChange={() => radio('side', v)}
                    />
                  ))}
                  <Divider />
                  <SectionHead label="Status" />
                  {['Winner', 'Loser', 'Breakeven'].map(v => (
                    <CheckRow key={v} label={v}
                      checked={filters.status === v}
                      onChange={() => radio('status', v)}
                    />
                  ))}
                  <Divider />
                  <SectionHead label="Trade rating" />
                  {['A+', 'A', 'A-'].map(v => (
                    <CheckRow key={v} label={v}
                      checked={filters.tradeRating === v}
                      onChange={() => radio('tradeRating', v)}
                    />
                  ))}
                </div>
              )}

              {/* DAY & TIME */}
              {activeCat === 'daytime' && (
                <div>
                  <SectionHead label="Session window" />
                  {SESSIONS.map(v => (
                    <CheckRow key={v} label={v}
                      checked={filters.sessions.includes(v)}
                      onChange={() => toggle('sessions', v)}
                    />
                  ))}
                  <Divider />
                  <SectionHead label="Day of week" />
                  {DAYS.map(v => (
                    <CheckRow key={v} label={v}
                      checked={filters.days.includes(v)}
                      onChange={() => toggle('days', v)}
                    />
                  ))}
                  <Divider />
                  <SectionHead label="Hour block" />
                  {HOURS.map(v => (
                    <CheckRow key={v} label={v}
                      checked={filters.hours.includes(v)}
                      onChange={() => toggle('hours', v)}
                    />
                  ))}
                </div>
              )}

              {/* STRATEGY */}
              {activeCat === 'strategy' && (
                <div>
                  <SectionHead label="Strategies" />
                  {strategies.length === 0 && (
                    <div style={{ fontSize: 13, color: '#5a6a7a', padding: '8px 0' }}>
                      No strategies found
                    </div>
                  )}
                  {strategies.map(s => (
                    <CheckRow key={s.id} label={s.name}
                      checked={filters.strategies.includes(s.id)}
                      onChange={() => toggle('strategies', s.id)}
                    />
                  ))}
                </div>
              )}

              {/* INSIGHTS */}
              {activeCat === 'insights' && (
                <div>
                  <SectionHead label="Grade" />
                  {['A+', 'A', 'A-'].map(v => (
                    <CheckRow key={v} label={v}
                      checked={filters.grade === v}
                      onChange={() => radio('grade', v)}
                    />
                  ))}
                  <Divider />
                  <SectionHead label="Direction" />
                  {['Long', 'Short'].map(v => (
                    <CheckRow key={v} label={v}
                      checked={filters.direction === v}
                      onChange={() => radio('direction', v)}
                    />
                  ))}
                  <Divider />
                  <SectionHead label="Exit reason" />
                  {['Target', 'Stop', 'Manual'].map(v => (
                    <CheckRow key={v} label={v}
                      checked={filters.exitReason === v}
                      onChange={() => radio('exitReason', v)}
                    />
                  ))}
                </div>
              )}

            </div>
          </div>

          {/* footer */}
          <div style={{
            borderTop: '0.5px solid #1e2530', padding: '10px 16px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: '#0a0c11',
          }}>
            <button
              onClick={() => onChange(defaultFilters())}
              style={{
                padding: '6px 14px', borderRadius: 6,
                background: 'transparent', border: '0.5px solid #2a3040',
                color: '#6b7280', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
              }}
            >
              Reset all
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {activeCount > 0 && (
                <span style={{ fontSize: 12, color: '#7c3aed' }}>{activeCount} active</span>
              )}
              <button
                onClick={() => setOpen(false)}
                style={{
                  padding: '6px 18px', borderRadius: 6,
                  background: '#7c3aed', border: 'none',
                  color: '#fff', cursor: 'pointer', fontSize: 12,
                  fontWeight: 600, fontFamily: 'inherit',
                }}
              >
                Apply filters
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
