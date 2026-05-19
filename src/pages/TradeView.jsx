import React, { useMemo, useState } from 'react';
import { getMultiplier, SYMBOL_MULT } from '../App';

const WIDGET_SYMBOLS = ['MGC', 'MNQ', 'MCL', 'MYM'];

const DEFAULT_LEVELS = {
  MGC: [
    { name: 'W($4900)', price: 4900 },
    { name: '4($4642.1)', price: 4642.1 },
    { name: 'W($4600)', price: 4600 },
    { name: 'M($4400)', price: 4400 },
  ],
  MNQ: [],
  MCL: [],
  MYM: [],
};

function money(value) {
  const rounded = Math.round(value);
  return `${rounded >= 0 ? '+$' : '-$'}${Math.abs(rounded).toLocaleString()}`;
}

function parseNumber(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

function WidgetButton({ active, danger, children, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '7px 18px',
      borderRadius: 7,
      border: `1px solid ${active ? (danger ? '#E24B4A' : '#185FA5') : '#2a2a2a'}`,
      background: active ? (danger ? '#50131333' : '#185FA522') : '#111',
      color: active ? (danger ? '#ff5b5b' : '#1f8ee8') : '#888',
      cursor: 'pointer',
      fontSize: 14,
      fontFamily: 'inherit',
    }}>
      {children}
    </button>
  );
}

function KeyLevels({ levels, setLevels, symbol, setSymbol }) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [levelSymbol, setLevelSymbol] = useState(symbol);

  const rows = levels[symbol] || [];

  const addLevel = () => {
    const parsed = parseNumber(price);
    if (!name.trim() || parsed === null) return;
    setLevels({
      ...levels,
      [levelSymbol]: [...(levels[levelSymbol] || []), { name: name.trim(), price: parsed }],
    });
    setName('');
    setPrice('');
  };

  const deleteLevel = (index) => {
    setLevels({
      ...levels,
      [symbol]: (levels[symbol] || []).filter((_, i) => i !== index),
    });
  };

  return (
    <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '18px 20px', borderBottom: '1px solid #2a2a2a' }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', marginBottom: 8 }}>Key Levels</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {WIDGET_SYMBOLS.map(s => (
            <WidgetButton key={s} active={symbol === s} onClick={() => setSymbol(s)}>{s}</WidgetButton>
          ))}
        </div>
      </div>

      <div style={{ padding: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 90px 72px', gap: 10, marginBottom: 16 }}>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Name" style={inputStyle} />
          <input value={price} onChange={e => setPrice(e.target.value)} placeholder="Price" style={inputStyle} />
          <select value={levelSymbol} onChange={e => setLevelSymbol(e.target.value)} style={inputStyle}>
            {WIDGET_SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={addLevel} style={{ ...primaryButtonStyle, height: 38 }}>+ Add</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map((level, index) => (
            <div key={`${level.name}-${level.price}-${index}`} style={{
              display: 'grid',
              gridTemplateColumns: '1fr 120px 70px 28px',
              alignItems: 'center',
              background: '#111',
              borderRadius: 7,
              padding: '9px 12px',
            }}>
              <span style={{ fontSize: 14, color: '#fff', fontWeight: 700 }}>{level.name}</span>
              <span style={{ fontSize: 14, color: '#00b786', fontWeight: 700, textAlign: 'right' }}>{level.price}</span>
              <button style={smallButtonStyle}>Edit</button>
              <button onClick={() => deleteLevel(index)} style={{ background: 'none', border: 'none', color: '#ff4c4c', cursor: 'pointer', fontSize: 18 }}>x</button>
            </div>
          ))}
          {!rows.length && <div style={{ padding: 18, color: '#555', fontSize: 13 }}>No key levels saved for {symbol}.</div>}
        </div>
      </div>
    </div>
  );
}

