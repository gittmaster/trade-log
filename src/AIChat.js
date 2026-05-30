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

You have access to the trader's complete trade history. Analyze it and give specific, data-driven answers. Be concise and direct. Reference specific trade numbers when relevant.
IMPORTANT FORMATTING RULES:
- Always use markdown tables (with | pipes and --- separator row) when showing comparisons, monthly breakdowns, or multi-column data.
- Use **bold** for key metrics and section headers.
- Use bullet points (- item) for lists.
- Never apologize for not being able to show tables — always use pipe-format markdown tables.`;

function formatTradesForAI(trades) {
  if (!trades || trades.length === 0) return 'No trades logged yet.';
  const summary = trades.map(t =>
    `T${t.trade_number}|${t.date}|${t.time}|${t.account}|${t.symbol}|${t.direction}|Grade:${t.grade}|AL:${t.al_strength}(${t.al_touches}t,${t.al_age})|SL:${t.sl_quality}(${t.sl_touches}t,${t.sl_age})|Entry:${t.entry}|Exit:${t.exit_price}|P&L:${t.pnl}|Result:${t.exit_reason}|Session:${t.session}|Notes:${t.notes||''}`
  ).join('\n');
  return `TRADE DATA (${trades.length} trades):\n${summary}`;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function fileToText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

function isTextFile(file) {
  return file.type.startsWith('text/') || /\.(csv|txt|md|json|js|jsx|ts|tsx|css|html|xml|log)$/i.test(file.name);
}

// ─── Simple markdown renderer (tables, bold, code, line breaks) ───────────────
function renderMarkdown(text) {
  if (!text) return null;
  const lines = text.split('\n');
  const elements = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Detect table: line with | chars and next line is separator (---|---)
    if (line.includes('|') && i + 1 < lines.length && lines[i+1].match(/^[|\s\-:]+$/)) {
      const tableLines = [line];
      i += 2; // skip separator
      while (i < lines.length && lines[i].includes('|')) {
        tableLines.push(lines[i]);
        i++;
      }
      const headers = tableLines[0].split('|').map(h => h.trim()).filter(Boolean);
      const rows = tableLines.slice(1).map(r => r.split('|').map(c => c.trim()).filter(Boolean));
      elements.push(
        <div key={i} style={{ overflowX: 'auto', margin: '8px 0' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
            <thead>
              <tr>{headers.map((h, hi) => (
                <th key={hi} style={{ padding: '6px 10px', textAlign: 'left', borderBottom: '1px solid #333', color: '#ccc', fontWeight: 600, whiteSpace: 'nowrap', background: '#1a1a1a' }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} style={{ borderBottom: '1px solid #222' }}>
                  {row.map((cell, ci) => {
                    const isNeg = /^-\$/.test(cell);
                    const isPos = /^\+?\$[0-9]/.test(cell) && !isNeg;
                    return (
                      <td key={ci} style={{ padding: '6px 10px', color: isPos ? '#1D9E75' : isNeg ? '#E24B4A' : '#bbb', whiteSpace: 'nowrap' }}>{cell}</td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Bold headers (** or ###)
    if (line.startsWith('### ') || line.startsWith('## ') || line.startsWith('# ')) {
      const txt = line.replace(/^#{1,3}\s/, '');
      elements.push(<div key={i} style={{ fontWeight: 700, color: '#ccc', marginTop: 10, marginBottom: 4, fontSize: 13 }}>{txt}</div>);
      i++; continue;
    }

    // Bullet
    if (line.match(/^[\-\*]\s/)) {
      elements.push(<div key={i} style={{ paddingLeft: 12, color: '#bbb', fontSize: 13, lineHeight: 1.6 }}>• {inlineFmt(line.slice(2))}</div>);
      i++; continue;
    }

    // Empty line → spacer
    if (!line.trim()) {
      elements.push(<div key={i} style={{ height: 6 }} />);
      i++; continue;
    }

    // Normal line
    elements.push(<div key={i} style={{ color: '#bbb', fontSize: 13, lineHeight: 1.6 }}>{inlineFmt(line)}</div>);
    i++;
  }
  return <div>{elements}</div>;
}

function inlineFmt(text) {
  // bold: **text**
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((p, i) => i % 2 === 1 ? <strong key={i} style={{ color: '#ccc' }}>{p}</strong> : p);
}



// ─── Shared chat UI — used in both embedded and standalone modes ──────────────
function ChatUI({ trades, inputRef, onClose }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hi! I have access to all your trade data. Ask me anything — win rates, patterns, what to improve, or whether a setup is worth taking.' }
  ]);
  const [input, setInput] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (inputRef?.current) inputRef.current.focus();
  }, []);

  const buildAttachmentContent = async (file) => {
    if (!file) return { blocks: [], note: '' };

    const fileInfo = `Attached file: ${file.name} (${file.type || 'unknown type'}, ${Math.round(file.size / 1024)} KB)`;

    if (file.type.startsWith('image/')) {
      const dataUrl = await fileToDataUrl(file);
      const base64 = String(dataUrl).split(',')[1];
      return {
        blocks: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: file.type,
              data: base64,
            },
          },
        ],
        note: `${fileInfo}\nPlease analyze the attached image along with my question.`,
      };
    }

    if (isTextFile(file)) {
      const content = await fileToText(file);
      return {
        blocks: [],
        note: `${fileInfo}\n\nFile contents:\n${String(content).slice(0, 20000)}`,
      };
    }

    return {
      blocks: [],
      note: `${fileInfo}\nThis file type cannot be read directly in the browser chat. Use the filename and my question as context, and ask me for details if needed.`,
    };
  };

  const send = async () => {
    const text = input.trim();
    if ((!text && !attachment) || loading) return;
    setInput('');
    const currentAttachment = attachment;
    setAttachment(null);

    const { blocks, note } = await buildAttachmentContent(currentAttachment);
    const messageText = [text || 'Please review this attachment.', note].filter(Boolean).join('\n\n');
    const userContent = [{ type: 'text', text: messageText }, ...blocks];
    const userMsg = {
      role: 'user',
      content: userContent,
      displayContent: text || 'Please review this attachment.',
      attachmentName: currentAttachment?.name || null,
    };
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
            ...messages.filter(m => m.role !== 'system').slice(-10).map(({ role, content }) => ({ role, content })),
            { role: userMsg.role, content: userMsg.content }
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

  const chooseFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAttachment(file);
    e.target.value = '';
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="ai-messages" style={{ flex: 1, maxHeight: 'none' }}>
        {messages.map((m, i) => (
          <div key={i} className={`ai-msg ${m.role}`}>
            <div className="ai-msg-content" style={m.role === 'assistant' ? { whiteSpace: 'normal' } : {}}>
              {m.role === 'assistant'
                ? renderMarkdown(typeof m.content === 'string' ? m.content : m.content?.find?.(b => b.type === 'text')?.text || '')
                : (m.displayContent || (typeof m.content === 'string' ? m.content : m.content?.find?.(b => b.type === 'text')?.text || ''))
              }
              {m.attachmentName && (
                <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>Attachment: {m.attachmentName}</div>
              )}
            </div>
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
            <button key={i} className="ai-quick-btn" onClick={() => { setInput(q); setTimeout(() => inputRef?.current?.focus(), 50); }}>
              {q}
            </button>
          ))}
        </div>
      )}

      {attachment && (
        <div style={{ padding: '8px 12px', borderTop: '0.5px solid #2a2a2a', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#ccc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
            Attached: {attachment.name}
          </span>
          <button onClick={() => setAttachment(null)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 14 }}>Remove</button>
        </div>
      )}

      <div className="ai-input-row">
        <input ref={fileRef} type="file" onChange={chooseFile} style={{ display: 'none' }} />
        <button
          onClick={() => fileRef.current?.click()}
          title="Attach image or file"
          style={{ width: 36, height: 36, borderRadius: 8, background: '#111', border: '0.5px solid #333', color: '#ccc', cursor: 'pointer', flexShrink: 0 }}
        >
          +
        </button>
        <textarea
          ref={inputRef}
          className="ai-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask about your trades..."
          rows={2}
        />
        <button className="ai-send" onClick={send} disabled={loading || (!input.trim() && !attachment)}>
          {loading ? '...' : '↑'}
        </button>
      </div>
    </div>
  );
}

// ─── Main export — supports embedded={true} for use inside the floating panel ─
export default function AIChat({ trades, embedded = false }) {
  const [open, setOpen] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  // Embedded mode — just render the chat UI directly, no FAB or wrapper panel
  if (embedded) {
    return <ChatUI trades={trades} inputRef={inputRef} />;
  }

  // Standalone mode — original FAB + floating panel behavior
  const panelClass = maximized ? 'ai-panel ai-panel-max' : 'ai-panel';

  return (
    <>
      <button className="ai-fab" onClick={() => setOpen(o => !o)} title="Ask AI about your trades">
        {open ? '×' : '🤖'}
      </button>

      {open && (
        <div className={panelClass}>
          <div className="ai-header">
            <div>
              <div className="ai-title">Trading Coach AI</div>
              <div className="ai-subtitle">{trades.length} trades in context</div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button className="ai-maximize" onClick={() => setMaximized(m => !m)} title={maximized ? 'Minimize' : 'Maximize'}>
                {maximized ? '⊡' : '⊞'}
              </button>
              <button className="ai-close" onClick={() => { setOpen(false); setMaximized(false); }}>×</button>
            </div>
          </div>
          <ChatUI trades={trades} inputRef={inputRef} onClose={() => { setOpen(false); setMaximized(false); }} />
        </div>
      )}
    </>
  );
}
