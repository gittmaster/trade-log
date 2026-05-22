import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from './supabase';
import { seedTrades } from './seedData';
import Login from './Login';
import Dashboard from './pages/Dashboard';
import Reports from './pages/Reports';
import TradeView from './pages/TradeView';
import Strategies from './pages/Strategies';
import Analysis  from './pages/Analysis';
import AIChat from './AIChat';
import DateRangePicker from './components/DateRangePicker';
import FilterBar, { defaultFilters } from './components/FilterBar';
import './App.css';

// ─── Constants ────────────────────────────────────────────────────────────────
export const GRADES       = { aplus: 'A+', a: 'A', aminus: 'A-' };
export const GRADE_COLORS = { aplus: '#1D9E75', a: '#185FA5', aminus: '#BA7517' };
export const SESSIONS     = ['Pre-open', 'Open', 'Mid-sess', 'Pre-mkt', 'Overnight', 'Late'];
export const TIERS        = ['Primary', 'Secondary', 'Tertiary'];
export const TIER_COLORS  = { Primary: '#1D9E75', Secondary: '#185FA5', Tertiary: '#E24B4A' };
export const SYMBOL_MULT  = { MGC: 10, MNQ: 2, MYM: 0.5, MCL: 100 };

export function getMultiplier(symbol, custom_multiplier) {
  if (SYMBOL_MULT[symbol]) return SYMBOL_MULT[symbol];
  return custom_multiplier ? parseFloat(custom_multiplier) : 1;
}

export function calcPnL(trade) {
  if (!trade.entry || !trade.exit_price) return null;
  const diff = trade.direction === 'long'
    ? trade.exit_price - trade.entry
    : trade.entry - trade.exit_price;
  const mult      = getMultiplier(trade.symbol, trade.custom_multiplier);
  const contracts = trade.contracts ? parseFloat(trade.contracts) : 1;
  return Math.round(diff * mult * contracts * 100) / 100;
}

export function getSession(time) {
  if (!time) return 'Mid-sess';
  const h = parseInt(time.split(':')[0]);
  if (h >= 7  && h < 9)  return 'Pre-open';
  if (h >= 9  && h < 11) return 'Open';
  if (h >= 11 && h < 15) return 'Mid-sess';
  if (h >= 15 && h < 19) return 'Late';
  if (h >= 19 && h < 23) return 'Pre-mkt';
  return 'Overnight';
}

export function autoGrade(al_strength, al_touches, al_age, sl_quality, sl_touches, sl_age) {
  const alStrong = al_strength === 'strong' && parseInt(al_touches) >= 3 && al_age === '1wk+';
  const slStrong = sl_quality === 'strong'  && parseInt(sl_touches) >= 3 && sl_age === '1wk+';
  if (alStrong && slStrong) return 'aplus';
  if (alStrong || slStrong) return 'a';
  return 'aminus';
}

export const EMPTY_FORM = {
  trade_number: '', date: new Date().toISOString().split('T')[0], time: '',
  account: 'A1', symbol: 'MGC', custom_symbol: '', custom_multiplier: '', contracts: '1',
  direction: 'long', entry: '', exit_price: '', stop: '', target: '',
  exit_reason: '', exit_time: '', exit_date: '',
  mfe_price: '', mae_price: '',
  al_strength: 'standard', al_touches: '', al_age: '<1wk', al_tier: 'Primary',
  sl_quality: 'weak',       sl_touches: '', sl_age: '<1wk', sl_tier: 'Primary',
  sl_price: '', grade: 'a', yellow_levels: '', confirmations: [], notes: '',
  chart_file: null, strategy_id: null,
};

// ─── Date helpers ─────────────────────────────────────────────────────────────
export function getDefaultDateRange() {
  const now   = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return { start, end: now };
}

export function filterTradesByRange(trades, dateRange, account) {
  return trades.filter(t => {
    if (!t.date) return false;
    const d         = new Date(t.date + 'T12:00:00');
    const inRange   = d >= dateRange.start && d <= dateRange.end;
    const inAccount = account === 'both' || t.account === account.toUpperCase();
    return inRange && inAccount;
  });
}

