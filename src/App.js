import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import { seedTrades } from './seedData';
import AIChat from './AIChat';
import './App.css';

const GRADES = { aplus: 'A+', a: 'A', aminus: 'A-' };
const GRADE_COLORS = { aplus: '#1D9E75', a: '#185FA5', aminus: '#BA7517' };
const SESSIONS = ['Pre-open', 'Open', 'Mid-sess', 'Pre-mkt', 'Overnight', 'Late'];

function calcPnL(trade) {
  if (!trade.entry || !trade.exit_price) return null;
  const diff = trade.direction === 'long' ? trade.exit_price - trade.entry : trade.entry - trade.exit_price;
  const mult = trade.symbol === 'MGC' ? 10 : trade.symbol === 'MNQ' ? 2 : 100;
  return Math.round(diff * mult * 100) / 100;
}

function getSession(time) {
  if (!time) return 'Mid-sess';
  const h = parseInt(time.split(':')[0]);
  if (h >= 7 && h < 9) return 'Pre-open';
  if (h >= 9 && h < 11) return 'Open';
  if (h >= 11 && h < 15) return 'Mid-sess';
  if (h >= 15 && h < 19) return 'Late';
  if (h >= 19 && h < 23) return 'Pre-mkt';
  return 'Overnight';
}

const EMPTY_FORM = {
  trade_number: '', date: new Date().toISOString().split('T')[0], time: '',
  account: 'A1', symbol: 'MGC', direction: 'long', entry: '', exit_price: '',
  stop: '', target: '', exit_reason: '', al_strength: 'standard',
  al_touches: '', al_age: '<1wk', sl_quality: 'weak', sl_touches: '',
  sl_age: '<1wk', sl_price: '', grade: 'a', yellow_levels: '',
  confirmations: [], notes: '', chart_file: null
};

function StatCard({ label, value, color }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ color: color || 'inherit' }}>{value}</div>
    </div>
  );
}

function InsightCard({ title, data }) {
  return (
    <div className="insight-card">
      <div className="insight-title">{title}</div>
      {data.map((row, i) => (
        <div key={i} className="insight-row">
          <span className="insight-label">{row.label}</span>
          <span className="insight-value" style={{ color: row.wr >= 50 ? '#1D9E75' : '#E24B4A' }}>
            {row.wr}% · {row.net >= 0 ? '+' : ''}${row.net}
          </span>
        </div>
      ))}
      {data.length === 0 && <div className="insight-empty">No data</div>}
    </div>
  );
}

function ChartModal({ url, onClose }) {
  if (!url) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Trade Chart</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <img src={url} alt="Trade chart" className="modal-img" />
      </div>
    </div>
  );
}

