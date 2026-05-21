import React, { useState } from 'react';
import { supabase } from '../supabase';
import { GRADES, GRADE_COLORS, TIERS, TIER_COLORS, getMultiplier, calcPnL, getSession, autoGrade, EMPTY_FORM } from '../App';
import TradeReviewChart from '../components/TradeReviewChart';
import TOSUploader from '../components/TOSUploader';

// ─── Hardcoded strategies (match strategy_id slugs in trades table) ───────────
const STRATEGIES = [
  { id: 'strat-aplus-prime',       name: 'A+ Prime',             icon: '⭐', color: '#1D9E75' },
  { id: 'strat-strong-al-weak-sl', name: 'Strong AL / Weak SL',  icon: '📈', color: '#185FA5' },
  { id: 'strat-weak-al-strong-sl', name: 'Weak AL / Strong SL',  icon: '🛡️', color: '#BA7517' },
  { id: 'strat-both-weak',         name: 'Both Weak',            icon: '⚠️', color: '#E24B4A' },
  { id: 'strat-unassigned',        name: 'Unassigned',           icon: '📋', color: '#666' },
];

// ─── Tertiary Warning ─────────────────────────────────────────────────────────
function TertiaryWarning({ alTier, slTier }) {
  const al = alTier === 'Tertiary', sl = slTier === 'Tertiary';
  if (!al && !sl) return null;
  const parts = [al && 'Action Line', sl && 'Safety Line'].filter(Boolean);
  return (
    <div style={{ background: '#E24B4A18', border: '1.5px solid #E24B4A55', borderRadius: 8, padding: '10px 14px', marginBottom: 12, display: 'flex', gap: 10 }}>
      <span style={{ fontSize: 18 }}>⚠️</span>
      <div>
        <div style={{ color: '#E24B4A', fontWeight: 600, fontSize: 13 }}>Tertiary {parts.join(' & ')} — Low Reliability</div>
        <div style={{ color: '#aaa', fontSize: 12, marginTop: 2 }}>Tertiary SL trades cost −$460 in April. Consider skipping or requiring stronger confluence.</div>
      </div>
    </div>
  );
}

