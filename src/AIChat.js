import React, { useState, useRef, useEffect } from 'react';

const SYSTEM_PROMPT = `You are a trading coach and analyst for a futures trader using the Trendline Break Strategy on 60-min charts trading MGC (micro gold) and MNQ (micro NQ) on two Schwab accounts.

STRATEGY RULES:
- Action Line (AL): The 60-min trendline that breaks to trigger entry. ★ Strong = 1 week+ data AND 3+ touches. Standard = under 1 week or under 3 touches.
- Safety Line (SL): The opposing trendline where stop is placed. ★ Strong = 3+ touches AND 1 week+ data AND low risk distance. Weak = 2 touches OR under 1 week.
- Setup Grades: A+ (★Strong AL + ★Strong SL + yellow cleared) ~80% win rate. A (one strong element) ~55%. A- (both weak) ~40% net negative.
- Best sessions EST: 07:00-09:00 Pre-open, 09:00-11:00 Open, 19:00-23:00 Overnight carry.
- Avoid: 15:00-19:00 late session, 23:00-07:00 dead zone, apex compression (3+ lines converging).
- Yellow horizontals: key S/R levels for entry confluence and profit targets.
- MGC multiplier: $10/point. MNQ multiplier: $2/point.

You have access to the trader's complete trade history. Analyze it and give specific, data-driven answers. Be concise and direct. Reference specific trade numbers when relevant.`;

function formatTradesForAI(trades) {
  if (!trades || trades.length === 0) return 'No trades logged yet.';
  const summary = trades.map(t => 
    `T${t.trade_number}|${t.date}|${t.time}|${t.account}|${t.symbol}|${t.direction}|Grade:${t.grade}|AL:${t.al_strength}(${t.al_touches}t,${t.al_age})|SL:${t.sl_quality}(${t.sl_touches}t,${t.sl_age})|Entry:${t.entry}|Exit:${t.exit_price}|P&L:${t.pnl}|Result:${t.exit_reason}|Session:${t.session}|Notes:${t.notes||''}`
  ).join('\n');
  return `TRADE DATA (${trades.length} trades):\n${summary}`;
}

export default function AIChat({ trades }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hi! I have access to all your trade data. Ask me anything — win rates, patterns, what to improve, or whether a setup is worth taking.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    const userMsg = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    const tradeContext = formatTradesForAI(trades);
    const systemWithData = SYSTEM_PROMPT + '\n\n' + tradeContext;

    try {
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
          system: systemWithData,
          messages: [
            ...messages.filter(m => m.role !== 'system').slice(-10),
            userMsg
          ]
        })
      });

      const data = await response.json();
      if (data.content && data.content[0]) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.content[0].text }]);
      } else if (data.error) {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Error: ' + data.error.message }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Connection error. Check your API key in Vercel environment variables.' }]);
    }
    setLoading(false);
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const quickQuestions = [
    'How did I do this week?',
    'What is my A+ win rate?',
    'What mistakes am I making?',
    'Best session for me to trade?',
    'Compare my two accounts',
  ];

  return (
    <>
      <button className="ai-fab" onClick={() => setOpen(o => !o)} title="Ask AI about your trades">
        {open ? '×' : '🤖'}
      </button>

      {open && (
        <div className="ai-panel">
          <div className="ai-header">
            <div>
              <div className="ai-title">Trading Coach AI</div>
              <div className="ai-subtitle">{trades.length} trades in context</div>
            </div>
            <button className="ai-close" onClick={() => setOpen(false)}>×</button>
          </div>

          <div className="ai-messages">
            {messages.map((m, i) => (
              <div key={i} className={`ai-msg ${m.role}`}>
                <div className="ai-msg-content">{m.content}</div>
              </div>
            ))}
            {loading && (
              <div className="ai-msg assistant">
                <div className="ai-msg-content ai-thinking">Thinking...</div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {messages.length <= 1 && (
            <div className="ai-quick">
              {quickQuestions.map((q, i) => (
                <button key={i} className="ai-quick-btn" onClick={() => { setInput(q); setTimeout(() => inputRef.current?.focus(), 50); }}>
                  {q}
                </button>
              ))}
            </div>
          )}

          <div className="ai-input-row">
            <textarea
              ref={inputRef}
              className="ai-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask about your trades..."
              rows={2}
            />
            <button className="ai-send" onClick={send} disabled={loading || !input.trim()}>
              {loading ? '...' : '↑'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
