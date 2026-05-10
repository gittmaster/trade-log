import React, { useState } from 'react';

const EMOJIS = ['📈','📉','⚡','🎯','🔥','💎','🏹','🌊','📐','💡','🔑','🎲','🧲','🛡️','⚔️','🔮','🌀','💫','🏆','📊'];
const COLORS = ['#185FA5','#1D9E75','#E24B4A','#BA7517','#7F77DD','#888780'];

export default function Strategies({ trades, strategies, saveStrategies }) {
  const [showModal, setShowModal] = useState(false);
  const [editStrategy, setEditStrategy] = useState(null);
  const [form, setForm] = useState({ name: '', desc: '', symbol: 'Any', icon: '📈', color: '#185FA5', notes: '' });
  const [selectedPanel, setSelectedPanel] = useState(null);
  const [emojiGridOpen, setEmojiGridOpen] = useState(false);

  const closed = trades.filter(t => t.pnl !== null);

  const getStratStats = (stratId) => {
    const ts = stratId === '__unassigned__'
      ? closed.filter(t => !t.strategy_id)
      : closed.filter(t => t.strategy_id === stratId);
    if (!ts.length) return { trades: 0, wins: 0, losses: 0, totalPnl: 0, avgWin: 0, avgLoss: 0, pf: 0, wr: 0, missed: 0 };
    const wins = ts.filter(t => t.pnl > 0);
    const losses = ts.filter(t => t.pnl < 0);
    const totalPnl = Math.round(ts.reduce((s, t) => s + t.pnl, 0));
    const avgWin = wins.length ? Math.round(wins.reduce((s, t) => s + t.pnl, 0) / wins.length) : 0;
    const avgLoss = losses.length ? Math.round(losses.reduce((s, t) => s + t.pnl, 0) / losses.length) : 0;
    const grossWin = wins.reduce((s, t) => s + t.pnl, 0);
    const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
    const pf = grossLoss > 0 ? Math.round((grossWin / grossLoss) * 100) / 100 : grossWin > 0 ? 999 : 0;
    const wr = Math.round(wins.length / ts.length * 100);
    return { trades: ts.length, wins: wins.length, losses: losses.length, totalPnl, avgWin, avgLoss, pf, wr, missed: 0, recent: ts.slice(0, 5) };
  };

  const openModal = (strat = null) => {
    setEditStrategy(strat);
    setForm(strat ? { name: strat.name, desc: strat.desc || '', symbol: strat.symbol || 'Any', icon: strat.icon || '📈', color: strat.color || '#185FA5', notes: strat.notes || '' } : { name: '', desc: '', symbol: 'Any', icon: '📈', color: '#185FA5', notes: '' });
    setEmojiGridOpen(false);
    setShowModal(true);
  };

  const saveStrat = () => {
    if (!form.name.trim()) return;
    if (editStrategy) {
      saveStrategies(strategies.map(s => s.id === editStrategy.id ? { ...s, ...form } : s));
    } else {
      saveStrategies([...strategies, { id: Date.now().toString(), ...form }]);
    }
    setShowModal(false);
  };

  const deleteStrat = (id) => {
    if (!window.confirm('Delete this strategy?')) return;
    saveStrategies(strategies.filter(s => s.id !== id));
    if (selectedPanel?.id === id) setSelectedPanel(null);
  };

  const allStratRows = [
    ...strategies,
    { id: '__unassigned__', icon: '📋', name: 'Unassigned', desc: 'Trades not tagged to a strategy', color: '#555' }
  ];

  const overallStats = allStratRows.reduce((acc, s) => {
    const st = getStratStats(s.id);
    return { trades: acc.trades + st.trades, pnl: acc.pnl + st.totalPnl };
  }, { trades: 0, pnl: 0 });

  const bestStrat = strategies.length ? strategies.reduce((best, s) => {
    const st = getStratStats(s.id);
    const bestSt = getStratStats(best.id);
    return st.totalPnl > bestSt.totalPnl ? s : best;
  }, strategies[0]) : null;

  const worstStrat = strategies.length ? strategies.reduce((worst, s) => {
    const st = getStratStats(s.id);
    const worstSt = getStratStats(worst.id);
    return st.totalPnl < worstSt.totalPnl ? s : worst;
  }, strategies[0]) : null;

  const StratRow = ({ s }) => {
    const st = getStratStats(s.id);
    const pfColor = st.pf >= 1 ? '#1D9E75' : st.pf === 0 ? '#555' : '#E24B4A';
    const pnlColor = st.totalPnl > 0 ? '#1D9E75' : st.totalPnl < 0 ? '#E24B4A' : '#555';
    const wrColor = st.wr >= 50 ? '#1D9E75' : st.trades > 0 ? '#E24B4A' : '#555';
    return (
      <tr onClick={() => setSelectedPanel(s)} style={{ cursor: 'pointer', background: selectedPanel?.id === s.id ? '#185FA511' : 'transparent' }}
        onMouseEnter={e => { if (selectedPanel?.id !== s.id) e.currentTarget.style.background = '#1a1a1a'; }}
        onMouseLeave={e => { if (selectedPanel?.id !== s.id) e.currentTarget.style.background = 'transparent'; }}>
        <td style={{ padding: '12px 16px', width: 36 }}>
          {s.id !== '__unassigned__' && <input type="checkbox" style={{ width: 13, height: 13, accentColor: '#185FA5' }} onClick={e => e.stopPropagation()} />}
        </td>
        <td style={{ padding: '12px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: s.color ? s.color + '22' : '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, border: `1px solid ${s.color || '#2a2a2a'}44`, flexShrink: 0 }}>{s.icon}</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#ccc' }}>{s.name}</div>
              <div style={{ fontSize: 11, color: '#555' }}>{s.desc || '—'}</div>
            </div>
          </div>
        </td>
        <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, fontWeight: 500, color: '#ccc' }}>{st.trades || '—'}</td>
        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: wrColor }}>{st.trades ? st.wr + '%' : '—'}</span>
            {st.trades > 0 && <div style={{ width: 70, height: 4, background: '#1a1a1a', borderRadius: 2 }}><div style={{ width: st.wr + '%', height: '100%', background: wrColor, borderRadius: 2 }} /></div>}
          </div>
        </td>
        <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, color: st.avgWin > 0 ? '#1D9E75' : '#555' }}>{st.avgWin > 0 ? '+$' + st.avgWin : '—'}</td>
        <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, color: st.avgLoss < 0 ? '#E24B4A' : '#555' }}>{st.avgLoss < 0 ? '-$' + Math.abs(st.avgLoss) : '—'}</td>
        <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, fontWeight: 500, color: pnlColor }}>{st.trades ? (st.totalPnl >= 0 ? '+$' : '-$') + Math.abs(st.totalPnl).toLocaleString() : '—'}</td>
        <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, fontWeight: 500, color: pfColor }}>{st.pf > 0 ? st.pf === 999 ? '∞' : st.pf.toFixed(2) : '—'}</td>
        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#1a1a1a', color: '#555' }}>{st.missed}</span>
        </td>
        <td style={{ padding: '12px 8px' }}>
          {s.id !== '__unassigned__' && (
            <div style={{ display: 'flex', gap: 2 }} onClick={e => e.stopPropagation()}>
              <button onClick={() => openModal(s)} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', padding: '3px 6px', borderRadius: 4, fontSize: 13 }}>✏️</button>
              <button onClick={() => deleteStrat(s.id)} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', padding: '3px 6px', borderRadius: 4, fontSize: 13 }}>🗑️</button>
            </div>
          )}
        </td>
      </tr>
    );
  };

  const panelStats = selectedPanel ? getStratStats(selectedPanel.id) : null;

  return (
    <div style={{ display: 'flex', height: '100%', position: 'relative' }}>
      <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px', minWidth: 0 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 500, color: '#ccc', marginBottom: 2 }}>Strategies</div>
            <div style={{ fontSize: 12, color: '#555' }}>All-time performance by strategy</div>
          </div>
          <button onClick={() => openModal()} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 8, border: 'none', background: '#185FA5', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
            + New Strategy
          </button>
        </div>

        {/* Summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 20 }}>
          {[
            { label: 'Strategies', value: strategies.length, color: '#185FA5' },
            { label: 'Total Trades', value: overallStats.trades },
            { label: 'Overall P&L', value: (overallStats.pnl >= 0 ? '+$' : '-$') + Math.abs(overallStats.pnl).toLocaleString(), color: overallStats.pnl >= 0 ? '#1D9E75' : '#E24B4A' },
            { label: 'Best Strategy', value: bestStrat ? bestStrat.icon + ' ' + bestStrat.name.slice(0, 14) : '—', color: '#1D9E75' },
            { label: 'Worst Strategy', value: worstStrat ? worstStrat.icon + ' ' + worstStrat.name.slice(0, 14) : '—', color: '#E24B4A' },
          ].map((c, i) => (
            <div key={i} style={{ background: '#111', border: '1px solid #222', borderRadius: 8, padding: '10px 14px' }}>
              <div style={{ fontSize: 11, color: '#555', marginBottom: 3 }}>{c.label}</div>
              <div style={{ fontSize: 15, fontWeight: 500, color: c.color || '#ccc' }}>{c.value}</div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div style={{ background: '#111', border: '1px solid #222', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #222', background: '#0d0d0d' }}>
                <th style={{ width: 36, padding: '9px 16px' }}></th>
                {[['Strategy','left'],['Trades','right'],['Win rate','right'],['Avg winner','right'],['Avg loser','right'],['Total net P&L','right'],['Profit factor','right'],['Missed','center'],['','right']].map(([label, align]) => (
                  <th key={label} style={{ fontSize: 11, fontWeight: 500, color: '#555', padding: '9px 16px', textAlign: align, whiteSpace: 'nowrap' }}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allStratRows.length === 1 ? (
                <tr><td colSpan={10} style={{ padding: '40px 16px', textAlign: 'center', color: '#444', fontSize: 13 }}>No strategies yet. Click "New Strategy" to create one.</td></tr>
              ) : (
                allStratRows.map(s => <StratRow key={s.id} s={s} />)
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail panel */}
      {selectedPanel && panelStats && (
        <div style={{ width: 300, background: '#111', borderLeft: '1px solid #222', display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #222', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 20 }}>{selectedPanel.icon}</span>
              <span style={{ fontSize: 14, fontWeight: 500, color: '#ccc' }}>{selectedPanel.name}</span>
            </div>
            <button onClick={() => setSelectedPanel(null)} style={{ background: 'none', border: 'none', color: '#555', fontSize: 18, cursor: 'pointer' }}>×</button>
          </div>
          <div style={{ padding: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
              {[
                { l: 'Trades', v: panelStats.trades, c: '' },
                { l: 'Win rate', v: panelStats.trades ? panelStats.wr + '%' : '—', c: panelStats.wr >= 50 ? '#1D9E75' : '#E24B4A' },
                { l: 'Total P&L', v: panelStats.trades ? (panelStats.totalPnl >= 0 ? '+$' : '-$') + Math.abs(panelStats.totalPnl).toLocaleString() : '—', c: panelStats.totalPnl >= 0 ? '#1D9E75' : '#E24B4A' },
                { l: 'Profit factor', v: panelStats.pf > 0 ? (panelStats.pf === 999 ? '∞' : panelStats.pf.toFixed(2)) : '—', c: panelStats.pf >= 1 ? '#1D9E75' : '#E24B4A' },
                { l: 'Avg winner', v: panelStats.avgWin > 0 ? '+$' + panelStats.avgWin : '—', c: '#1D9E75' },
                { l: 'Avg loser', v: panelStats.avgLoss < 0 ? '-$' + Math.abs(panelStats.avgLoss) : '—', c: '#E24B4A' },
              ].map((s, i) => (
                <div key={i} style={{ background: '#1a1a1a', borderRadius: 6, padding: '8px 10px' }}>
                  <div style={{ fontSize: 10, color: '#555', marginBottom: 3 }}>{s.l}</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: s.c || '#ccc' }}>{s.v}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, color: '#555', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recent trades</div>
            {panelStats.recent && panelStats.recent.length > 0 ? panelStats.recent.map((t, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: i < panelStats.recent.length - 1 ? '1px solid #1a1a1a' : 'none' }}>
                <span style={{ fontSize: 12, color: '#666' }}>{t.date} · {t.symbol}</span>
                <span style={{ fontSize: 12, color: '#666' }}>{t.direction}</span>
                <span style={{ fontSize: 12, fontWeight: 500, color: t.pnl >= 0 ? '#1D9E75' : '#E24B4A' }}>{t.pnl >= 0 ? '+$' : '-$'}{Math.abs(t.pnl)}</span>
              </div>
            )) : <div style={{ fontSize: 12, color: '#444' }}>No trades yet</div>}
          </div>
        </div>
      )}

      {/* New/Edit Strategy Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#111', border: '1px solid #2a2a2a', borderRadius: 12, width: 460, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #222', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 15, fontWeight: 500, color: '#ccc' }}>{editStrategy ? 'Edit Strategy' : 'New Strategy'}</span>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: '#666', fontSize: 18, cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ padding: 20 }}>
              {/* Icon picker */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 8, fontWeight: 500 }}>Icon</label>
                <div onClick={() => setEmojiGridOpen(o => !o)} style={{ width: 52, height: 52, borderRadius: 10, background: '#1a1a1a', border: `1px solid ${emojiGridOpen ? '#185FA5' : '#2a2a2a'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, cursor: 'pointer', marginBottom: 8 }}>{form.icon}</div>
                {emojiGridOpen && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 4, background: '#1a1a1a', borderRadius: 8, padding: 8, border: '1px solid #2a2a2a' }}>
                    {EMOJIS.map(e => (
                      <div key={e} onClick={() => { setForm(f => ({ ...f, icon: e })); setEmojiGridOpen(false); }} style={{ width: 30, height: 30, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, cursor: 'pointer', background: form.icon === e ? '#185FA522' : 'transparent', border: form.icon === e ? '1px solid #185FA5' : '1px solid transparent' }}>{e}</div>
                    ))}
                  </div>
                )}
              </div>

              {/* Name */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 6, fontWeight: 500 }}>Strategy name</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Trendline Break AL/SL" style={{ width: '100%', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#ccc' }} />
              </div>

              {/* Description */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 6, fontWeight: 500 }}>Description</label>
                <input value={form.desc} onChange={e => setForm(f => ({ ...f, desc: e.target.value }))} placeholder="e.g. AL cross entry with SL trendline stop" style={{ width: '100%', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#ccc' }} />
              </div>

              {/* Symbol + Color */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 6, fontWeight: 500 }}>Default symbol</label>
                  <select value={form.symbol} onChange={e => setForm(f => ({ ...f, symbol: e.target.value }))} style={{ width: '100%', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#ccc' }}>
                    {['Any','MGC','MNQ','MYM','MCL','ES','NQ','Other'].map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 6, fontWeight: 500 }}>Color tag</label>
                  <div style={{ display: 'flex', gap: 8, paddingTop: 6 }}>
                    {COLORS.map(c => (
                      <div key={c} onClick={() => setForm(f => ({ ...f, color: c }))} style={{ width: 24, height: 24, borderRadius: '50%', background: c, cursor: 'pointer', border: form.color === c ? '2px solid #fff' : '2px solid transparent' }} />
                    ))}
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 6, fontWeight: 500 }}>Notes <span style={{ fontWeight: 400, color: '#444' }}>(optional)</span></label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Any specific rules or conditions..." style={{ width: '100%', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#ccc', resize: 'none', fontFamily: 'inherit' }} />
              </div>
            </div>
            <div style={{ padding: '12px 20px', borderTop: '1px solid #222', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setShowModal(false)} style={{ fontSize: 13, padding: '6px 18px', borderRadius: 8, cursor: 'pointer', background: 'transparent', border: '1px solid #2a2a2a', color: '#888' }}>Cancel</button>
              <button onClick={saveStrat} style={{ fontSize: 13, padding: '6px 18px', borderRadius: 8, cursor: 'pointer', background: '#185FA5', border: 'none', color: '#fff', fontWeight: 500 }}>Save Strategy</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