// ─── Trade Form ───────────────────────────────────────────────────────────────
function TradeForm({ form, setForm, onSubmit, onCancel, uploading, isEdit }) {
  const [stratError, setStratError] = useState(false);

  const confOptions = ['AL crossed', 'Yellow S/R cleared', 'SL identified', 'Open space'];
  const confs = Array.isArray(form.confirmations) ? form.confirmations : (form.confirmations || '').split(',').filter(Boolean);
  const toggleConf = (c) => {
    const current = Array.isArray(form.confirmations) ? form.confirmations : (form.confirmations || '').split(',').filter(Boolean);
    setForm(f => ({ ...f, confirmations: current.includes(c) ? current.filter(x => x !== c) : [...current, c] }));
  };
  const tog = (active) => `tog ${active ? 'tog-blue' : ''}`;

  const handleSubmit = () => {
    if (!form.strategy_id) {
      setStratError(true);
      const el = document.getElementById('strategy-field');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setStratError(false);
    onSubmit();
  };

  const pickStrategy = (id) => {
    setForm(f => ({ ...f, strategy_id: id }));
    setStratError(false);
  };

  return (
    <div className="form-card">
      <h2>{isEdit ? 'Edit Trade' : 'Log New Trade'}</h2>

      {/* Strategy — required, shown first */}
      <div id="strategy-field" className="field" style={{ marginBottom: 16 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          Strategy
          <span style={{ fontSize: 11, color: '#E24B4A', fontWeight: 500 }}>* required</span>
        </label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
          {STRATEGIES.map(s => (
            <button key={s.id} onClick={() => pickStrategy(s.id)} style={{
              padding: '6px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
              border: `1.5px solid ${form.strategy_id === s.id ? (s.color || '#185FA5') : stratError ? '#E24B4A55' : '#2a2a2a'}`,
              background: form.strategy_id === s.id ? (s.color || '#185FA5') + '22' : stratError ? '#E24B4A08' : 'transparent',
              color: form.strategy_id === s.id ? (s.color || '#185FA5') : stratError ? '#E24B4A88' : '#888',
              fontWeight: form.strategy_id === s.id ? 600 : 400,
            }}>
              {s.icon} {s.name}
            </button>
          ))}
        </div>
        {stratError && (
          <div style={{ marginTop: 6, fontSize: 12, color: '#E24B4A', display: 'flex', alignItems: 'center', gap: 4 }}>
            ⚠️ Please select a strategy before logging this trade.
          </div>
        )}
      </div>

      <div className="form-grid-4">
        <div className="field"><label>Trade #</label><input type="number" value={form.trade_number || ''} onChange={e => setForm(f => ({ ...f, trade_number: e.target.value }))} /></div>
        <div className="field"><label>Entry Date</label><input type="date" value={form.date || ''} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
        <div className="field"><label>Entry Time (EST)</label><input type="time" value={form.time || ''} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} /></div>
      </div>
      <div className="form-grid-3">
        <div className="field"><label>Exit Date</label><input type="date" value={form.exit_date || ''} onChange={e => setForm(f => ({ ...f, exit_date: e.target.value }))} /></div>
        <div className="field"><label>Exit Time (EST)</label><input type="time" value={form.exit_time || ''} onChange={e => setForm(f => ({ ...f, exit_time: e.target.value }))} /></div>
      </div>

      <div className="form-grid-3">
        <div className="field"><label>Account</label>
          <div className="toggle-row">{['A1','A2'].map(a => <button key={a} className={tog(form.account===a)} onClick={() => setForm(f => ({ ...f, account: a }))}>{a}</button>)}</div>
        </div>
        <div className="field"><label>Symbol</label>
          <div className="toggle-row">
            {['MGC','MNQ','MYM','MCL','OTHER'].map(s => (
              <button key={s} className={tog(form.symbol===s)} onClick={() => setForm(f => ({ ...f, symbol: s, custom_symbol: '', custom_multiplier: '' }))}>{s}</button>
            ))}
          </div>
          {form.symbol === 'OTHER' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 6 }}>
              <input type="text" placeholder="Symbol (e.g. ES)" value={form.custom_symbol || ''} onChange={e => setForm(f => ({ ...f, custom_symbol: e.target.value }))} style={{ background: '#0d0d0d', border: '1px solid #2a2a2a', borderRadius: 6, padding: '5px 10px', color: '#ccc', fontSize: 12 }} />
              <input type="number" placeholder="$/point multiplier" value={form.custom_multiplier || ''} onChange={e => setForm(f => ({ ...f, custom_multiplier: e.target.value }))} style={{ background: '#0d0d0d', border: '1px solid #2a2a2a', borderRadius: 6, padding: '5px 10px', color: '#ccc', fontSize: 12 }} />
            </div>
          )}
        </div>
        <div className="field"><label>Direction</label>
          <div className="toggle-row">
            <button className={`tog ${form.direction==='long'?'tog-green':''}`} onClick={() => setForm(f => ({ ...f, direction: 'long' }))}>Long</button>
            <button className={`tog ${form.direction==='short'?'tog-red':''}`} onClick={() => setForm(f => ({ ...f, direction: 'short' }))}>Short</button>
          </div>
        </div>
        <div className="field"><label>Contracts</label>
          <div className="toggle-row">
            {['1','2','3'].map(n => (
              <button key={n} className={tog(form.contracts===n)} onClick={() => setForm(f => ({ ...f, contracts: n }))}>{n}</button>
            ))}
            <input type="number" min="1" placeholder="Other" value={!['1','2','3'].includes(form.contracts) ? form.contracts : ''} onChange={e => setForm(f => ({ ...f, contracts: e.target.value }))} style={{ width: 60, background: '#0d0d0d', border: '1px solid #2a2a2a', borderRadius: 6, padding: '4px 8px', color: '#ccc', fontSize: 12 }} />
          </div>
        </div>
      </div>

      <div className="form-grid-4">
        <div className="field"><label>Entry</label><input type="number" step="0.01" value={form.entry||''} onChange={e => setForm(f => ({ ...f, entry: e.target.value }))} /></div>
        <div className="field"><label>Exit</label><input type="number" step="0.01" value={form.exit_price||''} onChange={e => setForm(f => ({ ...f, exit_price: e.target.value }))} /></div>
        <div className="field"><label>Stop</label><input type="number" step="0.01" value={form.stop||''} onChange={e => setForm(f => ({ ...f, stop: e.target.value }))} /></div>
        <div className="field"><label>Target</label><input type="number" step="0.01" value={form.target||''} onChange={e => setForm(f => ({ ...f, target: e.target.value }))} /></div>
      </div>

      <div className="form-grid-2">
        <div className="field"><label>Exit Reason</label>
          <div className="toggle-row">{['target','stop','manual','open'].map(r => <button key={r} className={tog(form.exit_reason===r)} onClick={() => setForm(f => ({ ...f, exit_reason: r }))}>{r}</button>)}</div>
        </div>
        <div className="field">
          <label>Grade <span style={{ fontSize: 11, color: '#ccc', fontWeight: 400 }}>(auto-calculated)</span></label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
            <span className="grade-badge" style={{ background: GRADE_COLORS[form.grade]+'33', color: GRADE_COLORS[form.grade], fontSize: 18, fontWeight: 700, padding: '6px 18px', borderRadius: 8, border: '1.5px solid '+GRADE_COLORS[form.grade] }}>{GRADES[form.grade]||form.grade}</span>
            <span style={{ fontSize: 12, color: '#ccc' }}>{form.grade==='aplus'?'~80% win rate':form.grade==='a'?'~55% win rate':'~40% win rate'}</span>
          </div>
        </div>
      </div>

      <TertiaryWarning alTier={form.al_tier} slTier={form.sl_tier} />

      {/* AL block */}
      <div style={{ background: '#111', border: '1px solid #222', borderRadius: 8, padding: '12px 14px', marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: '#ccc', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Action Line</div>
        <div className="form-grid-3">
          <div className="field"><label>Strength</label>
            <div className="toggle-row">
              <button className={`tog ${form.al_strength==='strong'?'tog-green':''}`} onClick={() => setForm(f => { const u={...f,al_strength:'strong'}; return {...u,grade:autoGrade('strong',u.al_touches,u.al_age,u.sl_quality,u.sl_touches,u.sl_age)}; })}>★ Strong</button>
              <button className={`tog ${form.al_strength==='standard'?'tog-blue':''}`} onClick={() => setForm(f => { const u={...f,al_strength:'standard'}; return {...u,grade:autoGrade('standard',u.al_touches,u.al_age,u.sl_quality,u.sl_touches,u.sl_age)}; })}>Standard</button>
            </div>
          </div>
          <div className="field"><label>Touches</label><input type="number" value={form.al_touches||''} onChange={e => setForm(f => { const u={...f,al_touches:e.target.value}; return {...u,grade:autoGrade(u.al_strength,u.al_touches,u.al_age,u.sl_quality,u.sl_touches,u.sl_age)}; })} /></div>
          <div className="field"><label>Age</label>
            <div className="toggle-row">{['<1day','<1wk','1wk+'].map(a => <button key={a} className={tog(form.al_age===a)} onClick={() => setForm(f => { const u={...f,al_age:a}; return {...u,grade:autoGrade(u.al_strength,u.al_touches,a,u.sl_quality,u.sl_touches,u.sl_age)}; })}>{a}</button>)}</div>
          </div>
        </div>
        <div className="field" style={{ marginBottom: 0 }}><label>AL Tier</label>
          <div className="toggle-row">{TIERS.map(tier => <button key={tier} className="tog" style={form.al_tier===tier?{background:TIER_COLORS[tier]+'33',color:TIER_COLORS[tier],borderColor:TIER_COLORS[tier]}:{}} onClick={() => setForm(f => ({ ...f, al_tier: tier }))}>{tier}</button>)}</div>
        </div>
      </div>

      {/* SL block */}
      <div style={{ background: '#111', border: '1px solid #222', borderRadius: 8, padding: '12px 14px', marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: '#ccc', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Safety Line</div>
        <div className="form-grid-3">
          <div className="field"><label>Quality</label>
            <div className="toggle-row">
              <button className={`tog ${form.sl_quality==='strong'?'tog-green':''}`} onClick={() => setForm(f => { const u={...f,sl_quality:'strong'}; return {...u,grade:autoGrade(u.al_strength,u.al_touches,u.al_age,'strong',u.sl_touches,u.sl_age)}; })}>★ Strong</button>
              <button className={`tog ${form.sl_quality==='weak'?'tog-red':''}`} onClick={() => setForm(f => { const u={...f,sl_quality:'weak'}; return {...u,grade:autoGrade(u.al_strength,u.al_touches,u.al_age,'weak',u.sl_touches,u.sl_age)}; })}>Weak</button>
            </div>
          </div>
          <div className="field"><label>Touches</label><input type="number" value={form.sl_touches||''} onChange={e => setForm(f => { const u={...f,sl_touches:e.target.value}; return {...u,grade:autoGrade(u.al_strength,u.al_touches,u.al_age,u.sl_quality,u.sl_touches,u.sl_age)}; })} /></div>
          <div className="field"><label>Age</label>
            <div className="toggle-row">{['<1day','<1wk','1wk+'].map(a => <button key={a} className={tog(form.sl_age===a)} onClick={() => setForm(f => { const u={...f,sl_age:a}; return {...u,grade:autoGrade(u.al_strength,u.al_touches,u.al_age,u.sl_quality,u.sl_touches,a)}; })}>{a}</button>)}</div>
          </div>
        </div>
        <div className="form-grid-2" style={{ marginTop: 8, marginBottom: 0 }}>
          <div className="field" style={{ marginBottom: 0 }}><label>SL Tier</label>
            <div className="toggle-row">{TIERS.map(tier => <button key={tier} className="tog" style={form.sl_tier===tier?{background:TIER_COLORS[tier]+'33',color:TIER_COLORS[tier],borderColor:TIER_COLORS[tier]}:{}} onClick={() => setForm(f => ({ ...f, sl_tier: tier }))}>{tier}</button>)}</div>
          </div>
          <div className="field" style={{ marginBottom: 0 }}><label>SL Price</label><input type="number" step="0.01" value={form.sl_price||''} onChange={e => setForm(f => ({ ...f, sl_price: e.target.value }))} /></div>
        </div>
      </div>

      <div className="form-grid-2">
        <div className="field"><label>Yellow Levels</label><input type="text" placeholder="e.g. 4650/4586/4420" value={form.yellow_levels||''} onChange={e => setForm(f => ({ ...f, yellow_levels: e.target.value }))} /></div>
      </div>
      <div className="field"><label>Confirmations</label>
        <div className="toggle-row">{confOptions.map(c => <button key={c} className={`tog ${confs.includes(c)?'tog-green':''}`} onClick={() => toggleConf(c)}>{c}</button>)}</div>
      </div>
      <div className="field"><label>Notes</label><textarea value={form.notes||''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
      <div className="field">
        <label>Chart Image&nbsp;{isEdit && form.chart_url && <a href={form.chart_url} target="_blank" rel="noreferrer" className="chart-link">(view current)</a>}</label>
        <input type="file" accept="image/*" onChange={e => setForm(f => ({ ...f, chart_file: e.target.files[0] }))} />
      </div>
      <div className="form-actions">
        <button className="btn-cancel" onClick={onCancel}>Cancel</button>
        <button className="btn-submit" onClick={handleSubmit} disabled={uploading}>{uploading ? 'Saving...' : isEdit ? 'Save Changes' : 'Log Trade'}</button>
      </div>
    </div>
  );
}

// ─── Key Levels & Pre-Trade Check ─────────────────────────────────────────────
const DEFAULT_LEVELS = [
  { id: 1, name: 'W($4900)', price: 4900, symbol: 'MGC' },
  { id: 2, name: '4H($4750)', price: 4750, symbol: 'MGC' },
  { id: 3, name: '4($4642.1)', price: 4642.1, symbol: 'MGC' },
  { id: 4, name: 'W($4600)', price: 4600, symbol: 'MGC' },
  { id: 5, name: 'M($4600)', price: 4600.1, symbol: 'MGC' },
  { id: 6, name: 'M($4400)', price: 4400, symbol: 'MGC' },
];

function ManageLevels() {
  const storageKey = 'tl_key_levels';
  const [levels, setLevels] = useState(() => {
    try { const s = localStorage.getItem(storageKey) || sessionStorage.getItem(storageKey); const parsed = s ? JSON.parse(s) : DEFAULT_LEVELS; return Array.isArray(parsed) ? parsed : DEFAULT_LEVELS; } catch { return DEFAULT_LEVELS; }
  });
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newSymbol, setNewSymbol] = useState('MGC');
  const [editId, setEditId] = useState(null);
  const [editPrice, setEditPrice] = useState('');
  const [open, setOpen] = useState(false);
  const [lvlSymbol, setLvlSymbol] = useState('MGC');
  const [ptSymbol, setPtSymbol] = useState('MGC');
  const [ptDirection, setPtDirection] = useState('short');
  const [ptEntry, setPtEntry] = useState('');
  const [ptStop, setPtStop] = useState('');
  const [ptTarget, setPtTarget] = useState('');
  const [ptResult, setPtResult] = useState(null);

  const allSymbols = [...new Set([...levels.map(l => l.symbol), 'MGC', 'MNQ', 'MYM', 'MCL'])];

  const save = (updated) => {
    setLevels(updated);
    try { localStorage.setItem(storageKey, JSON.stringify(updated)); } catch {}
    try { sessionStorage.setItem(storageKey, JSON.stringify(updated)); } catch {}
  };
  const addLevel = () => { if (!newName || !newPrice) return; save([...levels, { id: Date.now(), name: newName, price: parseFloat(newPrice), symbol: newSymbol }]); setNewName(''); setNewPrice(''); };
  const deleteLevel = (id) => save(levels.filter(l => l.id !== id));
  const startEditLevel = (l) => { setEditId(l.id); setEditPrice(String(l.price)); };
  const saveEdit = (id) => { save(levels.map(l => l.id === id ? { ...l, price: parseFloat(editPrice) } : l)); setEditId(null); setEditPrice(''); };

  const checkTrade = () => {
    const entry = parseFloat(ptEntry), stop = parseFloat(ptStop), target = parseFloat(ptTarget);
    if (!entry || !stop || !target) return;
    const mult = getMultiplier(ptSymbol);
    const isLong = ptDirection === 'long';
    const stopDist = isLong ? entry - stop : stop - entry;
    const targetDist = isLong ? target - entry : entry - target;
    const rr = stopDist > 0 ? Math.round((targetDist / stopDist) * 100) / 100 : 0;
    const maxGain = Math.round(targetDist * mult);
    const maxLoss = Math.round(stopDist * mult);
    const symLevels = levels.filter(l => l.symbol === ptSymbol);
    const blockingLevels = symLevels.filter(l => isLong ? l.price > entry && l.price < target : l.price < entry && l.price > target).sort((a, b) => isLong ? a.price - b.price : b.price - a.price);
    let nearestToTarget = null, nearestDist = Infinity;
    symLevels.forEach(l => { const d = Math.abs(l.price - target); if (d < nearestDist) { nearestDist = d; nearestToTarget = l; } });
    const beyondTarget = symLevels.filter(l => isLong ? l.price > target : l.price < target).sort((a, b) => isLong ? a.price - b.price : b.price - a.price);
    const nextLevel = beyondTarget[0] || null;
    const warnings = [], suggestions = [];
    if (stopDist <= 0) warnings.push('Stop is on wrong side of entry');
    if (targetDist <= 0) warnings.push('Target is on wrong side of entry');
    if (blockingLevels.length > 0) {
      const closest = blockingLevels[0];
      warnings.push(`${closest.name} @ ${closest.price} is blocking your path`);
      const sTarget = isLong ? closest.price - 2 : closest.price + 2;
      const sDist = Math.abs(sTarget - entry);
      const sRR = stopDist > 0 ? Math.round((sDist / stopDist) * 100) / 100 : 0;
      suggestions.push({ label: `Just before ${closest.name}`, price: sTarget.toFixed(1), rr: sRR, gain: Math.round(sDist * mult), note: 'Exit before resistance' });
      if (blockingLevels.length > 1) {
        const second = blockingLevels[1];
        const s2 = isLong ? second.price - 2 : second.price + 2;
        const s2Dist = Math.abs(s2 - entry);
        suggestions.push({ label: `Just before ${second.name}`, price: s2.toFixed(1), rr: stopDist > 0 ? Math.round((s2Dist / stopDist) * 100) / 100 : 0, gain: Math.round(s2Dist * mult), note: 'If first level breaks' });
      }
    } else if (nearestDist > 20) {
      warnings.push(`Target @ ${target} has no key level nearby (nearest: ${nearestToTarget ? nearestToTarget.name + ' @ ' + nearestToTarget.price : 'none'})`);
      if (nextLevel) { const nd = Math.abs(nextLevel.price - entry); suggestions.push({ label: `Move to ${nextLevel.name}`, price: nextLevel.price, rr: stopDist > 0 ? Math.round((nd / stopDist) * 100) / 100 : 0, gain: Math.round(nd * mult), note: 'Next key level' }); }
    }
    setPtResult({ rr, maxGain, maxLoss, nearestToTarget, nearestDist: Math.round(nearestDist), blockingLevels, nextLevel, suggestions, warnings, targetAtLevel: nearestDist <= 10 });
  };

  return (
    <div style={{ marginBottom: 20 }}>
      <div onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#111', border: '1px solid #222', borderRadius: open ? '8px 8px 0 0' : 8, padding: '10px 16px', cursor: 'pointer', userSelect: 'none' }}>
        <span style={{ fontWeight: 500, fontSize: 14, color: '#ccc' }}>📍 Key Levels & Pre-Trade Check</span>
        <span style={{ color: '#bbb', fontSize: 13 }}>{open ? '▲ Hide' : '▼ Show'}</span>
      </div>
      {open && (
        <div style={{ border: '1px solid #222', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* Key Levels */}
            <div className="table-card" style={{ marginBottom: 0 }}>
              <div className="table-header" style={{ marginBottom: 12 }}>
                <h2>Key Levels</h2>
                <div style={{ display: 'flex', gap: 4 }}>
                  {allSymbols.map(s => (
                    <button key={s} onClick={() => setLvlSymbol(s)} style={{ padding: '3px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer', border: '1px solid', borderColor: lvlSymbol===s?'#185FA5':'#2a2a2a', background: lvlSymbol===s?'#185FA522':'transparent', color: lvlSymbol===s?'#185FA5':'#888' }}>{s}</button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 70px auto', gap: 8, marginBottom: 14 }}>
                <input placeholder="Name" value={newName} onChange={e => setNewName(e.target.value)} style={{ background: '#111', border: '1px solid #2a2a2a', borderRadius: 6, padding: '6px 10px', color: '#ccc', fontSize: 13 }} />
                <input placeholder="Price" type="number" step="0.1" value={newPrice} onChange={e => setNewPrice(e.target.value)} style={{ background: '#111', border: '1px solid #2a2a2a', borderRadius: 6, padding: '6px 10px', color: '#ccc', fontSize: 13 }} />
                <select value={newSymbol} onChange={e => setNewSymbol(e.target.value)} style={{ background: '#111', border: '1px solid #2a2a2a', borderRadius: 6, padding: '6px 8px', color: '#ccc', fontSize: 13 }}>
                  {allSymbols.map(s => <option key={s}>{s}</option>)}
                </select>
                <button onClick={addLevel} style={{ background: '#185FA5', border: 'none', borderRadius: 6, padding: '6px 12px', color: '#fff', fontSize: 13, cursor: 'pointer' }}>+ Add</button>
              </div>
              {levels.filter(l => l.symbol === lvlSymbol).sort((a, b) => b.price - a.price).map(l => (
                <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, background: '#111', borderRadius: 6, padding: '6px 10px' }}>
                  <span style={{ flex: 1, fontSize: 13, color: '#ccc' }}>{l.name}</span>
                  {editId === l.id ? (<>
                    <input type="number" step="0.1" value={editPrice} onChange={e => setEditPrice(e.target.value)} style={{ width: 80, background: '#1a1a1a', border: '1px solid #185FA5', borderRadius: 4, padding: '3px 6px', color: '#ccc', fontSize: 12 }} />
                    <button onClick={() => saveEdit(l.id)} style={{ background: '#1D9E75', border: 'none', borderRadius: 4, padding: '3px 10px', color: '#fff', fontSize: 12, cursor: 'pointer' }}>Save</button>
                    <button onClick={() => setEditId(null)} style={{ background: '#333', border: 'none', borderRadius: 4, padding: '3px 8px', color: '#ccc', fontSize: 12, cursor: 'pointer' }}>×</button>
                  </>) : (<>
                    <span style={{ fontSize: 13, color: '#1D9E75', fontWeight: 500, minWidth: 60, textAlign: 'right' }}>{l.price}</span>
                    <button onClick={() => startEditLevel(l)} style={{ background: '#222', border: 'none', borderRadius: 4, padding: '3px 8px', color: '#ccc', fontSize: 11, cursor: 'pointer' }}>Edit</button>
                    <button onClick={() => deleteLevel(l.id)} style={{ background: 'none', border: 'none', color: '#E24B4A', fontSize: 14, cursor: 'pointer', padding: '0 4px' }}>×</button>
                  </>)}
                </div>
              ))}
              {levels.filter(l => l.symbol === lvlSymbol).length === 0 && (
                <div style={{ color: '#999', fontSize: 13 }}>No {lvlSymbol} levels saved yet.</div>
              )}
            </div>

            {/* Pre-Trade Check */}
            <div className="table-card" style={{ marginBottom: 0 }}>
              <div className="table-header" style={{ marginBottom: 14 }}><h2>Pre-Trade Check</h2></div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                {allSymbols.map(s => (
                  <button key={s} onClick={() => { setPtSymbol(s); setPtResult(null); }} style={{ padding: '5px 14px', borderRadius: 6, fontSize: 13, cursor: 'pointer', border: '1px solid', borderColor: ptSymbol===s?'#185FA5':'#2a2a2a', background: ptSymbol===s?'#185FA522':'transparent', color: ptSymbol===s?'#185FA5':'#888' }}>{s}</button>
                ))}
                {['short','long'].map(d => (
                  <button key={d} onClick={() => { setPtDirection(d); setPtResult(null); }} style={{ padding: '5px 14px', borderRadius: 6, fontSize: 13, cursor: 'pointer', border: '1px solid', borderColor: ptDirection===d?(d==='short'?'#E24B4A':'#1D9E75'):'#2a2a2a', background: ptDirection===d?(d==='short'?'#E24B4A22':'#1D9E7522'):'transparent', color: ptDirection===d?(d==='short'?'#E24B4A':'#1D9E75'):'#888' }}>{d.charAt(0).toUpperCase()+d.slice(1)}</button>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
                {[['Entry',ptEntry,setPtEntry],['Stop',ptStop,setPtStop],['Target',ptTarget,setPtTarget]].map(([label,val,setter]) => (
                  <div key={label} className="field" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: 11 }}>{label}</label>
                    <input type="number" step="0.1" value={val} onChange={e => { setter(e.target.value); setPtResult(null); }} style={{ width: '100%', background: '#111', border: '1px solid #2a2a2a', borderRadius: 6, padding: '6px 10px', color: '#ccc', fontSize: 13 }} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, marginBottom: 14 }}>
                <button onClick={checkTrade} style={{ background: '#185FA5', border: 'none', borderRadius: 8, padding: '10px', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Check Setup</button>
                <button onClick={() => { setPtEntry(''); setPtStop(''); setPtTarget(''); setPtResult(null); }} style={{ background: '#222', border: '1px solid #2a2a2a', borderRadius: 8, padding: '10px 14px', color: '#ccc', fontSize: 13, cursor: 'pointer' }}>Clear</button>
              </div>
              {ptResult && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    {[{l:'R:R',v:ptResult.rr+':1',c:ptResult.rr>=1.5?'#1D9E75':'#E24B4A'},{l:'Max Gain',v:'+$'+ptResult.maxGain,c:'#1D9E75'},{l:'Max Loss',v:'-$'+ptResult.maxLoss,c:'#E24B4A'}].map((c,i) => (
                      <div key={i} style={{ background: '#111', borderRadius: 8, padding: '8px 12px', textAlign: 'center' }}>
                        <div style={{ fontSize: 11, color: '#aaa', marginBottom: 3 }}>{c.l}</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: c.c }}>{c.v}</div>
                      </div>
                    ))}
                  </div>
                  {ptResult.blockingLevels.length > 0 && (
                    <div style={{ background: '#E24B4A12', border: '1.5px solid #E24B4A55', borderRadius: 8, padding: '10px 12px' }}>
                      <div style={{ color: '#E24B4A', fontWeight: 600, fontSize: 13, marginBottom: 6 }}>⛔ {ptResult.blockingLevels.length} Level{ptResult.blockingLevels.length>1?'s':''} Blocking</div>
                      {ptResult.blockingLevels.map((l, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#ccc', marginBottom: i<ptResult.blockingLevels.length-1?4:0 }}>
                          <span style={{ fontWeight: 500 }}>{l.name} @ {l.price}</span>
                          <span style={{ color: '#E24B4A', fontSize: 12 }}>{Math.round(Math.abs(l.price-parseFloat(ptEntry)))} pts from entry</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {ptResult.suggestions.length > 0 && (
                    <div style={{ background: '#185FA512', border: '1px solid #185FA544', borderRadius: 8, padding: '10px 12px' }}>
                      <div style={{ fontSize: 12, color: '#185FA5', fontWeight: 600, marginBottom: 8 }}>🎯 Recommended Targets</div>
                      {ptResult.suggestions.map((s, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: i<ptResult.suggestions.length-1?8:0, background: '#111', borderRadius: 6, padding: '7px 10px' }}>
                          <div><div style={{ fontSize: 14, color: '#ccc', fontWeight: 600 }}>@ {s.price}</div><div style={{ fontSize: 12, color: '#ccc' }}>{s.label} · {s.note}</div></div>
                          <div style={{ textAlign: 'right' }}><div style={{ fontSize: 13, fontWeight: 600, color: s.rr>=1.5?'#1D9E75':'#BA7517' }}>{s.rr}:1 R:R</div><div style={{ fontSize: 11, color: '#1D9E75' }}>+${s.gain}</div></div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ background: '#111', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ fontSize: 11, color: '#aaa', marginBottom: 4 }}>Nearest Level to Target</div>
                    {ptResult.nearestToTarget ? (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#ccc', fontWeight: 500 }}>{ptResult.nearestToTarget.name} @ {ptResult.nearestToTarget.price}</span>
                        <span style={{ fontSize: 12, color: ptResult.nearestDist<=10?'#1D9E75':ptResult.nearestDist<=20?'#BA7517':'#E24B4A' }}>{ptResult.nearestDist} pts {ptResult.targetAtLevel?'✅':ptResult.nearestDist<=20?'⚠️':'❌'}</span>
                      </div>
                    ) : <span style={{ color: '#aaa' }}>No levels for {ptSymbol}</span>}
                  </div>
                  {ptResult.warnings.filter(w => !w.includes('blocking')).map((w, i) => (
                    <div key={i} style={{ background: '#E24B4A12', border: '1px solid #E24B4A44', borderRadius: 8, padding: '10px 12px', color: '#E24B4A', fontSize: 13 }}>⚠️ {w}</div>
                  ))}
                  {ptResult.warnings.length === 0 && (
                    <div style={{ background: '#1D9E7512', border: '1px solid #1D9E7544', borderRadius: 8, padding: '10px 12px', color: '#1D9E75', fontSize: 13 }}>✅ Clean path to target</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Trade View Page ──────────────────────────────────────────────────────────
const PAGE_SIZE = 25;

export default function TradeView({ trades, filteredTrades, strategies, reloadTrades, setMsg }) {
  const [activeFilter, setActiveFilter] = useState('all');
  const [sortCol, setSortCol] = useState('date');
  const [sortDir, setSortDir] = useState('desc');
  const [tablePage, setTablePage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editingTrade, setEditingTrade] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [uploading, setUploading] = useState(false);
  const [chartModal, setChartModal] = useState(null);
  const [reviewingTrade, setReviewingTrade] = useState(null);

  const allTrades = Array.isArray(filteredTrades) ? filteredTrades : [];
  const safeTrades = Array.isArray(trades) ? trades : [];

  const nextTradeNumber = () => {
    if (!safeTrades.length) return 1;
    const nums = safeTrades.map(t => t.trade_number).filter(Boolean);
    return nums.length ? Math.max(...nums) + 1 : safeTrades.length + 1;
  };

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
    setTablePage(1);
  };

  const symbols = [...new Set(allTrades.map(t => t.symbol === 'OTHER' ? (t.custom_symbol || 'OTHER') : t.symbol))];

  const getWeekRange = () => {
    const now = new Date(), day = now.getDay(), diffToMon = day === 0 ? -6 : 1 - day;
    const monday = new Date(now); monday.setDate(now.getDate() + diffToMon); monday.setHours(0,0,0,0);
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6); sunday.setHours(23,59,59,999);
    return { monday, sunday };
  };

  const applyLocalFilter = (base) => {
    if (activeFilter === 'all') return base;
    if (activeFilter === 'win') return base.filter(t => t.pnl > 0);
    if (activeFilter === 'loss') return base.filter(t => t.pnl < 0);
    if (activeFilter === 'no-strategy') return base.filter(t => !t.strategy_id);
    if (activeFilter === 'week') {
      const { monday, sunday } = getWeekRange();
      return base.filter(t => { if (!t.date) return false; const d = new Date(t.date + 'T12:00:00'); return d >= monday && d <= sunday; });
    }
    if (['aplus','a','aminus'].includes(activeFilter)) return base.filter(t => t.grade === activeFilter);
    if (symbols.includes(activeFilter)) return base.filter(t => (t.symbol === 'OTHER' ? t.custom_symbol : t.symbol) === activeFilter);
    if (activeFilter === 'al-primary') return base.filter(t => t.al_tier === 'Primary');
    if (activeFilter === 'al-secondary') return base.filter(t => t.al_tier === 'Secondary');
    if (activeFilter === 'al-tertiary') return base.filter(t => t.al_tier === 'Tertiary');
    if (activeFilter === 'sl-primary') return base.filter(t => t.sl_tier === 'Primary');
    if (activeFilter === 'sl-secondary') return base.filter(t => t.sl_tier === 'Secondary');
    if (activeFilter === 'sl-tertiary') return base.filter(t => t.sl_tier === 'Tertiary');
    if (STRATEGIES.find(s => s.id === activeFilter)) return base.filter(t => t.strategy_id === activeFilter);
    return base;
  };

  const localFiltered = applyLocalFilter(allTrades);
  const sorted = [...localFiltered].sort((a, b) => {
    let av = a[sortCol], bv = b[sortCol];
    if (av === null || av === undefined) av = '';
    if (bv === null || bv === undefined) bv = '';
    if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av;
    return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
  });

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paginated = sorted.slice((tablePage - 1) * PAGE_SIZE, tablePage * PAGE_SIZE);
  const noStratCount = allTrades.filter(t => !t.strategy_id).length;

  const buildPayload = async (f, existingChartUrl = null) => {
    let chart_url = existingChartUrl;
    if (f.chart_file) {
      const file = f.chart_file;
      const path = `charts/trade-${f.trade_number}-${Date.now()}.${file.name.split('.').pop()}`;
      const { error: upErr } = await supabase.storage.from('trade-charts').upload(path, file);
      if (!upErr) { const { data: urlData } = supabase.storage.from('trade-charts').getPublicUrl(path); chart_url = urlData.publicUrl; }
    }
    const pnl = calcPnL({ ...f, exit_price: parseFloat(f.exit_price), entry: parseFloat(f.entry) });
    const session = getSession(f.time);
    const confs = Array.isArray(f.confirmations) ? f.confirmations.join(',') : (f.confirmations || '');
    const trade = {
      ...f,
      entry: f.entry ? parseFloat(f.entry) : null,
      exit_price: f.exit_price ? parseFloat(f.exit_price) : null,
      stop: f.stop ? parseFloat(f.stop) : null,
      target: f.target ? parseFloat(f.target) : null,
      sl_price: f.sl_price ? parseFloat(f.sl_price) : null,
      trade_number: f.trade_number ? parseInt(f.trade_number) : null,
      al_touches: f.al_touches ? parseInt(f.al_touches) : null,
      sl_touches: f.sl_touches ? parseInt(f.sl_touches) : null,
      al_tier: f.al_tier || 'Primary',
      sl_tier: f.sl_tier || 'Primary',
      contracts: f.contracts ? parseFloat(f.contracts) : 1,
      custom_symbol: f.custom_symbol || null,
      custom_multiplier: f.custom_multiplier ? parseFloat(f.custom_multiplier) : null,
      confirmations: confs, session, chart_url, pnl,
      exit_time: f.exit_time || null,
      exit_date: f.exit_date || null,
      strategy_id: f.strategy_id || null,
    };
    delete trade.chart_file;
    return trade;
  };

  const submitTrade = async () => {
    setUploading(true);
    const trade = await buildPayload(form);
    const { error } = await supabase.from('trades').insert([trade]);
    if (error) { setMsg('Error: ' + error.message); }
    else { setMsg('Trade logged!'); setShowForm(false); setForm({ ...EMPTY_FORM }); await reloadTrades(); }
    setUploading(false); setTimeout(() => setMsg(''), 3000);
  };

  const updateTrade = async () => {
    setUploading(true);
    const trade = await buildPayload(form, form.chart_url);
    const { id, created_at, ...rest } = trade;
    const { error } = await supabase.from('trades').update(rest).eq('id', editingTrade.id);
    if (error) { setMsg('Error: ' + error.message); }
    else { setMsg('Trade updated!'); setEditingTrade(null); setShowForm(false); setForm({ ...EMPTY_FORM }); await reloadTrades(); }
    setUploading(false); setTimeout(() => setMsg(''), 3000);
  };

  const startEdit = (trade) => {
    const confs = typeof trade.confirmations === 'string' ? trade.confirmations.split(',').filter(Boolean) : (trade.confirmations || []);
    setForm({
      ...trade, confirmations: confs, chart_file: null,
      exit_time: trade.exit_time || '',
      exit_date: trade.exit_date || '',
      al_tier: trade.al_tier || 'Primary', sl_tier: trade.sl_tier || 'Primary',
      contracts: trade.contracts ? String(trade.contracts) : '1',
      custom_symbol: trade.custom_symbol || '',
      custom_multiplier: trade.custom_multiplier ? String(trade.custom_multiplier) : '',
      strategy_id: trade.strategy_id || null,
    });
    setEditingTrade(trade); setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelForm = () => { setShowForm(false); setEditingTrade(null); setForm({ ...EMPTY_FORM }); };
  const openNewForm = () => { cancelForm(); setForm({ ...EMPTY_FORM, trade_number: nextTradeNumber() }); setShowForm(true); };
  const deleteTrade = async (id) => {
    if (!window.confirm('Delete this trade?')) return;
    await supabase.from('trades').delete().eq('id', id);
    await reloadTrades();
  };

  const tierGroups = [
    { key: 'al-primary',   label: 'AL: Primary',   color: TIER_COLORS['Primary']   },
    { key: 'al-secondary', label: 'AL: Secondary',  color: TIER_COLORS['Secondary'] },
    { key: 'al-tertiary',  label: 'AL: Tertiary',   color: TIER_COLORS['Tertiary']  },
    { key: 'sl-primary',   label: 'SL: Primary',    color: TIER_COLORS['Primary']   },
    { key: 'sl-secondary', label: 'SL: Secondary',  color: TIER_COLORS['Secondary'] },
    { key: 'sl-tertiary',  label: 'SL: Tertiary',   color: TIER_COLORS['Tertiary']  },
  ];

  return (
    <div style={{ padding: '16px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 500, color: '#ccc', marginBottom: 2 }}>Trade View</div>
          <div style={{ fontSize: 12, color: '#aaa' }}>All trades ({allTrades.length} total)</div>
        </div>
        <button onClick={() => showForm && !editingTrade ? cancelForm() : openNewForm()} style={{
          padding: '7px 16px', borderRadius: 8, border: 'none',
          background: showForm && !editingTrade ? '#2a2a2a' : '#185FA5',
          color: showForm && !editingTrade ? '#888' : '#fff',
          fontSize: 13, fontWeight: 500, cursor: 'pointer',
        }}>
          {showForm && !editingTrade ? 'Cancel' : '+ New Trade'}
        </button>
      </div>

      {noStratCount > 0 && (
        <div style={{ background: '#BA751715', border: '1px solid #BA751744', borderRadius: 8, padding: '10px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>⚠️</span>
            <span style={{ fontSize: 13, color: '#BA7517' }}>{noStratCount} trade{noStratCount !== 1 ? 's' : ''} not tagged to a strategy</span>
          </div>
          <button onClick={() => { setActiveFilter('no-strategy'); setTablePage(1); }} style={{ fontSize: 12, padding: '4px 12px', borderRadius: 6, border: '1px solid #BA751744', background: 'transparent', color: '#BA7517', cursor: 'pointer' }}>
            View & tag them →
          </button>
        </div>
      )}

      {/* TOS Uploader — always visible at top */}
      <div style={{ background: '#111', border: '1px solid #222', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#ccc', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          📊 TOS Account Statement — Import to unlock real P&L charts on trade review
        </div>
        <TOSUploader trades={allTrades} />
      </div>

      <ManageLevels />

      {/* ── Trade Form — no longer needs strategies prop ── */}
      {showForm && (
        <TradeForm
          form={form}
          setForm={setForm}
          onSubmit={editingTrade ? updateTrade : submitTrade}
          onCancel={cancelForm}
          uploading={uploading}
          isEdit={!!editingTrade}
        />
      )}

      <div className="table-card">
        <div className="table-header">
          <h2>Trade History ({sorted.length}{activeFilter !== 'all' ? ' filtered' : ''})</h2>
        </div>

        <div className="filter-row">
          {[['all','All'],['win','Win'],['loss','Loss'],['week','This Week'],['aplus','A+'],['a','A'],['aminus','A-'],...symbols.map(s=>[s,s])].map(([f,label]) => (
            <button key={f} className={`filter-btn ${activeFilter===f?'active':''}`} onClick={() => { setActiveFilter(f); setTablePage(1); }}>{label}</button>
          ))}
          {noStratCount > 0 && (
            <button className={`filter-btn ${activeFilter==='no-strategy'?'active':''}`} style={activeFilter!=='no-strategy'?{borderColor:'#BA751744',color:'#BA7517'}:{}} onClick={() => { setActiveFilter(activeFilter==='no-strategy'?'all':'no-strategy'); setTablePage(1); }}>
              ⚠️ No Strategy ({noStratCount})
            </button>
          )}
        </div>

        <div className="filter-row" style={{ marginTop: 0, borderTop: 'none' }}>
          <span style={{ fontSize: 11, color: '#999', alignSelf: 'center', marginRight: 4 }}>Strategy:</span>
          {STRATEGIES.map(s => (
            <button key={s.id}
              className={`filter-btn ${activeFilter===s.id?'active':''}`}
              style={activeFilter===s.id?{borderColor:s.color,color:s.color,background:s.color+'22'}:{borderColor:'#2a2a2a'}}
              onClick={() => { setActiveFilter(activeFilter===s.id?'all':s.id); setTablePage(1); }}
            >
              {s.icon} {s.name}
            </button>
          ))}
        </div>

        <div className="filter-row" style={{ marginTop: 0, borderTop: 'none' }}>
          <span style={{ fontSize: 11, color: '#999', alignSelf: 'center', marginRight: 4 }}>Tier:</span>
          {tierGroups.map(({ key, label, color }) => (
            <button key={key}
              className={`filter-btn ${activeFilter===key?'active':''}`}
              style={activeFilter===key?{borderColor:color,color,background:color+'22'}:{borderColor:'#2a2a2a'}}
              onClick={() => { setActiveFilter(activeFilter===key?'all':key); setTablePage(1); }}
            >
              {label}
            </button>
          ))}
        </div>

        {sorted.length === 0 ? (
          <div className="empty">No trades found.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {[['trade_number','#'],['date','Date'],['time','Time'],['account','Acct'],['symbol','Symbol'],['direction','Dir'],['grade','Grade'],['al_strength','AL'],['al_tier','AL Tier'],['sl_quality','SL'],['sl_tier','SL Tier'],['entry','Entry'],['exit_price','Exit'],['pnl','P&L'],['exit_reason','Result'],['session','Session']].map(([col,label]) => (
                    <th key={col} onClick={() => handleSort(col)} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                      {label} {sortCol===col?(sortDir==='asc'?'↑':'↓'):''}
                    </th>
                  ))}
                  <th>Strategy</th><th>Chart</th><th>Review</th><th>Edit</th><th>Del</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map(t => {
                  const pnlColor = t.pnl > 0 ? '#1D9E75' : t.pnl < 0 ? '#E24B4A' : '#888';
                  const sym = t.symbol === 'OTHER' ? (t.custom_symbol || 'OTHER') : t.symbol;
                  const strat = STRATEGIES.find(s => s.id === t.strategy_id);
                  return (
                    <React.Fragment key={t.id}>
                    <tr>
                      <td>{t.trade_number || '—'}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{t.date}</td>
                      <td>{t.time || '—'}</td>
                      <td>{t.account}</td>
                      <td>{sym}</td>
                      <td><span style={{ color: t.direction==='long'?'#1D9E75':'#E24B4A', fontWeight: 600, fontSize: 11 }}>{t.direction?.toUpperCase()}</span></td>
                      <td><span style={{ background: GRADE_COLORS[t.grade]+'33', color: GRADE_COLORS[t.grade], padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600 }}>{GRADES[t.grade]||t.grade}</span></td>
                      <td><span style={{ fontSize: 11, color: t.al_strength==='strong'?'#1D9E75':'#888' }}>{t.al_strength==='strong'?'★':'–'} {t.al_touches||'?'}t {t.al_age||''}</span></td>
                      <td><span style={{ fontSize: 11, color: TIER_COLORS[t.al_tier]||'#888', background: (TIER_COLORS[t.al_tier]||'#888')+'22', padding: '2px 7px', borderRadius: 4 }}>{t.al_tier||'—'}</span></td>
                      <td><span style={{ fontSize: 11, color: t.sl_quality==='strong'?'#1D9E75':'#E24B4A' }}>{t.sl_quality==='strong'?'★':'✗'} {t.sl_touches||'?'}t {t.sl_age||''}</span></td>
                      <td><span style={{ fontSize: 11, color: TIER_COLORS[t.sl_tier]||'#888', background: (TIER_COLORS[t.sl_tier]||'#888')+'22', padding: '2px 7px', borderRadius: 4 }}>{t.sl_tier||'—'}</span></td>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{t.entry}</td>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{t.exit_price||'—'}</td>
                      <td style={{ color: pnlColor, fontWeight: 600, fontFamily: 'var(--mono)', fontSize: 13 }}>{t.pnl!==null?(t.pnl>=0?'+$':'-$')+Math.abs(t.pnl):'—'}</td>
                      <td><span style={{ fontSize: 12, color: '#ccc' }}>{t.exit_reason||'—'}</span></td>
                      <td><span style={{ fontSize: 11, color: '#aaa' }}>{t.session||'—'}</span></td>
                      <td>
                        {strat ? (
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: strat.color+'22', color: strat.color, whiteSpace: 'nowrap' }}>
                            {strat.icon} {strat.name.slice(0,14)}
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#BA751722', color: '#BA7517' }}>⚠️ None</span>
                        )}
                      </td>
                      <td>{t.chart_url?<button className="btn-link" onClick={() => setChartModal(t.chart_url)}>View</button>:'—'}</td>
                      <td>
                        <button className="btn-link"
                          style={{ color: reviewingTrade?.id === t.id ? '#7c3aed' : '#60a5fa' }}
                          onClick={() => setReviewingTrade(reviewingTrade?.id === t.id ? null : t)}>
                          {reviewingTrade?.id === t.id ? 'Close' : 'Review'}
                        </button>
                      </td>
                      <td><button className="btn-link" onClick={() => startEdit(t)}>Edit</button></td>
                      <td><button className="btn-link" style={{ color: '#E24B4A' }} onClick={() => deleteTrade(t.id)}>Del</button></td>
                    </tr>
                    {reviewingTrade?.id === t.id && (
                      <tr>
                        <td colSpan={21} style={{ padding: '16px 12px', background: '#080a0e' }}>
                          <TradeReviewChart trade={t} />
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', padding: '12px 0', alignItems: 'center' }}>
            <button className="filter-btn" onClick={() => setTablePage(p => Math.max(1,p-1))} disabled={tablePage===1}>← Prev</button>
            <span style={{ fontSize: 13, color: '#ccc' }}>Page {tablePage} of {totalPages}</span>
            <button className="filter-btn" onClick={() => setTablePage(p => Math.min(totalPages,p+1))} disabled={tablePage===totalPages}>Next →</button>
          </div>
        )}
      </div>

      {chartModal && (
        <div className="modal-overlay" onClick={() => setChartModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Trade Chart</span>
              <button className="modal-close" onClick={() => setChartModal(null)}>×</button>
            </div>
            <img src={chartModal} alt="Trade chart" className="modal-img" />
          </div>
        </div>
      )}
    </div>
  );
}
