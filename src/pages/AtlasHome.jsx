import React, { useState } from 'react';

const GOLD = '#C9973A';
const GOLD_DIM = '#C9973A22';
const GOLD_BORDER = '#C9973A44';

const QUICK_PROMPTS = [
  'Show my best setups',
  "Review yesterday's trades",
  'What mistakes am I repeating?',
  'Build my game plan',
  'What is my A+ win rate?',
  'Compare my two accounts',
];

export default function AtlasHome({ trades, onSendToChat }) {
  const [input, setInput] = useState('');

  const totalTrades = trades?.length || 0;
  const wins = trades?.filter(t => t.pnl > 0).length || 0;
  const netPnl = trades?.reduce((s, t) => s + (t.pnl || 0), 0) || 0;
  const winRate = totalTrades ? Math.round(wins / totalTrades * 100) : 0;

  const handleSend = (text) => {
    const msg = (text || input).trim();
    if (!msg) return;
    setInput('');
    onSendToChat(msg);
  };

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100%', padding: '40px 24px', background: '#0a0a0a', overflow: 'auto',
    }}>

      {/* Atlas logo + greeting */}
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%', margin: '0 auto 16px',
          background: `radial-gradient(circle at 35% 35%, #e8c060, ${GOLD}, #7a5a1a)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 32, boxShadow: `0 0 32px ${GOLD}55`,
        }}>
          ⚡
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, color: '#e8e8e8', marginBottom: 6, letterSpacing: '-0.02em' }}>
          Atlas AI
        </div>
        <div style={{ fontSize: 14, color: '#555' }}>{today}</div>
      </div>

      {/* Stats row */}
      {totalTrades > 0 && (
        <div style={{
          display: 'flex', gap: 12, marginBottom: 40, flexWrap: 'wrap', justifyContent: 'center',
        }}>
          {[
            { label: 'Total Trades', value: totalTrades },
            { label: 'Win Rate', value: winRate + '%', color: winRate >= 55 ? '#1D9E75' : '#E24B4A' },
            { label: 'Net P&L', value: (netPnl >= 0 ? '+' : '') + '$' + Math.round(netPnl).toLocaleString(), color: netPnl >= 0 ? '#1D9E75' : '#E24B4A' },
          ].map(s => (
            <div key={s.label} style={{
              background: '#111', border: '1px solid #1e1e1e', borderRadius: 10,
              padding: '10px 20px', textAlign: 'center', minWidth: 110,
            }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: s.color || '#ccc' }}>{s.value}</div>
              <div style={{ fontSize: 11, color: '#444', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Input box */}
      <div style={{
        width: '100%', maxWidth: 620, background: '#111',
        border: `1.5px solid ${GOLD_BORDER}`, borderRadius: 16,
        padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
        boxShadow: `0 0 40px ${GOLD}18`, marginBottom: 20,
        transition: 'border-color 0.2s',
      }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: `radial-gradient(circle at 35% 35%, #e8c060, ${GOLD}, #7a5a1a)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>⚡</div>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
          placeholder="Ask Atlas anything about your trades…"
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: '#ccc', fontSize: 15, caretColor: GOLD,
          }}
        />
        <button
          onClick={() => handleSend()}
          disabled={!input.trim()}
          style={{
            width: 34, height: 34, borderRadius: '50%', border: 'none', cursor: input.trim() ? 'pointer' : 'not-allowed',
            background: input.trim() ? GOLD : '#1a1a1a',
            color: input.trim() ? '#000' : '#333',
            fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, transition: 'all 0.15s', fontWeight: 700,
          }}>
          →
        </button>
      </div>

      {/* Quick prompts */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 620 }}>
        {QUICK_PROMPTS.map(q => (
          <button key={q} onClick={() => handleSend(q)} style={{
            padding: '7px 14px', borderRadius: 20, fontSize: 13,
            background: 'transparent', border: `1px solid #222`,
            color: '#666', cursor: 'pointer', transition: 'all 0.15s',
            whiteSpace: 'nowrap',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = GOLD_BORDER; e.currentTarget.style.color = GOLD; e.currentTarget.style.background = GOLD_DIM; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#222'; e.currentTarget.style.color = '#666'; e.currentTarget.style.background = 'transparent'; }}
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
