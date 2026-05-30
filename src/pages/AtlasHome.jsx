import React, { useState, useRef, useEffect } from 'react';

const GOLD = '#C9973A';
const GOLD_DIM = '#C9973A22';
const GOLD_BORDER = '#C9973A44';

const SYSTEM_PROMPT = `You are Atlas AI, a trading coach and analyst for a futures trader using the Trendline Break Strategy on 60-min charts trading MGC (micro gold) and MNQ (micro NQ).

STRATEGY RULES:
- Action Line (AL): The 60-min trendline that breaks to trigger entry. Strong = 1 week+ data AND 3+ touches. Standard = under 1 week or under 3 touches.
- Safety Line (SL): The opposing trendline where stop is placed. Strong = 3+ touches AND 1 week+ data. Weak = 2 touches OR under 1 week.
- Setup Grades: A+ (Strong AL + Strong SL) ~80% win rate. A ~55%. A- ~40%.
- Best sessions EST: 07:00-09:00 Pre-open, 09:00-11:00 Open, 19:00-23:00 Overnight.
- Avoid: 15:00-19:00 late session, 23:00-07:00 dead zone, apex compression.
- MGC multiplier: $10/point. MNQ multiplier: $2/point.

You have access to the trader's complete trade history below. Be concise, direct, and data-driven. Reference specific trade numbers when relevant.`;

function formatTrades(trades) {
  if (!trades?.length) return 'No trades logged yet.';
  return `TRADE DATA (${trades.length} trades):\n` + trades.map(t =>
    `T${t.trade_number}|${t.date}|${t.account}|${t.symbol}|${t.direction}|Grade:${t.grade}|AL:${t.al_strength}(${t.al_touches}t)|SL:${t.sl_quality}(${t.sl_touches}t)|P&L:${t.pnl}|Exit:${t.exit_reason}`
  ).join('\n');
}

const QUICK_PROMPTS = [
  'Show my best setups',
  "Review yesterday's trades",
  'What mistakes am I repeating?',
  'Build my game plan',
  'What is my A+ win rate?',
  'Compare my two accounts',
];

const FOCUS_ITEMS = [
  {
    icon: '↗',
    title: 'Review your weekly performance',
    desc: 'Spot what's working and where the slippage is — your weekly snapshot is ready.',
    prompt: 'Give me a full weekly performance review. Include: total trades, win rate, net P&L, best and worst trade, which session performed best, and the single biggest mistake I made this week. Be specific with numbers.',
  },
  {
    icon: '⚡',
    title: 'Plan your trading day',
    desc: 'Map the day — 3 focus areas pulled from your recent trades.',
    prompt: 'Based on my recent trade history, give me a trading day plan. Include: (1) the 3 most important things to focus on today based on my patterns, (2) sessions I should target, (3) one rule I must not break today. Be specific.',
  },
  {
    icon: '📖',
    title: 'Update my playbook',
    desc: 'Pair recent results with your rules and surface where to tighten up.',
    prompt: 'Review my recent trades against my AL/SL strategy rules. Tell me: (1) which rules I followed well, (2) which rules I broke and the cost, (3) one specific rule change or addition I should make to my playbook right now.',
  },
  {
    icon: '🔍',
    title: 'Find my best setup',
    desc: 'Surface the highest-probability setup from your trade history.',
    prompt: 'Analyze my trade history and find my single highest-probability setup. Show me: the AL/SL combination, session, symbol, direction, win rate, avg P&L, and number of trades. Then tell me what conditions to wait for before taking it again.',
  },
];

