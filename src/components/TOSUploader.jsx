import { useState, useCallback } from 'react';
import { supabase } from '../supabase';
import { parseTOSStatement, matchTOSToJournal } from './TOSParser';

function UploadIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M10 13V4M10 4L7 7M10 4l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3 14v1a2 2 0 002 2h10a2 2 0 002-2v-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

export default function TOSUploader({ trades, onComplete }) {
  const [dragging,  setDragging]  = useState(false);
  const [status,    setStatus]    = useState('idle');
  const [result,    setResult]    = useState(null);
  const [errorMsg,  setErrorMsg]  = useState('');

  const processFile = useCallback(async (file) => {
    if (!file || !file.name.endsWith('.csv')) {
      setErrorMsg('Please upload a .csv file exported from TOS Account Statement');
      setStatus('error');
      return;
    }
    setStatus('parsing');
    setErrorMsg('');
    try {
      const text   = await file.text();
      const parsed = parseTOSStatement(text);

      if (!parsed.roundTrips.length) {
        setErrorMsg('No trades found. Make sure it is a TOS Account Statement CSV.');
        setStatus('error');
        return;
      }

      const matched    = matchTOSToJournal(parsed, trades || []);
      const matchCount = matched.filter(m => m.matched).length;

      setStatus('saving');

      // Save matched data — try Supabase, fallback to localStorage
      const upserts = matched
        .filter(m => m.matched && m.journal?.id)
        .map(m => ({
          trade_id:    m.journal.id,
          account:     parsed.account,
          tos_entry:   m.tos.entry,
          tos_exit:    m.tos.exit,
          tos_stop:    m.tos.tos_stop,
          tos_pnl:     m.tos.pnl,
          mfe:         m.tos.mfe,
          mae:         m.tos.mae,
          pnl_points:  JSON.stringify(m.tos.pnl_points),
          checkpoints: JSON.stringify(m.tos.checkpoints),
          updated_at:  new Date().toISOString(),
        }));

      if (upserts.length > 0) {
        const { error } = await supabase
          .from('tos_trade_data')
          .upsert(upserts, { onConflict: 'trade_id' });

        // Always also save to localStorage as backup
        const existing = JSON.parse(localStorage.getItem('tos_trade_data') || '{}');
        upserts.forEach(u => { existing[u.trade_id] = u; });
        localStorage.setItem('tos_trade_data', JSON.stringify(existing));
      }

      setResult({
        account:    parsed.account,
        total:      parsed.summary.total,
        wins:       parsed.summary.wins,
        losses:     parsed.summary.losses,
        net:        parsed.summary.net,
        matchCount,
        unmatch:    matched.filter(m => !m.matched).length,
        plRows:     parsed.plRows,
      });
      setStatus('done');
      if (onComplete) onComplete(parsed, matched);
    } catch (err) {
      console.error('TOS parse error:', err);
      setErrorMsg('Failed to parse: ' + err.message);
      setStatus('error');
    }
  }, [trades, onComplete]);

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const fmt = (v) => v >= 0 ? `+$${Math.abs(Math.round(v)).toLocaleString()}` : `-$${Math.abs(Math.round(v)).toLocaleString()}`;

  return (
    <div style={{ marginBottom: 16 }}>
      <style>{`@keyframes tos-spin { to { transform: rotate(360deg); } }`}</style>

      {(status === 'idle' || status === 'error') && (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => document.getElementById('tos-file-input').click()}
          style={{
            border: `1.5px dashed ${dragging ? '#7c3aed' : status === 'error' ? '#ef4444' : '#2a3545'}`,
            borderRadius: 8, padding: '20px 16px', textAlign: 'center',
            cursor: 'pointer', background: dragging ? '#13111e' : '#0a0c11',
            transition: 'all 0.15s',
          }}
        >
          <input id="tos-file-input" type="file" accept=".csv"
            style={{ display: 'none' }}
            onChange={e => { const f = e.target.files[0]; if (f) processFile(f); e.target.value = ''; }}
          />
          <div style={{ color: dragging ? '#a78bfa' : '#4a5568', marginBottom: 6, display: 'flex', justifyContent: 'center' }}>
            <UploadIcon />
          </div>
          <div style={{ fontSize: 13, color: '#94a3b8', fontWeight: 500 }}>
            Drop TOS Account Statement CSV here, or click to browse
          </div>
          <div style={{ fontSize: 11, color: '#4a5568', marginTop: 4 }}>
            TOS: Monitor → Account Statement → Export to File
          </div>
          {status === 'error' && (
            <div style={{ fontSize: 12, color: '#ef4444', marginTop: 8 }}>{errorMsg}</div>
          )}
        </div>
      )}

      {(status === 'parsing' || status === 'saving') && (
        <div style={{ background: '#0a0c11', border: '1px solid #1e2d3d', borderRadius: 8, padding: 24, textAlign: 'center' }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            border: '2px solid #1e2d3d', borderTop: '2px solid #7c3aed',
            animation: 'tos-spin 0.8s linear infinite', margin: '0 auto 12px',
          }} />
          <div style={{ fontSize: 13, color: '#94a3b8' }}>
            {status === 'parsing' ? 'Parsing TOS statement...' : 'Matching to journal trades...'}
          </div>
        </div>
      )}

      {status === 'done' && result && (
        <div style={{ background: '#0a0c11', border: '1px solid #22c55e22', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{
            padding: '10px 16px', background: '#0d1a0d',
            borderBottom: '1px solid #1a2a1a',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14 }}>✅</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#22c55e' }}>
                Imported — {result.account}
              </span>
            </div>
            <button onClick={() => { setStatus('idle'); setResult(null); }}
              style={{ background: 'transparent', border: '1px solid #1e2d3d', borderRadius: 5,
                padding: '3px 10px', color: '#5a6a7a', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}>
              Upload another
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', borderBottom: '1px solid #1a2030' }}>
            {[
              { label: 'Trades',  value: result.total },
              { label: 'Wins',    value: result.wins,    color: '#22c55e' },
              { label: 'Losses',  value: result.losses,  color: '#ef4444' },
              { label: 'Net P&L', value: fmt(result.net), color: result.net >= 0 ? '#22c55e' : '#ef4444' },
              { label: 'Matched', value: `${result.matchCount}/${result.total}`,
                color: result.matchCount === result.total ? '#22c55e' : '#f59e0b' },
            ].map((s, i) => (
              <div key={i} style={{ padding: '10px 0', textAlign: 'center', borderRight: i < 4 ? '1px solid #1a2030' : 'none' }}>
                <div style={{ fontSize: 10, color: '#4a5568', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: s.color || '#94a3b8', fontFamily: 'monospace' }}>{s.value}</div>
              </div>
            ))}
          </div>

          {result.plRows.length > 0 && (
            <div style={{ padding: '10px 16px' }}>
              <div style={{ fontSize: 10, color: '#4a5568', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>YTD P&L by Symbol</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {result.plRows.filter(r => r.pl_ytd !== null).map((r, i) => (
                  <div key={i} style={{
                    padding: '4px 12px', borderRadius: 6,
                    background: r.pl_ytd >= 0 ? '#0d2217' : '#1a0c0c',
                    border: `1px solid ${r.pl_ytd >= 0 ? '#22c55e33' : '#ef444433'}`,
                  }}>
                    <span style={{ fontSize: 11, color: '#6b7280' }}>{r.symbol} </span>
                    <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'monospace', color: r.pl_ytd >= 0 ? '#22c55e' : '#ef4444' }}>
                      {fmt(r.pl_ytd)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.unmatch > 0 && (
            <div style={{ padding: '8px 16px', fontSize: 11, color: '#f59e0b', borderTop: '1px solid #1a2030' }}>
              ⚠️ {result.unmatch} TOS trade{result.unmatch > 1 ? 's' : ''} could not be matched to journal entries
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Hook: load TOS data for a trade id ───────────────────────────────────────
export function useTOSTradeData(tradeId) {
  const [data, setData] = useState(null);

  useState(() => {
    if (!tradeId) return;
    supabase.from('tos_trade_data').select('*').eq('trade_id', tradeId).single()
      .then(({ data: d }) => {
        if (d) {
          setData({ ...d, pnl_points: JSON.parse(d.pnl_points||'[]'), checkpoints: JSON.parse(d.checkpoints||'[]') });
        } else {
          const local = JSON.parse(localStorage.getItem('tos_trade_data') || '{}');
          const ld = local[tradeId];
          if (ld) setData({ ...ld, pnl_points: JSON.parse(ld.pnl_points||'[]'), checkpoints: JSON.parse(ld.checkpoints||'[]') });
        }
      });
  }, [tradeId]);

  return data;
}