// ─── filter helpers (used by Dashboard) ──────────────────────────────────────
export function applyFilters(trades, f) {
  let t = [...trades];

  if (f.instruments?.length)
    t = t.filter(x => f.instruments.includes(x.symbol));

  if (f.tradeType === 'Intraday')  t = t.filter(x => !x.multiday);
  if (f.tradeType === 'Multiday')  t = t.filter(x =>  x.multiday);

  if (f.openClosed === 'Open')    t = t.filter(x => x.exit_price == null);
  if (f.openClosed === 'Closed')  t = t.filter(x => x.exit_price != null);

  if (f.reviewed === 'Reviewed')   t = t.filter(x =>  x.reviewed);
  if (f.reviewed === 'Unreviewed') t = t.filter(x => !x.reviewed);

  if (f.side)
    t = t.filter(x => x.direction?.toLowerCase() === f.side.toLowerCase());

  if (f.status === 'Winner')    t = t.filter(x => x.pnl > 0);
  if (f.status === 'Loser')     t = t.filter(x => x.pnl < 0);
  if (f.status === 'Breakeven') t = t.filter(x => x.pnl === 0);

  if (f.tradeRating) {
    const map = { 'A+': 'aplus', 'A': 'a', 'A-': 'aminus' };
    t = t.filter(x => x.grade === map[f.tradeRating]);
  }

  if (f.sessions?.length) {
    const sessionMap = {
      'Morning 07–15 ✅':   'Morning',
      'Late zone 15–19 ❌': 'Late Zone',
      'Overnight 19–23 ✅': 'Overnight',
      'Dead zone 23–07 ❌': 'Dead Zone',
    };
    const mapped = f.sessions.map(s => sessionMap[s]).filter(Boolean);
    if (mapped.length) t = t.filter(x => mapped.includes(x.session));
  }

  if (f.days?.length) {
    const DOW = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    t = t.filter(x => {
      if (!x.date) return false;
      const day = DOW[new Date(x.date + 'T12:00:00').getDay()];
      return f.days.includes(day);
    });
  }

  if (f.hours?.length) {
    t = t.filter(x => {
      if (!x.time) return false;
      const h = parseInt(x.time.split(':')[0], 10);
      return f.hours.some(block => {
        const start = parseInt(block.split('–')[0], 10);
        return h >= start && h < start + 2;
      });
    });
  }

  if (f.strategies?.length)
    t = t.filter(x => f.strategies.includes(x.strategy_id));

  if (f.grade) {
    const map = { 'A+': 'aplus', 'A': 'a', 'A-': 'aminus' };
    t = t.filter(x => x.grade === map[f.grade]);
  }

  if (f.direction)
    t = t.filter(x => x.direction?.toLowerCase() === f.direction.toLowerCase());

  if (f.exitReason)
    t = t.filter(x => x.exit_reason?.toLowerCase() === f.exitReason.toLowerCase());

  return t;
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [authed,         setAuthed]         = useState(() => sessionStorage.getItem('tl_auth') === '1');
  const [trades,         setTrades]         = useState([]);
  const [strategies,     setStrategies]     = useState(() => {
    try { return JSON.parse(localStorage.getItem('tl_strategies') || '[]'); } catch { return []; }
  });
  const [loading,        setLoading]        = useState(true);
  const [seeding,        setSeeding]        = useState(false);
  const [msg,            setMsg]            = useState('');
  const [page,           setPage]           = useState('dashboard');
  const [account,        setAccount]        = useState('both');
  const [dateRange,      setDateRange]      = useState(getDefaultDateRange());
  const [filters,        setFilters]        = useState(defaultFilters());
  const [chatOpen,       setChatOpen]       = useState(false);
  const [chatMaximized,  setChatMaximized]  = useState(false);
  const [tosData,        setTosData]        = useState(null);

  const loadTrades = useCallback(async () => {
    const { data, error } = await supabase
      .from('trades')
      .select('*')
      .order('date', { ascending: false })
      .order('time', { ascending: false });
    if (!error) setTrades(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadTrades(); }, [loadTrades]);

  const saveStrategies = (updated) => {
    setStrategies(updated);
    localStorage.setItem('tl_strategies', JSON.stringify(updated));
  };

  const seedDatabase = async () => {
    setSeeding(true); setMsg('Seeding trades...');
    const { error } = await supabase.from('trades').insert(seedTrades);
    if (error) { setMsg('Error: ' + error.message); }
    else        { setMsg('Trades loaded!'); await loadTrades(); }
    setSeeding(false);
    setTimeout(() => setMsg(''), 3000);
  };

  const exportCSV = () => {
    if (!trades.length) { alert('No trades to export'); return; }
    const headers = ['trade_number','date','time','account','symbol','direction','entry','exit_price','stop','target','exit_reason','al_strength','al_touches','al_age','al_tier','sl_quality','sl_touches','sl_age','sl_tier','sl_price','grade','session','yellow_levels','confirmations','notes','pnl','strategy_id'];
    const rows = trades.map(t => headers.map(h => {
      const v = t[h];
      if (v === null || v === undefined) return '';
      if (typeof v === 'string' && v.includes(',')) return '"' + v.replace(/"/g, '""') + '"';
      return v;
    }).join(','));
    const csv  = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'trades_' + new Date().toISOString().split('T')[0] + '.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // date + account filtered trades (passed to all pages)
  const filteredTrades = filterTradesByRange(trades, dateRange, account);

  // dashboard also gets the FilterBar selections applied on top
  const dashboardTrades = applyFilters(filteredTrades, filters);

  const fmtDate   = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const dateLabel = `${fmtDate(dateRange.start)} – ${fmtDate(dateRange.end)}`;
  const acctLabel = account === 'both' ? 'Both Accounts' : account.toUpperCase() + ' Only';

  const filteredProps = {
    trades, filteredTrades, loading,
    dateRange, account, dateLabel, acctLabel,
    strategies, saveStrategies,
    reloadTrades: loadTrades,
    msg, setMsg, seedDatabase, seeding, exportCSV,
  };

  const tradeViewProps = {
    ...filteredProps,
    // filteredTrades comes from filteredProps — respects date range + account filter
  };

  // Dashboard gets the extra-filtered trades
  const dashboardProps = {
    ...filteredProps,
    filteredTrades: dashboardTrades,
  };

  const navItems = [
    { id: 'dashboard', icon: 'ti-layout-dashboard', label: 'Dashboard'  },
    { id: 'reports',   icon: 'ti-chart-bar',         label: 'Reports'    },
    { id: 'analysis',  icon: 'ti-chart-dots',          label: 'Analysis'   },
    { id: 'tradeview', icon: 'ti-list',               label: 'Trade View' },
    { id: 'strategies',icon: 'ti-bulb',               label: 'Strategies' },
  ];

  if (!authed) return <Login onSuccess={() => setAuthed(true)} />;

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0a0a0a', overflow: 'hidden' }}>

      {/* ── Sidebar ── */}
      <div style={{
        width: 200, minWidth: 200, background: '#111',
        borderRight: '1px solid #222', display: 'flex',
        flexDirection: 'column', padding: '16px 0', flexShrink: 0,
      }}>
        <div style={{ padding: '0 16px 14px', borderBottom: '1px solid #222', marginBottom: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#ccc' }}>Trade Log</div>
          <div style={{ fontSize: 11, color: '#444', marginTop: 2 }}>Trendline Break Strategy</div>
        </div>

        <div style={{ fontSize: 10, color: '#fff', padding: '8px 16px 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Main</div>

        {navItems.map(item => (
          <div key={item.id} onClick={() => setPage(item.id)} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '9px 16px', cursor: 'pointer',
            color: '#fff',
            background:   page === item.id ? '#185FA511' : 'transparent',
            borderRight:  page === item.id ? '2px solid #185FA5' : '2px solid transparent',
            transition: 'all 0.12s',
            fontWeight: 500, fontSize: 14,
          }}
            onMouseEnter={e => { e.currentTarget.style.background = '#185FA50a'; }}
            onMouseLeave={e => { e.currentTarget.style.background = page === item.id ? '#185FA511' : 'transparent'; }}
          >
            <i className={`ti ${item.icon}`} style={{ fontSize: 16 }} />
            {item.label}
          </div>
        ))}

        <div style={{ fontSize: 10, color: '#fff', padding: '10px 16px 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Tools</div>

        <div onClick={() => setChatOpen(o => !o)} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '9px 16px', cursor: 'pointer',
          color: '#fff',
          background: chatOpen ? '#185FA511' : 'transparent',
          transition: 'all 0.12s',
          fontWeight: 500, fontSize: 14,
        }}
          onMouseEnter={e => { e.currentTarget.style.background = '#185FA50a'; }}
          onMouseLeave={e => { e.currentTarget.style.background = chatOpen ? '#185FA511' : 'transparent'; }}
        >
          <i className="ti ti-message" style={{ fontSize: 16 }} />
          AI Chat
        </div>

        <div style={{ marginTop: 'auto', padding: '12px 16px', borderTop: '1px solid #1a1a1a' }}>
          <div style={{ fontSize: 11, color: '#333' }}>v2.0 · May 2026</div>
        </div>
      </div>

      {/* ── Main content ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* ── Global toolbar ── */}
        <div style={{
          padding: '8px 20px', borderBottom: '1px solid #222', background: '#111',
          display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
          zIndex: 100, position: 'relative', flexShrink: 0,
        }}>

          {/* Date range picker */}
          <DateRangePicker dateRange={dateRange} setDateRange={setDateRange} />

          <div style={{ width: 1, height: 20, background: '#222' }} />

          {/* Filters button — only shows on Dashboard */}
          {page === 'dashboard' && (
            <FilterBar filters={filters} onChange={setFilters} />
          )}

          <div style={{ width: 1, height: 20, background: '#222' }} />

          {/* Account selector */}
          <div style={{
            display: 'flex', gap: 2, background: '#1a1a1a',
            border: '1px solid #2a2a2a', borderRadius: 8, padding: '2px 3px',
          }}>
            {['both', 'a1', 'a2'].map(a => (
              <button key={a} onClick={() => setAccount(a)} style={{
                padding: '3px 12px', borderRadius: 6, fontSize: 14, fontWeight: 700,
                cursor: 'pointer', border: 'none',
                background: account === a ? '#185FA522' : 'transparent',
                color: '#fff',
                transition: 'background 0.12s',
              }}>
                {a === 'both' ? 'Both' : a.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Right side actions */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            {msg && <span style={{ fontSize: 12, color: '#1D9E75' }}>{msg}</span>}
            {trades.length === 0 && (
              <button onClick={seedDatabase} disabled={seeding} style={{
                fontSize: 12, padding: '4px 12px', borderRadius: 6,
                border: '1px solid #2a2a2a', background: 'transparent', color: '#666', cursor: 'pointer',
              }}>
                {seeding ? 'Loading...' : 'Load sample trades'}
              </button>
            )}
            <button onClick={exportCSV} style={{
              fontSize: 12, padding: '4px 12px', borderRadius: 6,
              border: '1px solid #2a2a2a', background: 'transparent', color: '#666', cursor: 'pointer',
            }}>
              ↓ CSV
            </button>
          </div>
        </div>

        {/* ── Page content ── */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {page === 'dashboard'  && <Dashboard  {...dashboardProps} />}
          {page === 'reports'    && <Reports     {...filteredProps} />}
          {page === 'analysis'   && <Analysis    {...filteredProps} account={account} tosData={tosData} setTosData={setTosData} />}
          {page === 'tradeview'  && <TradeView   {...tradeViewProps} />}
          {page === 'strategies' && <Strategies  {...filteredProps} />}
        </div>
      </div>

      {/* ── Floating AI Chat panel ── */}
      {chatOpen && (
        <div style={{
          position: 'fixed',
          bottom: chatMaximized ? 24 : 80,
          right:  chatMaximized ? 24 : 20,
          width:  chatMaximized ? 'calc(100vw - 48px)' : 380,
          height: chatMaximized ? 'calc(100vh - 48px)' : 520,
          maxWidth:  chatMaximized ? 'none' : 'calc(100vw - 40px)',
          maxHeight: chatMaximized ? 'none' : 'calc(100vh - 120px)',
          background: '#111', border: '1px solid #222', borderRadius: 12,
          zIndex: 1000, display: 'flex', flexDirection: 'column', overflow: 'hidden',
          transition: 'all 0.18s ease',
        }}>
          <div style={{
            padding: '12px 16px', borderBottom: '1px solid #222',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#ccc' }}>AI Chat</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={() => setChatMaximized(m => !m)}
                title={chatMaximized ? 'Restore' : 'Maximize'}
                style={{ background: 'none', border: 'none', color: '#888', fontSize: 18, cursor: 'pointer', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {chatMaximized ? 'Min' : 'Max'}
              </button>
              <button onClick={() => { setChatOpen(false); setChatMaximized(false); }}
                style={{ background: 'none', border: 'none', color: '#666', fontSize: 20, cursor: 'pointer' }}>
                ×
              </button>
            </div>
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <AIChat trades={trades} embedded={true} />
          </div>
        </div>
      )}

      {/* Floating chat button */}
      <button onClick={() => setChatOpen(o => !o)} title="AI Trading Coach" style={{
        position: 'fixed', bottom: 24, right: 24, width: 56, height: 56,
        borderRadius: '50%',
        background: chatOpen ? '#E24B4A' : '#1D9E75',
        border: '3px solid #fff', color: '#fff',
        fontSize: 24, cursor: 'pointer', zIndex: 1001,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        transition: 'all 0.15s',
      }}>
        {chatOpen ? '×' : '💬'}
      </button>
    </div>
  );
}