function PreTradeCheck({ levels, symbol, setSymbol }) {
  const [direction, setDirection] = useState('short');
  const [entry, setEntry] = useState('');
  const [stop, setStop] = useState('');
  const [target, setTarget] = useState('');

  const result = useMemo(() => {
    const e = parseNumber(entry);
    const s = parseNumber(stop);
    const t = parseNumber(target);
    if (e === null || s === null || t === null) return null;

    const riskPts = Math.abs(s - e);
    const rewardPts = Math.abs(t - e);
    const mult = getMultiplier(symbol, SYMBOL_MULT[symbol]);
    const maxGain = rewardPts * mult;
    const maxLoss = riskPts * mult;
    const rr = maxLoss ? rewardPts / riskPts : 0;

    const symbolLevels = levels[symbol] || [];
    let nearest = null;
    if (symbolLevels.length) {
      nearest = symbolLevels
        .map(level => ({ ...level, distance: Math.abs(level.price - t) }))
        .sort((a, b) => a.distance - b.distance)[0];
    }

    return { rr, maxGain, maxLoss, nearest, target: t };
  }, [entry, stop, target, symbol, levels]);

  return (
    <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '18px 20px', borderBottom: '1px solid #2a2a2a' }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: '#fff' }}>Pre-Trade Check</div>
      </div>

      <div style={{ padding: 0 }}>
        <div style={{ display: 'flex', gap: 8, padding: '18px 0 14px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 8, paddingLeft: 0, marginLeft: 0 }}>
            {WIDGET_SYMBOLS.map(s => (
              <WidgetButton key={s} active={symbol === s} onClick={() => setSymbol(s)}>{s}</WidgetButton>
            ))}
          </div>
          <div style={{ width: 10 }} />
          <WidgetButton active={direction === 'short'} danger onClick={() => setDirection('short')}>Short</WidgetButton>
          <WidgetButton active={direction === 'long'} onClick={() => setDirection('long')}>Long</WidgetButton>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
          {[
            ['ENTRY', entry, setEntry],
            ['STOP', stop, setStop],
            ['TARGET', target, setTarget],
          ].map(([label, value, setter]) => (
            <label key={label} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ color: '#666', fontSize: 12, fontWeight: 700 }}>{label}</span>
              <input value={value} onChange={e => setter(e.target.value)} style={inputStyle} />
            </label>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 76px', gap: 10, marginBottom: 18 }}>
          <button style={primaryButtonStyle}>Check Setup</button>
          <button onClick={() => { setEntry(''); setStop(''); setTarget(''); }} style={secondaryButtonStyle}>Clear</button>
        </div>

        {result && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
              <Metric label="R:R" value={`${result.rr.toFixed(2)}:1`} color={result.rr >= 2 ? '#1D9E75' : '#10b78f'} />
              <Metric label="Max Gain" value={money(result.maxGain)} color="#00b786" />
              <Metric label="Max Loss" value={money(-result.maxLoss)} color="#ff4040" />
            </div>

            <div style={{ background: '#111', borderRadius: 8, padding: '14px 16px', marginBottom: 12 }}>
              <div style={{ color: '#666', fontSize: 12, marginBottom: 8 }}>Nearest Level to Target</div>
              {result.nearest ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#fff', fontSize: 19, fontWeight: 700 }}>{result.nearest.name} @ {result.nearest.price}</span>
                  <span style={{ color: '#ff4040', fontSize: 13 }}>{Math.round(result.nearest.distance)} pts x</span>
                </div>
              ) : (
                <span style={{ color: '#555', fontSize: 13 }}>No key levels saved for {symbol}.</span>
              )}
            </div>

            {result.nearest && result.nearest.distance > 25 && (
              <div style={{ background: '#3b2020', border: '1px solid #7b3838', borderRadius: 8, padding: '14px 18px', color: '#ff4c4c', fontSize: 14 }}>
                Warning: Target @ {result.target} has no key level nearby (nearest: {result.nearest.name} @ {result.nearest.price})
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, color }) {
  return (
    <div style={{ background: '#111', borderRadius: 8, padding: '14px 16px', textAlign: 'center' }}>
      <div style={{ color: '#666', fontSize: 12, marginBottom: 6 }}>{label}</div>
      <div style={{ color, fontSize: 19, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function TradeTable({ trades }) {
  return (
    <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 12, overflow: 'hidden', marginTop: 18 }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #2a2a2a' }}>
        <h2 style={{ fontSize: 16, color: '#fff' }}>Trades</h2>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              {['#', 'Date', 'Acct', 'Symbol', 'Dir', 'Entry', 'Exit', 'P&L', 'Strategy'].map(h => <th key={h}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {trades.map(t => (
              <tr key={t.id || `${t.trade_number}-${t.date}-${t.time}`}>
                <td>{t.trade_number}</td>
                <td>{t.date}</td>
                <td>{t.account}</td>
                <td>{t.symbol === 'OTHER' ? t.custom_symbol : t.symbol}</td>
                <td>{t.direction}</td>
                <td>{t.entry}</td>
                <td>{t.exit_price}</td>
                <td style={{ color: t.pnl >= 0 ? '#1D9E75' : '#E24B4A' }}>{t.pnl === null || t.pnl === undefined ? '' : money(t.pnl)}</td>
                <td>{t.strategy_id || 'No Strategy'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%',
  background: '#111',
  border: '1px solid #2a2a2a',
  borderRadius: 7,
  color: '#ddd',
  padding: '9px 12px',
  fontSize: 14,
  fontFamily: 'inherit',
};

const primaryButtonStyle = {
  width: '100%',
  background: '#216bb0',
  border: 'none',
  borderRadius: 8,
  color: '#fff',
  padding: '10px 14px',
  fontSize: 16,
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const secondaryButtonStyle = {
  background: '#111',
  border: '1px solid #2a2a2a',
  borderRadius: 8,
  color: '#888',
  fontSize: 14,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const smallButtonStyle = {
  background: '#2a2a2a',
  border: 'none',
  borderRadius: 5,
  color: '#888',
  fontSize: 12,
  padding: '3px 10px',
  cursor: 'pointer',
};

export default function TradeView({ filteredTrades = [], dateLabel, acctLabel }) {
  const [levels, setLevels] = useState(() => {
    try {
      return { ...DEFAULT_LEVELS, ...JSON.parse(localStorage.getItem('tl_key_levels') || '{}') };
    } catch {
      return DEFAULT_LEVELS;
    }
  });
  const [widgetSymbol, setWidgetSymbol] = useState('MGC');

  const saveLevels = (nextLevels) => {
    setLevels(nextLevels);
    localStorage.setItem('tl_key_levels', JSON.stringify(nextLevels));
  };

  return (
    <div style={{ padding: '16px 20px' }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 500, color: '#ccc', marginBottom: 2 }}>Trade View</div>
        <div style={{ fontSize: 12, color: '#555' }}>{dateLabel} - {acctLabel}</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
        <KeyLevels levels={levels} setLevels={saveLevels} symbol={widgetSymbol} setSymbol={setWidgetSymbol} />
        <PreTradeCheck levels={levels} symbol={widgetSymbol} setSymbol={setWidgetSymbol} />
      </div>

      <TradeTable trades={filteredTrades} />
    </div>
  );
}
