'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '../components/Header';

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState('colaboradores');

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/login');
      return;
    }

    const parsedUser = JSON.parse(userData);
    if (parsedUser.rol !== 'admin') {
      router.push('/');
      return;
    }

    setUser(parsedUser);
  }, [router]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', fontFamily: "'DM Sans', sans-serif" }}>
      <Header title="Administración" subtitle="Gestión de colaboradores y roles" showLogout={false} />

      <div style={{ flex: 1, maxWidth: '1000px', margin: '0 auto', padding: '24px 16px', width: '100%' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '24px' }}>
          <button
            onClick={() => setTab('colaboradores')}
            style={{
              padding: '24px',
              background: tab === 'colaboradores' ? '#2a78a5' : '#F7F5F0',
              color: tab === 'colaboradores' ? 'white' : '#1A1714',
              border: 'none',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              if (tab !== 'colaboradores') e.currentTarget.style.background = '#E2DDD4';
            }}
            onMouseLeave={(e) => {
              if (tab !== 'colaboradores') e.currentTarget.style.background = '#F7F5F0';
            }}
          >
            👥 Colaboradores
          </button>

          <button
            onClick={() => setTab('roles')}
            style={{
              padding: '24px',
              background: tab === 'roles' ? '#2a78a5' : '#F7F5F0',
              color: tab === 'roles' ? 'white' : '#1A1714',
              border: 'none',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              if (tab !== 'roles') e.currentTarget.style.background = '#E2DDD4';
            }}
            onMouseLeave={(e) => {
              if (tab !== 'roles') e.currentTarget.style.background = '#F7F5F0';
            }}
          >
            🔐 Roles
          </button>
        </div>

        {tab === 'colaboradores' && <ColaboradoresTab />}
        {tab === 'roles' && <RolesTab />}
      </div>
    </div>
  );
}

