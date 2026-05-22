import React, { useState, useMemo } from 'react';
import { supabase } from '../supabase';
import { GRADES, GRADE_COLORS } from '../App';

const EMOJIS = ['📈','📉','⚡','🎯','🔥','💎','🏹','🌊','📐','💡','🔑','🎲','🧲','🛡️','⚔️','🔮','🌀','💫','🏆','📊'];
const COLORS = ['#185FA5','#1D9E75','#E24B4A','#BA7517','#7F77DD','#888780'];

// ─── Strategy definitions ─────────────────────────────────────────────────────
// AL strong = al_touches >= 3 AND al_age === '1wk+'
// SL strong = sl_touches >= 3 AND sl_age === '1wk+'

const DEFAULT_STRATEGIES = [
  {
    id: 'strat-aplus-prime',
    icon: '⭐',
    name: 'A+ Prime',
    desc: 'AL 3+ touches 1wk+ · SL 3+ touches 1wk+',
    symbol: 'Any',
    color: '#1D9E75',
    notes: 'Highest conviction setup. Both AL and SL have 3+ touches with 1 week+ of data. Historically ~88% win rate. This is the setup to size up on. Never skip these.',
  },
  {
    id: 'strat-strong-al-weak-sl',
    icon: '📈',
    name: 'Strong AL / Weak SL',
    desc: 'AL 3+ touches 1wk+ · SL <3 touches or <1wk',
    symbol: 'Any',
    color: '#185FA5',
    notes: 'Strong action line but weaker safety line. Good entry signal but stop is less reliable. Use tighter discretion on SL management. Historically profitable but watch fake-outs at SL.',
  },
  {
    id: 'strat-weak-al-strong-sl',
    icon: '🛡️',
    name: 'Weak AL / Strong SL',
    desc: 'AL <3 touches or <1wk · SL 3+ touches 1wk+',
    symbol: 'Any',
    color: '#BA7517',
    notes: 'Weaker entry signal but strong stop placement. The SL is reliable so risk is well-defined. Entry confidence is lower — be selective. Historically profitable when the AL break is clean.',
  },
  {
    id: 'strat-both-weak',
    icon: '⚠️',
    name: 'Both Weak',
    desc: 'AL <3 touches or <1wk · SL <3 touches or <1wk',
    symbol: 'Any',
    color: '#E24B4A',
    notes: 'Neither AL nor SL meets the 3-touch 1wk+ threshold. Historically net negative. These trades should be avoided or skipped entirely. If taken, size down significantly.',
  },
];

// ─── Auto-assign logic ────────────────────────────────────────────────────────
function getStrategyIdForTrade(trade) {
  const alStrong = parseInt(trade.al_touches) >= 3 && trade.al_age === '1wk+';
  const slStrong = parseInt(trade.sl_touches) >= 3 && trade.sl_age === '1wk+';
  if (alStrong && slStrong) return 'strat-aplus-prime';
  if (alStrong && !slStrong) return 'strat-strong-al-weak-sl';
  if (!alStrong && slStrong) return 'strat-weak-al-strong-sl';
  return 'strat-both-weak';
}

