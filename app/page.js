export default function Home() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: 'var(--bg)',
      color: 'var(--text)',
      padding: '20px',
    }}>
      <h1 style={{ fontSize: '32px', marginBottom: '20px' }}>🐾 Corral del Sol</h1>
      <p style={{ fontSize: '18px', marginBottom: '40px', color: 'var(--text2)' }}>Sistema de Cierre de Caja</p>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '20px',
        maxWidth: '600px',
      }}>
        <a href="/cajera" style={{
          padding: '20px',
          background: 'var(--accent)',
          color: 'white',
          textDecoration: 'none',
          borderRadius: '12px',
          textAlign: 'center',
          fontWeight: '600',
          transition: 'transform 0.2s',
        }} onMouseEnter={(e) => e.target.style.transform = 'translateY(-2px)'} onMouseLeave={(e) => e.target.style.transform = 'none'}>
          📝 Cajera
        </a>
        <a href="/revisora" style={{
          padding: '20px',
          background: 'var(--accent2)',
          color: '#1A1714',
          textDecoration: 'none',
          borderRadius: '12px',
          textAlign: 'center',
          fontWeight: '600',
          transition: 'transform 0.2s',
        }} onMouseEnter={(e) => e.target.style.transform = 'translateY(-2px)'} onMouseLeave={(e) => e.target.style.transform = 'none'}>
          ✅ Revisora
        </a>
      </div>
    </div>
  );
}