function ColaboradoresTab() {
  const [colaboradores, setColaboradores] = useState([]);
  const [nombre, setNombre] = useState('');
  const [iniciales, setIniciales] = useState(['', '']);
  const [pin, setPin] = useState(['', '', '', '']);
  const [rol, setRol] = useState('cajera');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    loadColaboradores();
  }, []);

  const loadColaboradores = async () => {
    try {
      const res = await fetch('/api/admin/colaboradores');
      const data = await res.json();
      setColaboradores(data);
    } catch (err) {
      console.error('Error:', err);
    }
  };

  const handleGuardar = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    const inicialesCode = iniciales.join('');
    const pinCode = pin.join('');

    if (!nombre || inicialesCode.length !== 2 || pinCode.length !== 4) {
      setError('Completá todos los campos');
      setLoading(false);
      return;
    }

    try {
      const method = editingId ? 'PATCH' : 'POST';
      const url = editingId
        ? `/api/admin/colaboradores/${editingId}`
        : '/api/admin/colaboradores';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, iniciales: inicialesCode, pin: pinCode, rol })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Error');
        setLoading(false);
        return;
      }

      setSuccess(editingId ? '✅ Actualizado' : '✅ Agregado');
      setNombre('');
      setIniciales(['', '']);
      setPin(['', '', '', '']);
      setRol('cajera');
      setEditingId(null);
      loadColaboradores();
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const handleEditar = (col) => {
    setEditingId(col.id);
    setNombre(col.nombre);
    setIniciales(col.iniciales.split(''));
    setPin(col.pin.split(''));
    setRol(col.rol);
  };

  const handleCancelar = () => {
    setEditingId(null);
    setNombre('');
    setIniciales(['', '']);
    setPin(['', '', '', '']);
    setRol('cajera');
  };

  const handleInicialesChange = (index, value) => {
    if (!/^[A-Z]?$/.test(value.toUpperCase())) return;
    const newIniciales = [...iniciales];
    newIniciales[index] = value.toUpperCase();
    setIniciales(newIniciales);
  };

  const handlePinChange = (index, value) => {
    if (!/^\d?$/.test(value)) return;
    const newPin = [...pin];
    newPin[index] = value;
    setPin(newPin);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
      <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', padding: '20px', overflow: 'hidden' }}>
        <div style={{ fontSize: '16px', fontWeight: '600', color: '#1A1714', marginBottom: '16px' }}>{editingId ? '✏️ Editar' : '➕ Nuevo'}</div>

        <form onSubmit={handleGuardar} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {error && <div style={{ background: '#FDEDEC', border: '1.5px solid #C0392B', borderRadius: '8px', padding: '12px', color: '#C0392B', fontSize: '12px' }}>{error}</div>}
          {success && <div style={{ background: '#E8F3EC', border: '1.5px solid #27AE60', borderRadius: '8px', padding: '12px', color: '#27AE60', fontSize: '12px' }}>{success}</div>}

          <div>
            <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Nombre</label>
            <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="María" style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #E2DDD4', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }} disabled={loading} />
          </div>

          <div>
            <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Iniciales</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
              {iniciales.map((char, idx) => (
                <input
                  key={idx}
                  type="text"
                  maxLength="1"
                  value={char}
                  onChange={(e) => handleInicialesChange(idx, e.target.value)}
                  placeholder="A"
                  style={{ width: '100%', padding: '12px', border: '1.5px solid #E2DDD4', borderRadius: '8px', fontSize: '14px', fontWeight: '600', textAlign: 'center', fontFamily: "'DM Mono', monospace", boxSizing: 'border-box' }}
                  disabled={loading}
                />
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>PIN</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
              {pin.map((digit, idx) => (
                <input
                  key={idx}
                  type="password"
                  inputMode="numeric"
                  maxLength="1"
                  value={digit}
                  onChange={(e) => handlePinChange(idx, e.target.value)}
                  placeholder="•"
                  style={{ width: '100%', padding: '12px', border: '1.5px solid #E2DDD4', borderRadius: '8px', fontSize: '14px', fontWeight: '600', textAlign: 'center', fontFamily: "'DM Mono', monospace", boxSizing: 'border-box', letterSpacing: '6px' }}
                  disabled={loading}
                />
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Rol</label>
            <select value={rol} onChange={(e) => setRol(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #E2DDD4', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }} disabled={loading}>
              <option value="cajera">Cajera</option>
              <option value="revisora">Revisora</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: editingId ? '1fr 1fr' : '1fr', gap: '8px' }}>
            <button type="submit" disabled={loading || !nombre || iniciales.join('').length !== 2 || pin.join('').length !== 4} style={{ padding: '10px', background: !nombre || iniciales.join('').length !== 2 || pin.join('').length !== 4 ? '#9C9590' : '#2a78a5', color: 'white', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
              {loading ? '⏳' : editingId ? '💾 Guardar' : '✅ Agregar'}
            </button>
            {editingId && (
              <button type="button" onClick={handleCancelar} disabled={loading} style={{ padding: '10px', background: '#F0EDE6', color: '#6B6560', border: '1.5px solid #E2DDD4', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                ✕ Cancelar
              </button>
            )}
          </div>
        </form>
      </div>

      <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', padding: '20px' }}>
        <div style={{ fontSize: '16px', fontWeight: '600', color: '#1A1714', marginBottom: '12px' }}>Lista ({colaboradores.length})</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {colaboradores.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#9C9590', fontSize: '12px' }}>Sin colaboradores</div>
          ) : (
            colaboradores.map((col) => (
              <div key={col.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: '#F7F5F0', borderRadius: '6px', fontSize: '12px' }}>
                <div>
                  <div style={{ fontWeight: '600', color: '#1A1714' }}>{col.nombre}</div>
                  <div style={{ fontSize: '10px', color: '#9C9590' }}>{col.iniciales} • {col.rol}</div>
                </div>
                <button onClick={() => handleEditar(col)} disabled={loading} style={{ padding: '4px 8px', background: '#E8F3EC', color: '#2a78a5', border: 'none', borderRadius: '4px', fontSize: '10px', fontWeight: '600', cursor: 'pointer' }}>
                  ✏️
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function RolesTab() {
  return (
    <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', padding: '20px' }}>
      <div style={{ fontSize: '16px', fontWeight: '600', color: '#1A1714', marginBottom: '16px' }}>Roles y Permisos</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        {['Cajera', 'Revisora', 'Admin'].map((roleName) => (
          <div key={roleName} style={{ border: '1px solid #E2DDD4', borderRadius: '8px', padding: '16px' }}>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#1A1714', marginBottom: '12px' }}>{roleName}</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', color: '#6B6560' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="checkbox" defaultChecked={true} disabled style={{ cursor: 'pointer' }} />
                Registrar movimiento
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="checkbox" defaultChecked={roleName !== 'Revisora'} disabled style={{ cursor: 'pointer' }} />
                Cobros Glory
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="checkbox" defaultChecked={roleName !== 'Revisora'} disabled style={{ cursor: 'pointer' }} />
                Conteo de Caja
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="checkbox" defaultChecked={roleName !== 'Revisora'} disabled style={{ cursor: 'pointer' }} />
                Cierre de Caja
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="checkbox" defaultChecked={roleName === 'Revisora' || roleName === 'Admin'} disabled style={{ cursor: 'pointer' }} />
                Revisión de Caja
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="checkbox" defaultChecked={roleName === 'Admin'} disabled style={{ cursor: 'pointer' }} />
                Administración
              </label>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: '16px', padding: '12px', background: '#FBF6E9', borderRadius: '8px', fontSize: '12px', color: '#6B6560' }}>
        💡 Los permisos están predefinidos por rol. En futuras versiones se podrán personalizar.
      </div>
    </div>
  );
}
