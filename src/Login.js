import React, { useState } from 'react';

export default function Login({ onSuccess }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [shaking, setShaking] = useState(false);

  const handleSubmit = () => {
    if (password === process.env.REACT_APP_PASSWORD) {
      sessionStorage.setItem('tl_auth', '1');
      onSuccess();
    } else {
      setError('Incorrect password');
      setShaking(true);
      setPassword('');
      setTimeout(() => setShaking(false), 500);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter') handleSubmit();
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0f0f0f',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    }}>
      <div style={{
        background: '#1a1a1a',
        border: '1px solid #2a2a2a',
        borderRadius: 16,
        padding: '40px 48px',
        width: '100%',
        maxWidth: 380,
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        animation: shaking ? 'shake 0.4s ease' : 'none'
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📈</div>
          <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 700, margin: 0 }}>Trade Log</h1>
          <p style={{ color: '#666', fontSize: 13, marginTop: 6 }}>Trendline Break Strategy</p>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ color: '#888', fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={e => { setPassword(e.target.value); setError(''); }}
            onKeyDown={handleKey}
            autoFocus
            placeholder="Enter password"
            style={{
              width: '100%',
              background: '#111',
              border: error ? '1.5px solid #E24B4A' : '1.5px solid #2a2a2a',
              borderRadius: 8,
              padding: '12px 14px',
              color: '#fff',
              fontSize: 15,
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'border-color 0.2s'
            }}
          />
          {error && (
            <div style={{ color: '#E24B4A', fontSize: 12, marginTop: 6 }}>{error}</div>
          )}
        </div>

        <button
          onClick={handleSubmit}
          style={{
            width: '100%',
            background: '#1D9E75',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '13px',
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'background 0.2s'
          }}
          onMouseOver={e => e.target.style.background = '#178c65'}
          onMouseOut={e => e.target.style.background = '#1D9E75'}
        >
          Unlock
        </button>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
      `}</style>
    </div>
  );
}