export default function AtlasHome({ trades }) {
  const [input, setInput]       = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  const totalTrades = trades?.length || 0;
  const wins    = trades?.filter(t => t.pnl > 0).length || 0;
  const netPnl  = trades?.reduce((s, t) => s + (t.pnl || 0), 0) || 0;
  const winRate = totalTrades ? Math.round(wins / totalTrades * 100) : 0;
  const today   = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async (text) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput('');
    setChatOpen(true);
    const userMsg = { role: 'user', content: msg };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const history = messages.slice(-10);
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.REACT_APP_ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: SYSTEM_PROMPT + '\n\n' + formatTrades(trades),
          messages: [...history, userMsg],
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || `API error ${response.status}`);
      const reply = data.content?.find(b => b.type === 'text')?.text || 'No response.';
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: '❌ ' + err.message }]);
    }
    setLoading(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', background: '#0a0a0a', overflow: 'hidden' }}>

      {/* ── Header — always visible ── */}
      <div style={{ textAlign: 'center', padding: chatOpen ? '20px 24px 12px' : '48px 24px 20px', transition: 'padding 0.3s', flexShrink: 0 }}>
        <div style={{
          width: chatOpen ? 48 : 72, height: chatOpen ? 48 : 72, borderRadius: '50%', margin: '0 auto 12px',
          background: `radial-gradient(circle at 35% 35%, #e8c060, ${GOLD}, #7a5a1a)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: chatOpen ? 20 : 32, transition: 'all 0.3s',
          boxShadow: `0 0 24px ${GOLD}44`,
        }}>⚡</div>
        <div style={{ fontSize: chatOpen ? 18 : 26, fontWeight: 700, color: '#e8e8e8', letterSpacing: '-0.02em', transition: 'font-size 0.3s' }}>Atlas AI</div>
        {!chatOpen && <div style={{ fontSize: 13, color: '#555', marginTop: 4 }}>{today}</div>}
      </div>

      {/* ── Stats — only when no chat ── */}
      {!chatOpen && totalTrades > 0 && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 28, flexWrap: 'wrap', justifyContent: 'center', flexShrink: 0 }}>
          {[
            { label: 'Total Trades', value: totalTrades, color: '#ccc' },
            { label: 'Win Rate',     value: winRate + '%', color: winRate >= 55 ? '#1D9E75' : '#E24B4A' },
            { label: 'Net P&L',      value: (netPnl >= 0 ? '+' : '') + '$' + Math.round(netPnl).toLocaleString(), color: netPnl >= 0 ? '#1D9E75' : '#E24B4A' },
          ].map(s => (
            <div key={s.label} style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 10, padding: '10px 20px', textAlign: 'center', minWidth: 100 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 10, color: '#444', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Chat messages ── */}
      {chatOpen && (
        <div style={{ flex: 1, width: '100%', maxWidth: 680, overflowY: 'auto', padding: '0 20px 12px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              {m.role === 'assistant' && (
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: `radial-gradient(circle at 35% 35%, #e8c060, ${GOLD}, #7a5a1a)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0, marginRight: 8, marginTop: 2 }}>⚡</div>
              )}
              <div style={{
                maxWidth: '75%', padding: '10px 14px',
                borderRadius: m.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                background: m.role === 'user' ? '#185FA5' : '#131313',
                border: m.role === 'user' ? 'none' : '1px solid #222',
                fontSize: 13, color: '#ddd', lineHeight: 1.6, whiteSpace: 'pre-wrap',
              }}>
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', background: `radial-gradient(circle at 35% 35%, #e8c060, ${GOLD}, #7a5a1a)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>⚡</div>
              <div style={{ padding: '10px 14px', background: '#131313', border: '1px solid #222', borderRadius: '12px 12px 12px 4px', fontSize: 13, color: '#555' }}>Thinking…</div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {/* ── Quick prompts — only when no chat ── */}
      {!chatOpen && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 620, marginBottom: 20, flexShrink: 0, padding: '0 20px' }}>
          {QUICK_PROMPTS.map(q => (
            <button key={q} onClick={() => send(q)} style={{
              padding: '7px 14px', borderRadius: 20, fontSize: 13,
              background: 'transparent', border: '1px solid #222',
              color: '#666', cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = GOLD_BORDER; e.currentTarget.style.color = GOLD; e.currentTarget.style.background = GOLD_DIM; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#222'; e.currentTarget.style.color = '#666'; e.currentTarget.style.background = 'transparent'; }}
            >{q}</button>
          ))}
        </div>
      )}

      {/* ── Recommended Focus — only when no chat ── */}
      {!chatOpen && (
        <div style={{ width: '100%', maxWidth: 680, padding: '0 20px 16px', flexShrink: 0 }}>
          <div style={{ fontSize: 12, color: '#444', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Recommended focus</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {FOCUS_ITEMS.map((item, i) => (
              <button key={i} onClick={() => send(item.prompt)} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                background: 'transparent', border: '1px solid #1a1a1a',
                borderRadius: 10, padding: '12px 14px',
                cursor: 'pointer', textAlign: 'left', width: '100%',
                transition: 'all 0.15s',
              }}
                onMouseEnter={e => { e.currentTarget.style.background = '#111'; e.currentTarget.style.borderColor = '#C9973A33'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = '#1a1a1a'; }}
              >
                <div style={{ width: 36, height: 36, borderRadius: 8, background: '#111', border: '1px solid #222', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{item.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#ccc', marginBottom: 2 }}>{item.title}</div>
                  <div style={{ fontSize: 12, color: '#555', lineHeight: 1.4 }}>{item.desc}</div>
                </div>
                <div style={{ color: '#333', fontSize: 16, flexShrink: 0 }}>→</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Input bar — always at bottom ── */}
      <div style={{ width: '100%', maxWidth: 680, padding: '12px 20px 20px', flexShrink: 0, borderTop: chatOpen ? '1px solid #1a1a1a' : 'none' }}>
        <div style={{
          background: '#111', border: `1.5px solid ${GOLD_BORDER}`, borderRadius: 14,
          padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: `0 0 30px ${GOLD}14`,
        }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: `radial-gradient(circle at 35% 35%, #e8c060, ${GOLD}, #7a5a1a)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>⚡</div>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Ask Atlas anything about your trades…"
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#ccc', fontSize: 14, caretColor: GOLD }}
          />
          {chatOpen && (
            <button onClick={() => { setMessages([]); setChatOpen(false); }} style={{ background: 'none', border: '1px solid #222', borderRadius: 6, color: '#555', fontSize: 11, padding: '3px 8px', cursor: 'pointer', flexShrink: 0 }}>Clear</button>
          )}
          <button onClick={() => send()} disabled={!input.trim() || loading} style={{
            width: 30, height: 30, borderRadius: '50%', border: 'none', flexShrink: 0,
            background: input.trim() && !loading ? GOLD : '#1a1a1a',
            color: input.trim() && !loading ? '#000' : '#333',
            fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: input.trim() && !loading ? 'pointer' : 'not-allowed', transition: 'all 0.15s', fontWeight: 700,
          }}>→</button>
        </div>
      </div>
    </div>
  );
}