export default function Strategies({ trades, strategies, saveStrategies, reloadTrades, setMsg }) {
  const effectiveStrategies = strategies.length > 0 ? strategies : DEFAULT_STRATEGIES;

  const didSeed = React.useRef(false);
  if (!didSeed.current && strategies.length === 0) {
    didSeed.current = true;
    saveStrategies(DEFAULT_STRATEGIES);
  }

  const [showModal, setShowModal] = useState(false);
  const [editStrategy, setEditStrategy] = useState(null);
  const [form, setForm] = useState({ name: '', desc: '', symbol: 'Any', icon: '📈', color: '#185FA5', notes: '' });
  const [emojiGridOpen, setEmojiGridOpen] = useState(false);
  const [selectedStrat, setSelectedStrat] = useState(null);
  const [assignView, setAssignView] = useState('stats');
  const [assignFilter, setAssignFilter] = useState('unassigned');
  const [selectedTradeIds, setSelectedTradeIds] = useState(new Set());
  const [assigning, setAssigning] = useState(false);
  const [autoAssigning, setAutoAssigning] = useState(false);

  const closed = trades.filter(t => t.pnl !== null);

  const getStratStats = (stratId) => {
    const ts = stratId === '__unassigned__'
      ? closed.filter(t => !t.strategy_id)
      : closed.filter(t => t.strategy_id === stratId);
    if (!ts.length) return { trades: 0, wins: 0, losses: 0, totalPnl: 0, avgWin: 0, avgLoss: 0, pf: 0, wr: 0, recent: [] };
    const wins = ts.filter(t => t.pnl > 0);
    const losses = ts.filter(t => t.pnl < 0);
    const totalPnl = Math.round(ts.reduce((s, t) => s + t.pnl, 0));
    const avgWin = wins.length ? Math.round(wins.reduce((s, t) => s + t.pnl, 0) / wins.length) : 0;
    const avgLoss = losses.length ? Math.round(losses.reduce((s, t) => s + t.pnl, 0) / losses.length) : 0;
    const grossWin = wins.reduce((s, t) => s + t.pnl, 0);
    const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
    const pf = grossLoss > 0 ? Math.round((grossWin / grossLoss) * 100) / 100 : grossWin > 0 ? 999 : 0;
    const wr = ts.length ? Math.round(wins.length / ts.length * 100) : 0;
    return {
      trades: ts.length, wins: wins.length, losses: losses.length,
      totalPnl, avgWin, avgLoss, pf, wr,
      recent: [...ts].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5),
    };
  };

  // Auto-assign ALL trades based on AL/SL data
  const autoAssignAll = async () => {
    setAutoAssigning(true);
    try {
      // Group trades by strategy to batch updates
      const groups = {};
      trades.forEach(t => {
        const sid = getStrategyIdForTrade(t);
        if (!groups[sid]) groups[sid] = [];
        groups[sid].push(t.id);
      });

      let totalUpdated = 0;
      for (const [stratId, ids] of Object.entries(groups)) {
        const { error } = await supabase
          .from('trades')
          .update({ strategy_id: stratId })
          .in('id', ids);
        if (error) throw new Error(error.message);
        totalUpdated += ids.length;
      }

      setMsg(`✓ ${totalUpdated} trades auto-assigned based on AL/SL data`);
      await reloadTrades();
    } catch (err) {
      setMsg('Error: ' + err.message);
    }
    setAutoAssigning(false);
    setTimeout(() => setMsg(''), 4000);
  };

  // Trades available to assign in the panel
  const assignableTrades = useMemo(() => {
    if (!selectedStrat) return [];
    const base = [...trades].sort((a, b) => b.date.localeCompare(a.date));
    if (assignFilter === 'unassigned') return base.filter(t => !t.strategy_id);
    return base;
  }, [trades, selectedStrat, assignFilter]);

  const toggleTradeSelect = (id) => {
    setSelectedTradeIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedTradeIds(new Set(assignableTrades.map(t => t.id)));
  const clearAll = () => setSelectedTradeIds(new Set());

  const assignTrades = async () => {
    if (!selectedTradeIds.size || !selectedStrat) return;
    setAssigning(true);
    const ids = [...selectedTradeIds];
    const { error } = await supabase.from('trades').update({ strategy_id: selectedStrat.id }).in('id', ids);
    if (error) { setMsg('Error: ' + error.message); }
    else { setMsg(`✓ ${ids.length} trade${ids.length !== 1 ? 's' : ''} assigned to ${selectedStrat.name}`); setSelectedTradeIds(new Set()); await reloadTrades(); }
    setAssigning(false);
    setTimeout(() => setMsg(''), 3000);
  };

  const unassignTrades = async () => {
    if (!selectedTradeIds.size) return;
    setAssigning(true);
    const ids = [...selectedTradeIds];
    const { error } = await supabase.from('trades').update({ strategy_id: null }).in('id', ids);
    if (error) { setMsg('Error: ' + error.message); }
    else { setMsg(`✓ ${ids.length} trade${ids.length !== 1 ? 's' : ''} unassigned`); setSelectedTradeIds(new Set()); await reloadTrades(); }
    setAssigning(false);
    setTimeout(() => setMsg(''), 3000);
  };

  const openModal = (strat = null) => {
    setEditStrategy(strat);
    setForm(strat
      ? { name: strat.name, desc: strat.desc || '', symbol: strat.symbol || 'Any', icon: strat.icon || '📈', color: strat.color || '#185FA5', notes: strat.notes || '' }
      : { name: '', desc: '', symbol: 'Any', icon: '📈', color: '#185FA5', notes: '' }
    );
    setEmojiGridOpen(false);
    setShowModal(true);
  };

  const saveStrat = () => {
    if (!form.name.trim()) return;
    if (editStrategy) {
      saveStrategies(effectiveStrategies.map(s => s.id === editStrategy.id ? { ...s, ...form } : s));
    } else {
      saveStrategies([...effectiveStrategies, { id: 'strat-' + Date.now(), ...form }]);
    }
    setShowModal(false);
  };

  const deleteStrat = (id) => {
    if (!window.confirm('Delete this strategy?')) return;
    saveStrategies(effectiveStrategies.filter(s => s.id !== id));
    if (selectedStrat?.id === id) setSelectedStrat(null);
  };

  const openPanel = (s, view = 'stats') => {
    setSelectedStrat(s);
    setAssignView(view);
    setSelectedTradeIds(new Set());
    setAssignFilter('unassigned');
  };

  const allStratRows = [
    ...effectiveStrategies,
    { id: '__unassigned__', icon: '📋', name: 'Unassigned', desc: 'Trades not tagged to a strategy', color: '#555', _system: true },
  ];

  const stratWithStats = effectiveStrategies.map(s => ({ ...s, stats: getStratStats(s.id) }));
  const overallStats = effectiveStrategies.reduce((acc, s) => {
    const st = getStratStats(s.id);
    return { trades: acc.trades + st.trades, pnl: acc.pnl + st.totalPnl };
  }, { trades: 0, pnl: 0 });
  const withTrades = stratWithStats.filter(s => s.stats.trades > 0);
  const bestStrat = withTrades.length ? withTrades.reduce((a, b) => b.stats.totalPnl > a.stats.totalPnl ? b : a) : null;
  const worstStrat = withTrades.length ? withTrades.reduce((a, b) => b.stats.totalPnl < a.stats.totalPnl ? b : a) : null;
  const noStratCount = trades.filter(t => !t.strategy_id).length;

  const StratRow = ({ s }) => {
    const st = getStratStats(s.id);
    const pfColor = st.pf >= 1 ? '#1D9E75' : st.pf === 0 ? '#555' : '#E24B4A';
    const pnlColor = st.totalPnl > 0 ? '#1D9E75' : st.totalPnl < 0 ? '#E24B4A' : '#555';
    const wrColor = st.wr >= 50 ? '#1D9E75' : st.trades > 0 ? '#E24B4A' : '#555';
    const isSelected = selectedStrat?.id === s.id;
    return (
      <tr
        onClick={() => openPanel(s, 'stats')}
        style={{ cursor: 'pointer', background: isSelected ? '#185FA511' : 'transparent' }}
        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#1a1a1a'; }}
        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
      >
        <td style={{ padding: '12px 16px', width: 36 }}>
          {!s._system && <input type="checkbox" style={{ width: 13, height: 13, accentColor: '#185FA5' }} onClick={e => e.stopPropagation()} />}
        </td>
        <td style={{ padding: '12px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: s.color ? s.color + '22' : '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, border: `1px solid ${s.color || '#2a2a2a'}44`, flexShrink: 0 }}>{s.icon}</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#ccc' }}>{s.name}</div>
              <div style={{ fontSize: 11, color: '#555' }}>{s.desc}</div>
            </div>
          </div>
        </td>
        <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, fontWeight: 500, color: st.trades ? '#ccc' : '#444' }}>{st.trades || '—'}</td>
        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: wrColor }}>{st.trades ? st.wr + '%' : '—'}</span>
            {st.trades > 0 && <div style={{ width: 70, height: 4, background: '#1a1a1a', borderRadius: 2 }}><div style={{ width: st.wr + '%', height: '100%', background: wrColor, borderRadius: 2 }} /></div>}
          </div>
        </td>
        <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, color: st.avgWin > 0 ? '#1D9E75' : '#555' }}>{st.avgWin > 0 ? '+$' + st.avgWin : '—'}</td>
        <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, color: st.avgLoss < 0 ? '#E24B4A' : '#555' }}>{st.avgLoss < 0 ? '-$' + Math.abs(st.avgLoss) : '—'}</td>
        <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, fontWeight: 500, color: pnlColor }}>{st.trades ? (st.totalPnl >= 0 ? '+$' : '-$') + Math.abs(st.totalPnl).toLocaleString() : '—'}</td>
        <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, fontWeight: 500, color: pfColor }}>{st.pf > 0 ? (st.pf === 999 ? '∞' : st.pf.toFixed(2)) : '—'}</td>
        <td style={{ padding: '12px 8px' }}>
          {!s._system && (
            <div style={{ display: 'flex', gap: 2 }} onClick={e => e.stopPropagation()}>
              <button onClick={e => { e.stopPropagation(); openPanel(s, 'assign'); }} title="Assign trades" style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', padding: '3px 6px', borderRadius: 4, fontSize: 13 }}>🔗</button>
              <button onClick={e => { e.stopPropagation(); openModal(s); }} title="Edit" style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', padding: '3px 6px', borderRadius: 4, fontSize: 13 }}>✏️</button>
              <button onClick={e => { e.stopPropagation(); deleteStrat(s.id); }} title="Delete" style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', padding: '3px 6px', borderRadius: 4, fontSize: 13 }}>🗑️</button>
            </div>
          )}
        </td>
      </tr>
    );
  };

  const panelStats = selectedStrat ? getStratStats(selectedStrat.id) : null;

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

      {/* ── Main table ── */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px', minWidth: 0 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 500, color: '#ccc', marginBottom: 2 }}>Strategies</div>
            <div style={{ fontSize: 12, color: '#555' }}>Performance by AL/SL combination · all time</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {/* Auto-assign button */}
            <button
              onClick={autoAssignAll}
              disabled={autoAssigning}
              style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid #1D9E7544', background: '#1D9E7511', color: '#1D9E75', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
            >
              {autoAssigning ? '⏳ Assigning...' : '⚡ Auto-assign all trades'}
            </button>
            <button onClick={() => openModal()} style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: '#185FA5', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              + New Strategy
            </button>
          </div>
        </div>

        {/* Auto-assign info banner */}
        <div style={{ background: '#185FA511', border: '1px solid #185FA533', borderRadius: 8, padding: '10px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 16 }}>💡</span>
          <div style={{ fontSize: 12, color: '#666', lineHeight: 1.5 }}>
            <strong style={{ color: '#185FA5' }}>Auto-assign</strong> reads every trade's AL/SL touches and age to assign the correct strategy automatically.
            AL strong = 3+ touches &amp; 1wk+ · SL strong = 3+ touches &amp; 1wk+
          </div>
        </div>

        {/* Summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 16 }}>
          {[
            { label: 'Strategies', value: effectiveStrategies.length, color: '#185FA5' },
            { label: 'Tagged Trades', value: overallStats.trades + ' / ' + trades.length },
            { label: 'Overall P&L', value: (overallStats.pnl >= 0 ? '+$' : '-$') + Math.abs(overallStats.pnl).toLocaleString(), color: overallStats.pnl >= 0 ? '#1D9E75' : '#E24B4A' },
            { label: 'Best Strategy', value: bestStrat ? bestStrat.icon + ' ' + bestStrat.name : '—', color: '#1D9E75' },
            { label: 'Worst Strategy', value: worstStrat ? worstStrat.icon + ' ' + worstStrat.name : '—', color: '#E24B4A' },
          ].map((c, i) => (
            <div key={i} style={{ background: '#111', border: '1px solid #222', borderRadius: 8, padding: '10px 14px' }}>
              <div style={{ fontSize: 11, color: '#555', marginBottom: 3 }}>{c.label}</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: c.color || '#ccc' }}>{c.value}</div>
            </div>
          ))}
        </div>

        {/* Untagged warning */}
        {noStratCount > 0 && (
          <div style={{ background: '#BA751712', border: '1px solid #BA751733', borderRadius: 8, padding: '10px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>⚠️</span>
              <span style={{ fontSize: 13, color: '#BA7517' }}>{noStratCount} trade{noStratCount !== 1 ? 's' : ''} not tagged — click <strong>Auto-assign</strong> to tag them all instantly</span>
            </div>
            <button onClick={autoAssignAll} disabled={autoAssigning} style={{ fontSize: 12, padding: '4px 12px', borderRadius: 6, border: '1px solid #1D9E7544', background: '#1D9E7511', color: '#1D9E75', cursor: 'pointer' }}>
              ⚡ Auto-assign now
            </button>
          </div>
        )}

        {/* Table */}
        <div style={{ background: '#111', border: '1px solid #222', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #222', background: '#0d0d0d' }}>
                <th style={{ width: 36, padding: '9px 16px' }}></th>
                {[['Strategy','left'],['Trades','right'],['Win rate','right'],['Avg winner','right'],['Avg loser','right'],['Total net P&L','right'],['Profit factor','right'],['','right']].map(([label, align]) => (
                  <th key={label} style={{ fontSize: 11, fontWeight: 500, color: '#555', padding: '9px 16px', textAlign: align, whiteSpace: 'nowrap' }}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allStratRows.map(s => <StratRow key={s.id} s={s} />)}
            </tbody>
          </table>
        </div>
        <div style={{ fontSize: 11, color: '#444', marginTop: 8, textAlign: 'right' }}>Click a row for stats · 🔗 to manually assign trades · ✏️ to edit</div>
      </div>

      {/* ── Side panel ── */}
      {selectedStrat && panelStats && (
        <div style={{ width: 360, background: '#111', borderLeft: '1px solid #222', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #222', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 20 }}>{selectedStrat.icon}</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#ccc' }}>{selectedStrat.name}</div>
                <div style={{ fontSize: 11, color: '#555' }}>{selectedStrat.desc}</div>
              </div>
            </div>
            <button onClick={() => setSelectedStrat(null)} style={{ background: 'none', border: 'none', color: '#555', fontSize: 20, cursor: 'pointer' }}>×</button>
          </div>

          {/* Tab toggle */}
          {!selectedStrat._system && (
            <div style={{ display: 'flex', borderBottom: '1px solid #222', flexShrink: 0 }}>
              {[['stats','📊 Stats'],['assign','🔗 Assign']].map(([v, label]) => (
                <button key={v} onClick={() => { setAssignView(v); setSelectedTradeIds(new Set()); }} style={{
                  flex: 1, padding: '9px 0', fontSize: 12, fontWeight: 500, cursor: 'pointer',
                  background: assignView === v ? '#185FA511' : 'transparent',
                  color: assignView === v ? '#185FA5' : '#555',
                  border: 'none', borderBottom: assignView === v ? '2px solid #185FA5' : '2px solid transparent',
                }}>{label}</button>
              ))}
            </div>
          )}

          <div style={{ flex: 1, overflow: 'auto' }}>

            {/* Stats tab */}
            {assignView === 'stats' && (
              <div style={{ padding: 14 }}>
                {selectedStrat.notes && (
                  <div style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 8, padding: '10px 12px', marginBottom: 14 }}>
                    <div style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Strategy rules</div>
                    <div style={{ fontSize: 12, color: '#666', lineHeight: 1.6 }}>{selectedStrat.notes}</div>
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                  {[
                    { l: 'Trades', v: panelStats.trades || '—' },
                    { l: 'Win rate', v: panelStats.trades ? panelStats.wr + '%' : '—', c: panelStats.wr >= 50 ? '#1D9E75' : panelStats.trades > 0 ? '#E24B4A' : '' },
                    { l: 'Total P&L', v: panelStats.trades ? (panelStats.totalPnl >= 0 ? '+$' : '-$') + Math.abs(panelStats.totalPnl).toLocaleString() : '—', c: panelStats.totalPnl >= 0 ? '#1D9E75' : '#E24B4A' },
                    { l: 'Profit factor', v: panelStats.pf > 0 ? (panelStats.pf === 999 ? '∞' : panelStats.pf.toFixed(2)) : '—', c: panelStats.pf >= 1 ? '#1D9E75' : panelStats.pf > 0 ? '#E24B4A' : '' },
                    { l: 'Avg winner', v: panelStats.avgWin > 0 ? '+$' + panelStats.avgWin : '—', c: '#1D9E75' },
                    { l: 'Avg loser', v: panelStats.avgLoss < 0 ? '-$' + Math.abs(panelStats.avgLoss) : '—', c: '#E24B4A' },
                  ].map((s, i) => (
                    <div key={i} style={{ background: '#1a1a1a', borderRadius: 6, padding: '8px 10px' }}>
                      <div style={{ fontSize: 10, color: '#444', marginBottom: 3 }}>{s.l}</div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: s.c || '#ccc' }}>{s.v}</div>
                    </div>
                  ))}
                </div>
                {panelStats.recent.length > 0 ? (<>
                  <div style={{ fontSize: 11, color: '#444', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recent trades</div>
                  {panelStats.recent.map((t, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: i < panelStats.recent.length - 1 ? '1px solid #1a1a1a' : 'none' }}>
                      <span style={{ fontSize: 12, color: '#555' }}>{t.date} · {t.symbol === 'OTHER' ? t.custom_symbol : t.symbol}</span>
                      <span style={{ fontSize: 11, color: t.direction === 'long' ? '#1D9E75' : '#E24B4A' }}>{t.direction}</span>
                      <span style={{ fontSize: 12, fontWeight: 500, color: t.pnl >= 0 ? '#1D9E75' : '#E24B4A' }}>{t.pnl >= 0 ? '+$' : '-$'}{Math.abs(t.pnl)}</span>
                    </div>
                  ))}
                </>) : (
                  <div style={{ fontSize: 12, color: '#444', textAlign: 'center', padding: '20px 0' }}>
                    No trades tagged yet.
                    <br />
                    <button onClick={() => autoAssignAll()} style={{ marginTop: 8, fontSize: 12, padding: '5px 14px', borderRadius: 6, border: '1px solid #1D9E7544', background: '#1D9E7511', color: '#1D9E75', cursor: 'pointer' }}>
                      ⚡ Auto-assign all trades
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Assign tab */}
            {assignView === 'assign' && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ padding: '10px 14px', borderBottom: '1px solid #1a1a1a', flexShrink: 0 }}>
                  <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>Manually assign trades to "{selectedStrat.name}"</div>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                    {[['unassigned','Untagged only'],['all','All trades']].map(([v, label]) => (
                      <button key={v} onClick={() => { setAssignFilter(v); setSelectedTradeIds(new Set()); }} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, cursor: 'pointer', border: '1px solid', borderColor: assignFilter === v ? '#185FA5' : '#2a2a2a', background: assignFilter === v ? '#185FA522' : 'transparent', color: assignFilter === v ? '#185FA5' : '#666' }}>{label}</button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <button onClick={selectAll} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: '1px solid #2a2a2a', background: 'transparent', color: '#666', cursor: 'pointer' }}>Select all</button>
                    <button onClick={clearAll} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: '1px solid #2a2a2a', background: 'transparent', color: '#666', cursor: 'pointer' }}>Clear</button>
                    <span style={{ fontSize: 11, color: '#555', marginLeft: 4 }}>{selectedTradeIds.size} selected</span>
                  </div>
                </div>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  {assignableTrades.length === 0 ? (
                    <div style={{ padding: '24px 14px', textAlign: 'center', fontSize: 13, color: '#444' }}>
                      {assignFilter === 'unassigned' ? 'All trades are tagged 🎉' : 'No trades found'}
                    </div>
                  ) : assignableTrades.map(t => {
                    const isChecked = selectedTradeIds.has(t.id);
                    const currentStrat = effectiveStrategies.find(s => s.id === t.strategy_id);
                    const suggestedStratId = getStrategyIdForTrade(t);
                    const suggestedStrat = effectiveStrategies.find(s => s.id === suggestedStratId);
                    return (
                      <div key={t.id} onClick={() => toggleTradeSelect(t.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderBottom: '1px solid #1a1a1a', cursor: 'pointer', background: isChecked ? '#185FA50a' : 'transparent' }}
                        onMouseEnter={e => { if (!isChecked) e.currentTarget.style.background = '#1a1a1a'; }}
                        onMouseLeave={e => { if (!isChecked) e.currentTarget.style.background = 'transparent'; }}
                      >
                        <input type="checkbox" checked={isChecked} onChange={() => {}} style={{ width: 13, height: 13, accentColor: '#185FA5', flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                            <span style={{ fontSize: 12, fontWeight: 500, color: '#ccc' }}>#{t.trade_number || '—'}</span>
                            <span style={{ fontSize: 11, color: '#555' }}>{t.date}</span>
                            <span style={{ fontSize: 11, color: '#555' }}>{t.symbol === 'OTHER' ? t.custom_symbol : t.symbol}</span>
                            <span style={{ fontSize: 11, color: t.direction === 'long' ? '#1D9E75' : '#E24B4A' }}>{t.direction?.toUpperCase()}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 11, background: GRADE_COLORS[t.grade]+'33', color: GRADE_COLORS[t.grade], padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>{GRADES[t.grade] || t.grade}</span>
                            {currentStrat && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 20, background: (currentStrat.color||'#185FA5')+'22', color: currentStrat.color||'#185FA5' }}>{currentStrat.icon} {currentStrat.name.slice(0,12)}</span>}
                            {!t.strategy_id && suggestedStrat && <span style={{ fontSize: 10, color: '#444' }}>→ {suggestedStrat.icon} {suggestedStrat.name.slice(0,14)}</span>}
                          </div>
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 500, color: t.pnl > 0 ? '#1D9E75' : t.pnl < 0 ? '#E24B4A' : '#555', flexShrink: 0 }}>
                          {t.pnl !== null ? (t.pnl >= 0 ? '+$' : '-$') + Math.abs(t.pnl) : '—'}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div style={{ padding: '10px 14px', borderTop: '1px solid #222', flexShrink: 0, display: 'flex', gap: 8 }}>
                  <button onClick={assignTrades} disabled={!selectedTradeIds.size || assigning} style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', background: selectedTradeIds.size ? '#185FA5' : '#1a1a1a', color: selectedTradeIds.size ? '#fff' : '#444', fontSize: 13, fontWeight: 500, cursor: selectedTradeIds.size ? 'pointer' : 'default' }}>
                    {assigning ? 'Assigning...' : `Assign ${selectedTradeIds.size ? `(${selectedTradeIds.size})` : ''}`}
                  </button>
                  <button onClick={unassignTrades} disabled={!selectedTradeIds.size || assigning} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #2a2a2a', background: 'transparent', color: selectedTradeIds.size ? '#BA7517' : '#444', fontSize: 13, cursor: selectedTradeIds.size ? 'pointer' : 'default' }}>
                    Unassign
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── New/Edit Modal ── */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#111', border: '1px solid #2a2a2a', borderRadius: 12, width: 480, maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #222', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 15, fontWeight: 500, color: '#ccc' }}>{editStrategy ? 'Edit Strategy' : 'New Strategy'}</span>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: '#666', fontSize: 18, cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 8, fontWeight: 500 }}>Icon</label>
                <div onClick={() => setEmojiGridOpen(o => !o)} style={{ width: 52, height: 52, borderRadius: 10, background: '#1a1a1a', border: `1px solid ${emojiGridOpen ? '#185FA5' : '#2a2a2a'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, cursor: 'pointer', marginBottom: 8 }}>{form.icon}</div>
                {emojiGridOpen && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 4, background: '#1a1a1a', borderRadius: 8, padding: 8, border: '1px solid #2a2a2a' }}>
                    {EMOJIS.map(e => <div key={e} onClick={() => { setForm(f => ({ ...f, icon: e })); setEmojiGridOpen(false); }} style={{ width: 30, height: 30, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, cursor: 'pointer', background: form.icon === e ? '#185FA522' : 'transparent', border: form.icon === e ? '1px solid #185FA5' : '1px solid transparent' }}>{e}</div>)}
                  </div>
                )}
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 6, fontWeight: 500 }}>Strategy name *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. A+ Prime" style={{ width: '100%', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#ccc', fontFamily: 'inherit' }} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 6, fontWeight: 500 }}>Description</label>
                <input value={form.desc} onChange={e => setForm(f => ({ ...f, desc: e.target.value }))} placeholder="Short description" style={{ width: '100%', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#ccc', fontFamily: 'inherit' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 6, fontWeight: 500 }}>Default symbol</label>
                  <select value={form.symbol} onChange={e => setForm(f => ({ ...f, symbol: e.target.value }))} style={{ width: '100%', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#ccc', fontFamily: 'inherit' }}>
                    {['Any','MGC','MNQ','MYM','MCL','ES','NQ','Other'].map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 6, fontWeight: 500 }}>Color</label>
                  <div style={{ display: 'flex', gap: 8, paddingTop: 6 }}>
                    {COLORS.map(c => <div key={c} onClick={() => setForm(f => ({ ...f, color: c }))} style={{ width: 24, height: 24, borderRadius: '50%', background: c, cursor: 'pointer', border: form.color === c ? '2px solid #fff' : '2px solid transparent' }} />)}
                  </div>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 6, fontWeight: 500 }}>Rules / Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} placeholder="Entry conditions, exit rules..." style={{ width: '100%', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#ccc', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }} />
              </div>
            </div>
            <div style={{ padding: '12px 20px', borderTop: '1px solid #222', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setShowModal(false)} style={{ fontSize: 13, padding: '7px 18px', borderRadius: 8, cursor: 'pointer', background: 'transparent', border: '1px solid #2a2a2a', color: '#888', fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={saveStrat} style={{ fontSize: 13, padding: '7px 18px', borderRadius: 8, cursor: 'pointer', background: '#185FA5', border: 'none', color: '#fff', fontWeight: 500, fontFamily: 'inherit' }}>Save Strategy</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