function TradeForm({ form, setForm, onSubmit, onCancel, uploading, isEdit }) {
  const confOptions = ['AL crossed', 'Yellow S/R cleared', 'SL identified', 'Open space'];
  const confs = Array.isArray(form.confirmations)
    ? form.confirmations
    : (form.confirmations || '').split(',').filter(Boolean);

  const toggleConf = (c) => {
    const current = Array.isArray(form.confirmations)
      ? form.confirmations
      : (form.confirmations || '').split(',').filter(Boolean);
    setForm(f => ({
      ...f,
      confirmations: current.includes(c) ? current.filter(x => x !== c) : [...current, c]
    }));
  };

  return (
    <div className="form-card">
      <h2>{isEdit ? 'Edit Trade' : 'Log New Trade'}</h2>
      <div className="form-grid-3">
        <div className="field"><label>Trade #</label><input type="number" value={form.trade_number || ''} onChange={e => setForm(f => ({ ...f, trade_number: e.target.value }))} /></div>
        <div className="field"><label>Date</label><input type="date" value={form.date || ''} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
        <div className="field"><label>Time (EST)</label><input type="time" value={form.time || ''} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} /></div>
      </div>
      <div className="form-grid-3">
        <div className="field"><label>Account</label>
          <div className="toggle-row">
            {['A1', 'A2'].map(a => <button key={a} className={`tog ${form.account === a ? 'tog-blue' : ''}`} onClick={() => setForm(f => ({ ...f, account: a }))}>{a}</button>)}
          </div>
        </div>
        <div className="field"><label>Symbol</label>
          <div className="toggle-row">
            {['MGC', 'MNQ'].map(s => <button key={s} className={`tog ${form.symbol === s ? 'tog-blue' : ''}`} onClick={() => setForm(f => ({ ...f, symbol: s }))}>{s}</button>)}
          </div>
        </div>
        <div className="field"><label>Direction</label>
          <div className="toggle-row">
            <button className={`tog ${form.direction === 'long' ? 'tog-green' : ''}`} onClick={() => setForm(f => ({ ...f, direction: 'long' }))}>Long</button>
            <button className={`tog ${form.direction === 'short' ? 'tog-red' : ''}`} onClick={() => setForm(f => ({ ...f, direction: 'short' }))}>Short</button>
          </div>
        </div>
      </div>
      <div className="form-grid-4">
        <div className="field"><label>Entry</label><input type="number" step="0.01" value={form.entry || ''} onChange={e => setForm(f => ({ ...f, entry: e.target.value }))} /></div>
        <div className="field"><label>Exit</label><input type="number" step="0.01" value={form.exit_price || ''} onChange={e => setForm(f => ({ ...f, exit_price: e.target.value }))} /></div>
        <div className="field"><label>Stop</label><input type="number" step="0.01" value={form.stop || ''} onChange={e => setForm(f => ({ ...f, stop: e.target.value }))} /></div>
        <div className="field"><label>Target</label><input type="number" step="0.01" value={form.target || ''} onChange={e => setForm(f => ({ ...f, target: e.target.value }))} /></div>
      </div>
      <div className="form-grid-2">
        <div className="field"><label>Exit Reason</label>
          <div className="toggle-row">
            {['target', 'stop', 'manual', 'open'].map(r => <button key={r} className={`tog ${form.exit_reason === r ? 'tog-blue' : ''}`} onClick={() => setForm(f => ({ ...f, exit_reason: r }))}>{r}</button>)}
          </div>
        </div>
        <div className="field"><label>Grade</label>
          <div className="toggle-row">
            <button className={`tog ${form.grade === 'aplus' ? 'tog-green' : ''}`} onClick={() => setForm(f => ({ ...f, grade: 'aplus' }))}>A+</button>
            <button className={`tog ${form.grade === 'a' ? 'tog-blue' : ''}`} onClick={() => setForm(f => ({ ...f, grade: 'a' }))}>A</button>
            <button className={`tog ${form.grade === 'aminus' ? 'tog-amber' : ''}`} onClick={() => setForm(f => ({ ...f, grade: 'aminus' }))}>A-</button>
          </div>
        </div>
      </div>
      <div className="form-grid-3">
        <div className="field"><label>Action Line</label>
          <div className="toggle-row">
            <button className={`tog ${form.al_strength === 'strong' ? 'tog-green' : ''}`} onClick={() => setForm(f => ({ ...f, al_strength: 'strong' }))}>★ Strong</button>
            <button className={`tog ${form.al_strength === 'standard' ? 'tog-blue' : ''}`} onClick={() => setForm(f => ({ ...f, al_strength: 'standard' }))}>Standard</button>
          </div>
        </div>
        <div className="field"><label>AL Touches</label><input type="number" value={form.al_touches || ''} onChange={e => setForm(f => ({ ...f, al_touches: e.target.value }))} /></div>
        <div className="field"><label>AL Age</label>
          <div className="toggle-row">
            {['<1day', '<1wk', '1wk+'].map(a => <button key={a} className={`tog ${form.al_age === a ? 'tog-blue' : ''}`} onClick={() => setForm(f => ({ ...f, al_age: a }))}>{a}</button>)}
          </div>
        </div>
      </div>
      <div className="form-grid-3">
        <div className="field"><label>Safety Line</label>
          <div className="toggle-row">
            <button className={`tog ${form.sl_quality === 'strong' ? 'tog-green' : ''}`} onClick={() => setForm(f => ({ ...f, sl_quality: 'strong' }))}>★ Strong</button>
            <button className={`tog ${form.sl_quality === 'weak' ? 'tog-red' : ''}`} onClick={() => setForm(f => ({ ...f, sl_quality: 'weak' }))}>Weak</button>
          </div>
        </div>
        <div className="field"><label>SL Touches</label><input type="number" value={form.sl_touches || ''} onChange={e => setForm(f => ({ ...f, sl_touches: e.target.value }))} /></div>
        <div className="field"><label>SL Age</label>
          <div className="toggle-row">
            {['<1day', '<1wk', '1wk+'].map(a => <button key={a} className={`tog ${form.sl_age === a ? 'tog-blue' : ''}`} onClick={() => setForm(f => ({ ...f, sl_age: a }))}>{a}</button>)}
          </div>
        </div>
      </div>
      <div className="form-grid-2">
        <div className="field"><label>SL Price</label><input type="number" step="0.01" value={form.sl_price || ''} onChange={e => setForm(f => ({ ...f, sl_price: e.target.value }))} /></div>
        <div className="field"><label>Yellow Levels</label><input type="text" placeholder="e.g. 4650/4586/4420" value={form.yellow_levels || ''} onChange={e => setForm(f => ({ ...f, yellow_levels: e.target.value }))} /></div>
      </div>
      <div className="field">
        <label>Confirmations</label>
        <div className="toggle-row">
          {confOptions.map(c => <button key={c} className={`tog ${confs.includes(c) ? 'tog-green' : ''}`} onClick={() => toggleConf(c)}>{c}</button>)}
        </div>
      </div>
      <div className="field"><label>Notes</label><textarea value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
      <div className="field">
        <label>
          Chart Image&nbsp;
          {isEdit && form.chart_url && (
            <a href={form.chart_url} target="_blank" rel="noreferrer" className="chart-link">(view current chart)</a>
          )}
        </label>
        <input type="file" accept="image/*" onChange={e => setForm(f => ({ ...f, chart_file: e.target.files[0] }))} />
      </div>
      <div className="form-actions">
        <button className="btn-cancel" onClick={onCancel}>Cancel</button>
        <button className="btn-submit" onClick={onSubmit} disabled={uploading}>
          {uploading ? 'Saving...' : isEdit ? 'Save Changes' : 'Log Trade'}
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editingTrade, setEditingTrade] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState('');
  const [chartModal, setChartModal] = useState(null);
  const [sortCol, setSortCol] = useState('date');
  const [sortDir, setSortDir] = useState('desc');

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  const nextTradeNumber = () => {
    if (!trades.length) return 1;
    const nums = trades.map(t => t.trade_number).filter(Boolean);
    return nums.length ? Math.max(...nums) + 1 : trades.length + 1;
  };

  const loadTrades = useCallback(async () => {
    const { data, error } = await supabase.from('trades').select('*').order('date', { ascending: false }).order('time', { ascending: false });
    if (!error) setTrades(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadTrades(); }, [loadTrades]);

  const exportCSV = () => {
    if (!trades.length) { alert('No trades to export'); return; }
    const headers = ['trade_number','date','time','account','symbol','direction','entry','exit_price','stop','target','exit_reason','al_strength','al_touches','al_age','sl_quality','sl_touches','sl_age','sl_price','grade','session','yellow_levels','confirmations','notes','pnl'];
    const rows = trades.map(t => headers.map(h => {
      const v = t[h];
      if (v === null || v === undefined) return '';
      if (typeof v === 'string' && v.includes(',')) {
        const escaped = v.replace(/"/g, '""');
        return '"' + escaped + '"';
      }
      return v;
    }).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'trades_' + new Date().toISOString().split('T')[0] + '.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const seedDatabase = async () => {
    setSeeding(true);
    setMsg('Seeding 61 trades...');
    const { error } = await supabase.from('trades').insert(seedTrades);
    if (error) { setMsg('Error: ' + error.message); }
    else { setMsg('61 trades loaded!'); await loadTrades(); }
    setSeeding(false);
    setTimeout(() => setMsg(''), 3000);
  };

  const buildTradePayload = async (form, existingChartUrl = null) => {
    let chart_url = existingChartUrl;
    if (form.chart_file) {
      const file = form.chart_file;
      const path = `charts/trade-${form.trade_number}-${Date.now()}.${file.name.split('.').pop()}`;
      const { error: upErr } = await supabase.storage.from('trade-charts').upload(path, file);
      if (!upErr) {
        const { data: urlData } = supabase.storage.from('trade-charts').getPublicUrl(path);
        chart_url = urlData.publicUrl;
      }
    }
    const pnl = calcPnL({ ...form, exit_price: parseFloat(form.exit_price), entry: parseFloat(form.entry) });
    const session = getSession(form.time);
    const confs = Array.isArray(form.confirmations) ? form.confirmations.join(',') : (form.confirmations || '');
    const trade = {
      ...form,
      entry: form.entry ? parseFloat(form.entry) : null,
      exit_price: form.exit_price ? parseFloat(form.exit_price) : null,
      stop: form.stop ? parseFloat(form.stop) : null,
      target: form.target ? parseFloat(form.target) : null,
      sl_price: form.sl_price ? parseFloat(form.sl_price) : null,
      trade_number: form.trade_number ? parseInt(form.trade_number) : null,
      al_touches: form.al_touches ? parseInt(form.al_touches) : null,
      sl_touches: form.sl_touches ? parseInt(form.sl_touches) : null,
      confirmations: confs, session, chart_url, pnl
    };
    delete trade.chart_file;
    return trade;
  };

  const submitTrade = async () => {
    setUploading(true);
    const trade = await buildTradePayload(form);
    const { error } = await supabase.from('trades').insert([trade]);
    if (error) { setMsg('Error: ' + error.message); }
    else { setMsg('Trade logged!'); setShowForm(false); setForm({ ...EMPTY_FORM }); await loadTrades(); }
    setUploading(false);
    setTimeout(() => setMsg(''), 3000);
  };

  const updateTrade = async () => {
    setUploading(true);
    const trade = await buildTradePayload(form, form.chart_url);
    const { id, created_at, ...rest } = trade;
    const { error } = await supabase.from('trades').update(rest).eq('id', editingTrade.id);
    if (error) { setMsg('Error: ' + error.message); }
    else { setMsg('Trade updated!'); setEditingTrade(null); setShowForm(false); setForm({ ...EMPTY_FORM }); await loadTrades(); }
    setUploading(false);
    setTimeout(() => setMsg(''), 3000);
  };

  const startEdit = (trade) => {
    const confs = typeof trade.confirmations === 'string'
      ? trade.confirmations.split(',').filter(Boolean)
      : (trade.confirmations || []);
    setForm({ ...trade, confirmations: confs, chart_file: null });
    setEditingTrade(trade);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingTrade(null);
    setForm({ ...EMPTY_FORM });
  };

  const openNewTradeForm = () => {
    cancelForm();
    setForm({ ...EMPTY_FORM, trade_number: nextTradeNumber() });
    setShowForm(true);
  };

  const deleteTrade = async (id) => {
    if (!window.confirm('Delete this trade?')) return;
    await supabase.from('trades').delete().eq('id', id);
    await loadTrades();
  };

  const getWeekRange = () => { const now = new Date(); const day = now.getDay(); const diffToMon = day === 0 ? -6 : 1 - day; const monday = new Date(now); monday.setDate(now.getDate() + diffToMon); monday.setHours(0,0,0,0); const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6); sunday.setHours(23,59,59,999); return {monday, sunday}; };

  const filteredTrades = () => {
    if (activeFilter === 'all') return trades;
    if (activeFilter === 'win') return trades.filter(t => t.pnl > 0);
    if (activeFilter === 'loss') return trades.filter(t => t.pnl < 0);
    if (activeFilter === 'week') { const {monday, sunday} = getWeekRange(); return trades.filter(t => { if (!t.date) return false; const d = new Date(t.date + 'T12:00:00'); return d >= monday && d <= sunday; }); }
    if (activeFilter === 'A1' || activeFilter === 'A2') return trades.filter(t => t.account === activeFilter);
    if (['aplus', 'a', 'aminus'].includes(activeFilter)) return trades.filter(t => t.grade === activeFilter);
    if (['MGC', 'MNQ'].includes(activeFilter)) return trades.filter(t => t.symbol === activeFilter);
    return trades;
  };

  const closed = trades.filter(t => t.pnl !== null);
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

  const ft = (() => {
    const base = filteredTrades();
    return [...base].sort((a, b) => {
      let av = a[sortCol], bv = b[sortCol];
      if (av === null || av === undefined) av = '';
      if (bv === null || bv === undefined) bv = '';
      if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av;
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  })();

  const weekTrades = filteredTrades().filter(t => {
    if (activeFilter !== 'week') return false;
    return t.pnl !== null;
  });
  const weekNet = weekTrades.reduce((s, t) => s + (t.pnl || 0), 0);
  const weekWins = weekTrades.filter(t => t.pnl > 0).length;
  const weekLosses = weekTrades.filter(t => t.pnl < 0).length;

  return (
    <div className="app">
      <div className="header">
        <div>
          <h1>Trade Log</h1>
          <p className="subtitle">Trendline Break Strategy · MGC / MNQ · Both Accounts</p>
        </div>
        <div className="header-actions">
          {msg && <span className="msg">{msg}</span>}
          {trades.length === 0 && (
            <button className="btn-seed" onClick={seedDatabase} disabled={seeding}>
              {seeding ? 'Loading...' : 'Load 61 trades'}
            </button>
          )}
          <button className="btn-export" onClick={exportCSV}>↓ Export CSV</button>
          <button className="btn-primary" onClick={() => { if (showForm && !editingTrade) { cancelForm(); } else { openNewTradeForm(); } }}>
            {showForm && !editingTrade ? 'Cancel' : '+ New Trade'}
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <StatCard label="Total Trades" value={trades.length} />
        <StatCard label="Win Rate" value={wr !== null ? wr + '%' : '—'} color={wr >= 50 ? '#1D9E75' : wr !== null ? '#E24B4A' : undefined} />
        <StatCard label="Net P&L" value={closed.length ? (net >= 0 ? '+$' : '-$') + Math.abs(Math.round(net)) : '$0'} color={net > 0 ? '#1D9E75' : net < 0 ? '#E24B4A' : undefined} />
        <StatCard label="Avg Winner" value={avgW !== null ? '+$' + avgW : '—'} color="#1D9E75" />
        <StatCard label="Avg Loser" value={avgL !== null ? '-$' + Math.abs(avgL) : '—'} color="#E24B4A" />
      </div>

      <div className="insights-grid">
        <InsightCard title="By Instrument" data={insightData('symbol', [{ k: 'MGC', l: 'MGC Gold' }, { k: 'MNQ', l: 'MNQ NQ' }])} />
        <InsightCard title="By Grade" data={insightData('grade', [{ k: 'aplus', l: 'A+' }, { k: 'a', l: 'A' }, { k: 'aminus', l: 'A-' }])} />
        <InsightCard title="By Safety Line" data={insightData('sl_quality', [{ k: 'strong', l: '★ Strong' }, { k: 'weak', l: 'Weak' }])} />
        <InsightCard title="By Session" data={insightData('session', SESSIONS.map(s => ({ k: s, l: s })))} />
      </div>

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
          <h2>Trade History ({ft.length})</h2>
          {activeFilter === 'week' && weekTrades.length > 0 && (
            <div style={{ fontSize: 13, fontFamily: 'var(--mono)', display: 'flex', gap: 16, alignItems: 'center' }}>
              <span style={{ color: weekNet >= 0 ? '#1D9E75' : '#E24B4A', fontWeight: 600 }}>
                {weekNet >= 0 ? '+$' : '-$'}{Math.abs(Math.round(weekNet))} net
              </span>
              <span style={{ color: '#1D9E75' }}>{weekWins}W</span>
              <span style={{ color: '#E24B4A' }}>{weekLosses}L</span>
              <span style={{ color: '#888' }}>{weekTrades.length > 0 ? Math.round(weekWins/weekTrades.length*100) : 0}%</span>
            </div>
          )}
        </div>
        <div className="filter-row">
          {['all', 'A1', 'A2', 'MGC', 'MNQ', 'aplus', 'a', 'aminus', 'win', 'loss', 'week'].map(f => (
            <button key={f} className={`filter-btn ${activeFilter === f ? 'active' : ''}`} onClick={() => setActiveFilter(f)}>
              {f === 'aplus' ? 'A+' : f === 'aminus' ? 'A-' : f === 'week' ? 'This Week' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        {loading ? (
          <div className="empty">Loading...</div>
        ) : ft.length === 0 ? (
          <div className="empty">No trades. {trades.length === 0 && <button className="btn-link" onClick={seedDatabase}>Load 61 historical trades</button>}</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {[['trade_number','#'],['date','Date'],['time','Time'],['account','Acct'],['symbol','Symbol'],['direction','Dir'],['grade','Grade'],['al_strength','AL'],['sl_quality','SL'],['entry','Entry'],['exit_price','Exit'],['pnl','P&L'],['exit_reason','Result'],['session','Session']].map(([col, label]) => (
                    <th key={col} onClick={() => handleSort(col)} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                      {label} {sortCol === col ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                    </th>
                  ))}
                  <th>Chart</th><th>Edit</th><th>Del</th>
                </tr>
              </thead>
              <tbody>
                {ft.map(t => {
                  const pnl = t.pnl;
                  return (
                    <tr key={t.id}>
                      <td>{t.trade_number || '—'}</td>
                      <td>{t.date}</td>
                      <td style={{ fontSize: 11 }}>{t.time || '—'}</td>
                      <td><span className={`badge ${t.account === 'A1' ? 'badge-purple' : 'badge-amber'}`}>{t.account}</span></td>
                      <td style={{ fontWeight: 500 }}>{t.symbol}</td>
                      <td><span className={`badge ${t.direction === 'long' ? 'badge-green' : 'badge-red'}`}>{t.direction}</span></td>
                      <td><span className="grade-badge" style={{ background: GRADE_COLORS[t.grade] + '22', color: GRADE_COLORS[t.grade] }}>{GRADES[t.grade] || t.grade}</span></td>
                      <td><span className={`badge ${t.al_strength === 'strong' ? 'badge-green' : 'badge-blue'}`}>{t.al_strength === 'strong' ? '★1wk+' : 'Std'}</span></td>
                      <td><span className={`badge ${t.sl_quality === 'strong' ? 'badge-teal' : 'badge-amber'}`}>{t.sl_quality === 'strong' ? '★Str' : 'Weak'}</span></td>
                      <td>{t.entry || '—'}</td>
                      <td>{t.exit_price || '—'}</td>
                      <td style={{ color: pnl > 0 ? '#1D9E75' : pnl < 0 ? '#E24B4A' : undefined, fontWeight: 500 }}>
                        {pnl !== null ? (pnl >= 0 ? '+$' : '-$') + Math.abs(pnl) : '—'}
                      </td>
                      <td><span className={`badge ${pnl > 0 ? 'badge-green' : pnl < 0 ? 'badge-red' : 'badge-blue'}`}>{t.exit_reason}</span></td>
                      <td style={{ fontSize: 11, color: '#888' }}>{t.session || '—'}</td>
                      <td>
                        {t.chart_url
                          ? <button className="chart-view-btn" onClick={() => setChartModal(t.chart_url)} title="View chart">📷</button>
                          : <span style={{ color: '#333' }}>—</span>}
                      </td>
                      <td><button className="edit-btn" onClick={() => startEdit(t)} title="Edit trade">✎</button></td>
                      <td><button className="del-btn" onClick={() => deleteTrade(t.id)}>×</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ChartModal url={chartModal} onClose={() => setChartModal(null)} />
      <AIChat trades={trades} />
    </div>
  );
}
