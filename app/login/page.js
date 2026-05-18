'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [iniciales, setIniciales] = useState(['', '']);
  const [pin, setPin] = useState(['', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleInicialesChange = (index, value) => {
    if (!/^[A-Z]?$/.test(value.toUpperCase())) return;
    const newIniciales = [...iniciales];
    newIniciales[index] = value.toUpperCase();
    setIniciales(newIniciales);
    if (value && index < 1) {
      document.getElementById(`inicial-${index + 1}`)?.focus();
    }
  };

  const handlePinChange = (index, value) => {
    if (!/^\d?$/.test(value)) return;
    const newPin = [...pin];
    newPin[index] = value;
    setPin(newPin);
    if (value && index < 3) {
      document.getElementById(`pin-${index + 1}`)?.focus();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const inicialesCode = iniciales.join('');
    const pinCode = pin.join('');

    if (inicialesCode.length !== 2 || pinCode.length !== 4) {
      setError('Completá iniciales (2) y PIN (4)');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ iniciales: inicialesCode, pin: pinCode })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Error al ingresar');
        setLoading(false);
        return;
      }

      localStorage.setItem('user', JSON.stringify(data));
      router.push('/');
    } catch (err) {
      setError('Error de conexión');
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#F7F5F0',
      fontFamily: "'DM Sans', sans-serif",
      padding: '20px'
    }}>
      <div style={{
        background: '#fff',
        padding: '40px',
        borderRadius: '16px',
        boxShadow: '0 4px 20px rgba(42,120,165,0.1)',
        maxWidth: '400px',
        width: '100%'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px', textAlign: 'center' }}>🐾</div>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1A1714', marginBottom: '8px', textAlign: 'center' }}>Corral del Sol</h1>
        <p style={{ fontSize: '13px', color: '#6B6560', marginBottom: '28px', textAlign: 'center' }}>Sistema interno</p>

        {error && (
          <div style={{ background: '#FDEDEC', border: '1.5px solid #C0392B', borderRadius: '8px', padding: '12px', color: '#C0392B', fontSize: '12px', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '14px' }}>
            <label style={{ fontSize: '12px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Iniciales</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
              {iniciales.map((char, idx) => (
                <input
                  key={idx}
                  id={`inicial-${idx}`}
                  type="text"
                  maxLength="1"
                  value={char}
                  onChange={(e) => handleInicialesChange(idx, e.target.value)}
                  placeholder="A"
                  style={{
                    width: '100%',
                    padding: '16px',
                    border: '1.5px solid #E2DDD4',
                    borderRadius: '8px',
                    fontSize: '24px',
                    fontWeight: '600',
                    textAlign: 'center',
                    fontFamily: "'DM Mono', monospace",
                    boxSizing: 'border-box',
                    transition: 'border-color 0.2s'
                  }}
                  disabled={loading}
                  autoFocus={idx === 0}
                  onKeyDown={(e) => {
                    if (e.key === 'Backspace' && !char && idx > 0) {
                      document.getElementById(`inicial-${idx - 1}`)?.focus();
                    }
                  }}
                />
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '12px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>PIN</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
              {pin.map((digit, idx) => (
                <input
                  key={idx}
                  id={`pin-${idx}`}
                  type="password"
                  inputMode="numeric"
                  maxLength="1"
                  value={digit}
                  onChange={(e) => handlePinChange(idx, e.target.value)}
                  placeholder="•"
                  style={{
                    width: '100%',
                    padding: '16px',
                    border: '1.5px solid #E2DDD4',
                    borderRadius: '8px',
                    fontSize: '24px',
                    fontWeight: '600',
                    textAlign: 'center',
                    fontFamily: "'DM Mono', monospace",
                    boxSizing: 'border-box',
                    letterSpacing: '8px',
                    transition: 'border-color 0.2s'
                  }}
                  disabled={loading}
                  onKeyDown={(e) => {
                    if (e.key === 'Backspace' && !digit && idx > 0) {
                      document.getElementById(`pin-${idx - 1}`)?.focus();
                    }
                  }}
                />
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || iniciales.join('').length !== 2 || pin.join('').length !== 4}
            style={{
              width: '100%',
              padding: '12px',
              background: iniciales.join('').length !== 2 || pin.join('').length !== 4 ? '#9C9590' : '#2a78a5',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: loading || iniciales.join('').length !== 2 || pin.join('').length !== 4 ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s'
            }}
          >
            {loading ? '⏳ Ingresando...' : '🔓 Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
}
