'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import Header from '../components/Header';

const SUPABASE_URL = 'https://ccvhtcqeknbexmywzhiv.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ZbOn9YmMlAtPkWnAdIZbEQ_muWS-plF';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const fmt = n => '₡' + Math.round(n).toLocaleString('es-CR');

const getFechaCostaRica = () => {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Costa_Rica',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const [mes, dia, ano] = formatter.format(now).split('/');
  return `${ano}-${mes}-${dia}`;
};

export default function CobroGloryPage() {
  const [cajera, setCajera] = useState('');
  const [caja, setCaja] = useState('');
  const [colaboradores, setColaboradores] = useState([]);
  const [nombreMascota, setNombreMascota] = useState('');
  const [nombreDueno, setNombreDueno] = useState('');
  const [telefonoDueno, setTelefonoDueno] = useState('');
  const [servicio, setServicio] = useState('');
  const [comentarios, setComentarios] = useState('');
  const [pacientesAIngresar, setPacientesAIngresar] = useState([]);
  const [pacientesEspera, setPacientesEspera] = useState([]);
  const [registrosDia, setRegistrosDia] = useState([]);
  const [filterFecha, setFilterFecha] = useState('');
  const [toast, setToast] = useState('');
  const [modalActivo, setModalActivo] = useState(false);
  const [pacienteEnModal, setPacienteEnModal] = useState(null);
  const [selectMetodo, setSelectMetodo] = useState('');
  const [inputMonto, setInputMonto] = useState('');
  const [selectCajeraModal, setSelectCajeraModal] = useState('');
  const [pacientesSeleccionados, setPacientesSeleccionados] = useState(new Set());
  const [mesSeleccionado, setMesSeleccionado] = useState(new Date().toISOString().slice(0, 7));
  const [resumenMes, setResumenMes] = useState(null);
  const [comentariosCobro, setComentariosCobro] = useState('');

  useEffect(() => {
    const hoy = getFechaCostaRica();
    setFilterFecha(hoy);

    const userData = localStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      setCajera(user.nombre);
      setSelectCajeraModal(user.nombre);
    }

    loadCajeras();
    cargarPacientesEspera();
    cargarRegistrosDia(hoy);
  }, []);

  async function loadCajeras() {
    try {
      const res = await fetch('/api/admin/colaboradores');
      const data = await res.json();
      setColaboradores(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error cargando cajeras:', err);
    }
  }

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const formatTelefono = (valor) => {
    const solo_numeros = valor.replace(/\D/g, '');
    if (solo_numeros.length <= 4) return solo_numeros;
    return `${solo_numeros.slice(0, 4)}-${solo_numeros.slice(4, 8)}`;
  };

  function agregarPacienteALista() {
    if (!nombreMascota.trim() || !nombreDueno.trim()) {
      showToast('❌ Completá nombre de mascota y dueño');
      return;
    }

    if (!servicio) {
      showToast('❌ Selecciona un servicio');
      return;
    }

    const paciente = {
      id: Date.now(),
      nombre_mascota: nombreMascota,
      nombre_dueno: nombreDueno,
      telefono_dueno: telefonoDueno,
      servicio: servicio,
      comentarios: comentarios
    };

    setPacientesAIngresar([...pacientesAIngresar, paciente]);
    setNombreMascota('');
    setServicio('');
    setComentarios('');
  }

  function quitarPacienteDeLista(id) {
    setPacientesAIngresar(pacientesAIngresar.filter(p => p.id !== id));
  }

  async function guardarTodosPacientes() {
    if (pacientesAIngresar.length === 0) {
      showToast('❌ Agrega al menos un paciente');
      return;
    }

    if (!cajera || !caja) {
      showToast('❌ Debe haber una cajera y caja seleccionada');
      return;
    }

    try {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Costa_Rica',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      const [mes, dia, ano] = formatter.format(now).split('/');
      const fecha = `${ano}-${mes}-${dia}`;
      const pacientesParaGuardar = pacientesAIngresar.map(p => ({
        nombre_mascota: p.nombre_mascota,
        nombre_dueno: p.nombre_dueno,
        telefono_dueno: p.telefono_dueno,
        servicio: p.servicio,
        comentarios: p.comentarios,
        fecha: fecha,
        cajera: cajera,
        caja: caja,
        cobrado: false
      }));

      const { error } = await supabase.from('cobros_glory').insert(pacientesParaGuardar);

      if (error) {
        console.error('Error Supabase:', error);
        showToast('❌ Error al guardar pacientes: ' + error.message);
        return;
      }

      showToast(`✅ ${pacientesAIngresar.length} paciente(s) agregado(s)`);
      setPacientesAIngresar([]);
      cargarPacientesEspera();
    } catch (err) {
      showToast('❌ Error: ' + err.message);
    }
  }

  async function cargarPacientesEspera() {
    try {
      const hoy = getFechaCostaRica();
      const { data } = await supabase.from('cobros_glory')
        .select('*')
        .eq('cobrado', false)
        .eq('fecha', hoy)
        .order('hora_ingreso', { ascending: true });

      setPacientesEspera(data || []);
    } catch (err) {
      console.error('Error cargando pacientes:', err);
    }
  }

  async function cargarRegistrosDia(fecha) {
    try {
      const { data } = await supabase.from('cobros_glory')
        .select('*')
        .eq('cobrado', true)
        .eq('fecha', fecha)
        .not('monto', 'is', null)
        .order('hora_cobro', { ascending: false });

      setRegistrosDia(data || []);
    } catch (err) {
      console.error('Error cargando registros:', err);
    }
  }

  async function cargarResumenMes(mes) {
    try {
      const [año, mesNum] = mes.split('-');
      const inicio = `${año}-${mesNum}-01`;
      const fin = `${año}-${mesNum}-31`;

      const { data } = await supabase.from('cobros_glory')
        .select('*')
        .eq('cobrado', true)
        .not('monto', 'is', null)
        .gte('fecha', inicio)
        .lte('fecha', fin)
        .order('fecha', { ascending: false });

      const registros = data || [];

      // Filtrar solo registros con metodo (transacciones completadas)
      const transacciones = registros.filter(r => r.metodo);

      // Contar cantidad de pacientes
      let cantidadPacientes = 0;
      transacciones.forEach(r => {
        if (r.unificado) {
          // Contar comas + 1 para saber cuántas mascotas hay
          cantidadPacientes += (r.nombre_mascota.split(',').length);
        } else {
          cantidadPacientes += 1;
        }
      });

      const resumen = {
        total: transacciones.reduce((sum, r) => sum + (r.monto || 0), 0),
        transacciones: transacciones.length,
        pacientes: cantidadPacientes,
        porMetodo: {},
        porCajera: {},
        registros: transacciones
      };

      transacciones.forEach(r => {
        const metodo = r.metodo || 'Sin registro';
        resumen.porMetodo[metodo] = (resumen.porMetodo[metodo] || 0) + (r.monto || 0);
        const nombreCajera = r.cajera || 'Sin asignar';
        resumen.porCajera[nombreCajera] = (resumen.porCajera[nombreCajera] || 0) + (r.monto || 0);
      });

      setResumenMes(resumen);
    } catch (err) {
      console.error('Error cargando resumen:', err);
      showToast('❌ Error cargando resumen del mes');
    }
  }

  function descargarExcel() {
    if (!resumenMes || resumenMes.registros.length === 0) {
      showToast('❌ No hay datos para descargar');
      return;
    }

    try {
      const [año, mes] = mesSeleccionado.split('-');
      const nombreMes = new Date(año, parseInt(mes) - 1).toLocaleString('es-CR', { month: 'long', year: 'numeric' });

      const datosTabla = resumenMes.registros.map(r => ({
        Fecha: r.fecha ? new Date(r.fecha + 'T00:00:00') : '',
        Hora: r.hora_cobro ? new Date(r.hora_cobro).toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' }) : '',
        Mascota: r.nombre_mascota || '',
        Dueño: r.nombre_dueno || '',
        Teléfono: r.telefono_dueno || '',
        Servicio: r.servicio || '',
        Método: r.metodo || '',
        Monto: r.monto || 0,
        Cajera: r.cajera || '',
        Comentarios: r.comentarios_cobro || '',
        Unificado: r.unificado ? 'Sí' : 'No'
      }));

      // Agregar fila de total al final
      datosTabla.push({
        Fecha: '',
        Hora: '',
        Mascota: '',
        Dueño: '',
        Teléfono: '',
        Servicio: '',
        Método: 'TOTAL',
        Monto: resumenMes.total,
        Cajera: '',
        Comentarios: '',
        Unificado: ''
      });

      const wb = XLSX.utils.book_new();

      // Hoja de transacciones con estilos
      const ws1 = XLSX.utils.json_to_sheet(datosTabla);

      // Aplicar estilos alternados y filtros
      const range = XLSX.utils.decode_range(ws1['!ref']);

      // Color de encabezado
      const headerFill = { fgColor: { rgb: 'FF2A78A5' }, patternType: 'solid' };
      const headerFont = { bold: true, color: { rgb: 'FFFFFFFF' } };

      // Colores alternados para filas
      const colorClaro = { fgColor: { rgb: 'FFFFFFFF' }, patternType: 'solid' };
      const colorOscuro = { fgColor: { rgb: 'FFF0EDE6' }, patternType: 'solid' };
      const colorTotal = { fgColor: { rgb: 'FFFFE8F3' }, patternType: 'solid' };

      // Aplicar estilos a cada celda
      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellAddress = XLSX.utils.encode_col(C) + XLSX.utils.encode_row(R);
          const cell = ws1[cellAddress];
          if (!cell) continue;

          if (R === 0) {
            // Encabezado
            cell.fill = headerFill;
            cell.font = headerFont;
            cell.alignment = { horizontal: 'center', vertical: 'center' };
          } else if (R === range.e.r) {
            // Fila de total
            cell.fill = colorTotal;
            if (C === 7) cell.font = { bold: true };
          } else {
            // Filas alternadas
            cell.fill = R % 2 === 0 ? colorClaro : colorOscuro;
            if (C === 7) cell.alignment = { horizontal: 'right' };
            // Formato de fecha para columna Fecha (C === 0)
            if (C === 0) cell.numFmt = 'dd/mm/yyyy';
          }
        }
      }

      // Agregar filtros automáticos
      ws1['!autofilter'] = { ref: XLSX.utils.encode_range(range.s, { r: range.e.r - 1, c: range.e.c }) };

      // Configurar ancho de columnas
      ws1['!cols'] = [
        { wch: 12 },
        { wch: 10 },
        { wch: 20 },
        { wch: 20 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 30 },
        { wch: 12 }
      ];

      XLSX.utils.book_append_sheet(wb, ws1, 'Transacciones');

      // Hoja de resumen
      const resumenData = [
        { Concepto: 'RESUMEN DEL MES', Valor: '' },
        { Concepto: '', Valor: '' },
        { Concepto: 'Total General', Valor: resumenMes.total },
        { Concepto: 'Pacientes', Valor: resumenMes.pacientes },
        { Concepto: 'Transacciones', Valor: resumenMes.transacciones },
        { Concepto: '', Valor: '' },
        { Concepto: 'POR MÉTODO', Valor: '' }
      ];

      Object.entries(resumenMes.porMetodo).forEach(([metodo, monto]) => {
        resumenData.push({ Concepto: metodo, Valor: monto });
      });

      resumenData.push({ Concepto: '', Valor: '' });
      resumenData.push({ Concepto: 'POR CAJERA', Valor: '' });

      Object.entries(resumenMes.porCajera).forEach(([cajera, monto]) => {
        resumenData.push({ Concepto: cajera, Valor: monto });
      });

      const ws2 = XLSX.utils.json_to_sheet(resumenData);
      ws2['!cols'] = [{ wch: 25 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(wb, ws2, 'Resumen');

      const nombreArchivo = `Cobros_Glory_${nombreMes.replace(' ', '_')}.xlsx`;
      XLSX.writeFile(wb, nombreArchivo);
      showToast('✅ Excel descargado');
    } catch (err) {
      console.error('Error descargando Excel:', err);
      showToast('❌ Error: ' + err.message);
    }
  }

  function abrirModalCobro(id, mascota, dueno) {
    setPacienteEnModal({ id, mascota, dueno });
    setSelectMetodo('');
    setInputMonto('');
    setSelectCajeraModal(cajera);
    setComentariosCobro('');
    setModalActivo(true);
  }

  function cerrarModal() {
    setModalActivo(false);
    setPacienteEnModal(null);
    setComentariosCobro('');
  }

  function toggleSeleccionar(id) {
    const nuevo = new Set(pacientesSeleccionados);
    if (nuevo.has(id)) {
      nuevo.delete(id);
    } else {
      nuevo.add(id);
    }
    setPacientesSeleccionados(nuevo);
  }

  function abrirModalUnificado() {
    if (pacientesSeleccionados.size < 2) {
      showToast('❌ Selecciona al menos 2 pacientes');
      return;
    }

    const pacientes = pacientesEspera.filter(p => pacientesSeleccionados.has(p.id));

    // Validar que todos tengan el mismo dueño
    const dueños = new Set(pacientes.map(p => p.nombre_dueno));
    if (dueños.size > 1) {
      showToast('❌ Todos los pacientes deben tener el mismo dueño');
      return;
    }

    const montoTotal = pacientes.reduce((sum, p) => sum + (p.monto || 0), 0);
    const nombresMascotas = pacientes.map(p => p.nombre_mascota).join(', ');

    setPacienteEnModal({
      id: Array.from(pacientesSeleccionados),
      mascota: nombresMascotas,
      dueno: pacientes[0].nombre_dueno,
      montoTotal,
      unificado: true
    });
    setInputMonto(montoTotal.toString());
    setSelectMetodo('');
    setSelectCajeraModal(cajera);
    setModalActivo(true);
  }

  async function confirmarCobro() {
    if (!selectCajeraModal || !selectMetodo || !inputMonto || parseFloat(inputMonto) <= 0) {
      showToast('❌ Completá todos los campos');
      return;
    }

    try {
      const esTarjeta = selectMetodo === 'Tarjeta BAC' || selectMetodo === 'Tarjeta BN';
      const montoFinal = esTarjeta ? parseFloat(inputMonto) * 1.13 : parseFloat(inputMonto);
      const idsAActualizar = Array.isArray(pacienteEnModal.id) ? pacienteEnModal.id : [pacienteEnModal.id];

      if (pacienteEnModal.unificado) {
        // Insertar UN registro unificado
        const { error: insertError } = await supabase.from('cobros_glory').insert([
          {
            nombre_mascota: pacienteEnModal.mascota,
            nombre_dueno: pacienteEnModal.dueno,
            telefono_dueno: pacientesEspera.find(p => p.id === idsAActualizar[0])?.telefono_dueno,
            servicio: pacientesEspera.find(p => p.id === idsAActualizar[0])?.servicio,
            fecha: getFechaCostaRica(),
            hora_ingreso: new Date().toISOString(),
            hora_cobro: new Date().toISOString(),
            metodo: selectMetodo,
            monto: montoFinal,
            cajera: selectCajeraModal,
            cobrado: true,
            unificado: true,
            caja: caja,
            comentarios_cobro: comentariosCobro || null
          }
        ]);

        if (insertError) {
          console.error('Error Supabase:', insertError);
          showToast('❌ Error al registrar cobro: ' + insertError.message);
          return;
        }

        // Marcar solo como cobrados (sin monto duplicado) para no mostrar en registros
        for (const id of idsAActualizar) {
          await supabase.from('cobros_glory')
            .update({ cobrado: true, metodo: selectMetodo, cajera: selectCajeraModal, hora_cobro: new Date().toISOString() })
            .eq('id', id);
        }
      } else {
        // Cobro individual - actualizar el registro existente
        const { error } = await supabase.from('cobros_glory')
          .update({
            cobrado: true,
            metodo: selectMetodo,
            monto: montoFinal,
            cajera: selectCajeraModal,
            hora_cobro: new Date().toISOString(),
            comentarios_cobro: comentariosCobro || null
          })
          .eq('id', idsAActualizar[0]);

        if (error) {
          console.error('Error Supabase:', error);
          showToast('❌ Error al registrar cobro: ' + error.message);
          return;
        }
      }

      showToast('✅ Cobro(s) registrado(s)');
      cerrarModal();
      setPacientesSeleccionados(new Set());
      cargarPacientesEspera();
      cargarRegistrosDia(filterFecha);
    } catch (err) {
      showToast('❌ Error: ' + err.message);
    }
  }

  const totalDia = registrosDia.reduce((sum, r) => sum + (r.monto || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', fontFamily: "'DM Sans', sans-serif" }}>
      <Header title="Cobros Glory" subtitle="Registra servicios de grooming" showLogout={false} />

      {/* Main */}
      <div style={{ flex: 1, maxWidth: '720px', margin: '0 auto', padding: '24px 16px', width: '100%' }}>

        {/* Selectores Cajera y Caja */}
        <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', marginBottom: '16px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2DDD4', display: 'flex', alignItems: 'center', gap: '10px', background: '#F0EDE6' }}>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#1A1714' }}>Información</div>
          </div>
          <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Cajera</label>
              <div style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #E2DDD4', borderRadius: '8px', fontSize: '14px', background: '#F0EDE6', color: '#1A1714', fontWeight: '600' }}>{cajera || 'Cargando...'}</div>
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Caja</label>
              <select value={caja} onChange={(e) => setCaja(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #E2DDD4', borderRadius: '8px', fontSize: '14px' }}>
                <option value="">Seleccionar...</option>
                <option value="Caja 1 (clínica)">Caja 1 (clínica)</option>
                <option value="Caja 2">Caja 2</option>
              </select>
            </div>
          </div>
        </div>

        {/* SECCIÓN 1: Ingresar paciente */}
        <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', marginBottom: '16px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2DDD4', display: 'flex', alignItems: 'center', gap: '10px', background: '#F0EDE6' }}>
            <div style={{ width: '26px', height: '26px', background: '#2a78a5', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '600', flexShrink: 0 }}>1</div>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#1A1714' }}>Ingresar paciente</div>
          </div>
          <div style={{ padding: '20px' }}>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Nombre de la mascota</label>
              <input type="text" value={nombreMascota} onChange={(e) => setNombreMascota(e.target.value)} placeholder="Ej: Firulais" style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #E2DDD4', borderRadius: '8px', fontSize: '14px' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Nombre del dueño</label>
                <input type="text" value={nombreDueno} onChange={(e) => setNombreDueno(e.target.value)} placeholder="Ej: Juan Pérez" style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #E2DDD4', borderRadius: '8px', fontSize: '14px' }} />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Teléfono</label>
                <input type="tel" value={telefonoDueno} onChange={(e) => setTelefonoDueno(formatTelefono(e.target.value))} placeholder="Ej: 8765-4321" style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #E2DDD4', borderRadius: '8px', fontSize: '14px' }} />
              </div>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Servicio</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                {[
                  { id: 'corte', label: 'Corte' },
                  { id: 'corte_baño', label: 'Corte y baño' },
                  { id: 'otro', label: 'Otro' }
                ].map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setServicio(s.id)}
                    style={{
                      padding: '10px',
                      border: servicio === s.id ? '2px solid #2a78a5' : '1.5px solid #E2DDD4',
                      borderRadius: '8px',
                      background: servicio === s.id ? '#E8F3EC' : '#FFFFFF',
                      color: '#1A1714',
                      fontWeight: '600',
                      cursor: 'pointer',
                      fontSize: '12px',
                      transition: 'all 0.2s'
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Comentarios</label>
              <input type="text" value={comentarios} onChange={(e) => setComentarios(e.target.value)} placeholder="Ej: Tiene alergia al pollo" style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #E2DDD4', borderRadius: '8px', fontSize: '14px' }} />
            </div>
            <button onClick={agregarPacienteALista} style={{ width: '100%', marginTop: '16px', padding: '12px', background: '#2a78a5', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', transition: 'background 0.2s' }} onMouseEnter={(e) => e.target.style.background = '#1f5780'} onMouseLeave={(e) => e.target.style.background = '#2a78a5'}>+ Agregar otro paciente</button>
          </div>
        </div>

        {/* SECCIÓN 1.5: Pacientes a ingresar */}
        {pacientesAIngresar.length > 0 && (
          <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', marginBottom: '16px', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2DDD4', background: '#F0EDE6' }}>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#1A1714' }}>Pacientes a ingresar ({pacientesAIngresar.length})</div>
            </div>
            <div style={{ padding: '20px' }}>
              {pacientesAIngresar.reduce((grupos, p) => {
                const grupoExistente = grupos.find(g => g.dueno === p.nombre_dueno);
                if (grupoExistente) {
                  grupoExistente.pacientes.push(p);
                } else {
                  grupos.push({ dueno: p.nombre_dueno, telefono: p.telefono_dueno, pacientes: [p] });
                }
                return grupos;
              }, []).map((grupo, idx) => (
                <div key={idx} style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: idx < pacientesAIngresar.length / Math.max(1, pacientesAIngresar.filter(p => p.nombre_dueno === grupo.dueno).length) ? '1px solid #E2DDD4' : 'none' }}>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#2a78a5', marginBottom: '8px' }}>
                    {grupo.dueno} ({grupo.telefono})
                  </div>
                  {grupo.pacientes.map(p => (
                    <div key={p.id} style={{ background: '#F0EDE6', padding: '12px', borderRadius: '8px', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: '600', color: '#1A1714' }}>{p.nombre_mascota}</div>
                          <div style={{ fontSize: '11px', color: '#6B6560', marginTop: '2px' }}>Servicio: {p.servicio === 'corte' ? 'Corte' : p.servicio === 'corte_baño' ? 'Corte y baño' : 'Otro'}</div>
                          {p.comentarios && <div style={{ fontSize: '11px', color: '#6B6560', marginTop: '2px' }}>Comentarios: {p.comentarios}</div>}
                        </div>
                        <button
                          type="button"
                          onClick={() => quitarPacienteDeLista(p.id)}
                          style={{ fontSize: '11px', padding: '4px 8px', background: '#FDEDEC', color: '#C0392B', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '600' }}
                        >
                          Quitar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
              <button onClick={guardarTodosPacientes} style={{ width: '100%', marginTop: '16px', padding: '12px', background: '#27AE60', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', transition: 'background 0.2s' }} onMouseEnter={(e) => e.target.style.background = '#1E8449'} onMouseLeave={(e) => e.target.style.background = '#27AE60'}>✓ Guardar todos los pacientes</button>
            </div>
          </div>
        )}

        {/* SECCIÓN 2: Pacientes en espera */}
        <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', marginBottom: '16px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2DDD4', display: 'flex', alignItems: 'center', gap: '10px', background: '#F0EDE6' }}>
            <div style={{ width: '26px', height: '26px', background: '#2a78a5', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '600', flexShrink: 0 }}>2</div>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#1A1714' }}>Pacientes en espera ({pacientesEspera.length})</div>
          </div>
          <div style={{ padding: '20px' }}>
            {pacientesEspera.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#6B6560' }}>Sin pacientes en espera</div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px', marginBottom: '16px' }}>
                  {pacientesEspera.map(p => (
                    <div key={p.id} style={{ background: pacientesSeleccionados.has(p.id) ? '#E8F3EC' : '#F0EDE6', border: pacientesSeleccionados.has(p.id) ? '2px solid #2a78a5' : '1px solid #E2DDD4', borderRadius: '8px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                      <input type="checkbox" checked={pacientesSeleccionados.has(p.id)} onChange={() => toggleSeleccionar(p.id)} style={{ width: '20px', height: '20px', cursor: 'pointer' }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '11px', color: '#6B6560', textTransform: 'uppercase', fontWeight: '600' }}>Mascota</div>
                        <div style={{ fontSize: '14px', color: '#1A1714', fontWeight: '600' }}>{p.nombre_mascota}</div>
                        <div style={{ fontSize: '11px', color: '#6B6560', textTransform: 'uppercase', fontWeight: '600', marginTop: '8px' }}>Dueño</div>
                        <div style={{ fontSize: '14px', color: '#1A1714' }}>{p.nombre_dueno}</div>
                        {p.telefono_dueno && (
                          <>
                            <div style={{ fontSize: '11px', color: '#6B6560', textTransform: 'uppercase', fontWeight: '600', marginTop: '6px' }}>Teléfono</div>
                            <div style={{ fontSize: '13px', color: '#2a78a5', fontFamily: "'DM Mono', monospace" }}>{p.telefono_dueno}</div>
                          </>
                        )}
                        {p.servicio && (
                          <>
                            <div style={{ fontSize: '11px', color: '#6B6560', textTransform: 'uppercase', fontWeight: '600', marginTop: '6px' }}>Servicio</div>
                            <div style={{ fontSize: '13px', color: '#1A1714' }}>{p.servicio === 'corte' ? 'Corte' : p.servicio === 'corte_baño' ? 'Corte y baño' : 'Otro'}</div>
                          </>
                        )}
                        {p.comentarios && (
                          <>
                            <div style={{ fontSize: '11px', color: '#6B6560', textTransform: 'uppercase', fontWeight: '600', marginTop: '6px' }}>Comentarios</div>
                            <div style={{ fontSize: '13px', color: '#6B6560', fontStyle: 'italic' }}>{p.comentarios}</div>
                          </>
                        )}
                        <div style={{ fontSize: '11px', color: '#6B6560', textTransform: 'uppercase', fontWeight: '600', marginTop: '8px' }}>Ingreso</div>
                        <div style={{ fontSize: '14px', color: '#1A1714', fontFamily: "'DM Mono', monospace" }}>{new Date(p.hora_ingreso).toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
                        <button onClick={() => abrirModalCobro(p.id, p.nombre_mascota, p.nombre_dueno)} style={{ padding: '8px 12px', background: '#2a78a5', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'background 0.2s' }} onMouseEnter={(e) => e.target.style.background = '#1f5780'} onMouseLeave={(e) => e.target.style.background = '#2a78a5'}>Cobrar</button>
                      </div>
                    </div>
                  ))}
                </div>
                {pacientesSeleccionados.size > 0 && (
                  <button onClick={abrirModalUnificado} style={{ width: '100%', padding: '12px', background: '#10B981', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', transition: 'background 0.2s' }} onMouseEnter={(e) => e.target.style.background = '#059669'} onMouseLeave={(e) => e.target.style.background = '#10B981'}>
                    ✓ Unificar {pacientesSeleccionados.size} pacientes
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* SECCIÓN 3: Registros del día */}
        <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', marginBottom: '16px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2DDD4', display: 'flex', alignItems: 'center', gap: '10px', background: '#F0EDE6' }}>
            <div style={{ width: '26px', height: '26px', background: '#2a78a5', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '600', flexShrink: 0 }}>3</div>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#1A1714' }}>Registros del día</div>
          </div>
          <div style={{ padding: '20px' }}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Filtrar por fecha</label>
              <input type="date" value={filterFecha} onChange={(e) => { setFilterFecha(e.target.value); cargarRegistrosDia(e.target.value); }} style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #E2DDD4', borderRadius: '8px', fontSize: '14px' }} />
            </div>
            {registrosDia.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#6B6560' }}>Sin registros</div>
            ) : (
              <>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px' }}>
                  <thead style={{ background: '#F0EDE6', borderBottom: '1px solid #E2DDD4' }}>
                    <tr>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase' }}>Hora</th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase' }}>Mascota</th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase' }}>Dueño</th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase' }}>Método</th>
                      <th style={{ padding: '12px', textAlign: 'right', fontSize: '11px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase' }}>Monto</th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase' }}>Cajera</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registrosDia.map((r, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #E2DDD4' }}>
                        <td style={{ padding: '12px', fontSize: '14px', fontFamily: "'DM Mono', monospace" }}>{new Date(r.hora_cobro).toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' })}</td>
                        <td style={{ padding: '12px', fontSize: '14px' }}>
                          <div style={{ textDecoration: 'none' }}>{r.nombre_mascota}</div>
                          {r.unificado && <div style={{ fontSize: '10px', color: '#2a78a5', fontWeight: '600', marginTop: '2px' }}>✓ Unificado</div>}
                        </td>
                        <td style={{ padding: '12px', fontSize: '14px' }}>{r.nombre_dueno}</td>
                        <td style={{ padding: '12px', fontSize: '14px' }}>{r.metodo || '—'}</td>
                        <td style={{ padding: '12px', fontSize: '14px', textAlign: 'right', fontWeight: '600' }}>{fmt(r.monto)}</td>
                        <td style={{ padding: '12px', fontSize: '14px' }}>{r.cajera || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ padding: '12px 16px', background: '#E8F3EC', borderRadius: '8px', marginTop: '16px' }}>
                  <div style={{ fontSize: '10px', color: '#6B6560', marginBottom: '4px', textTransform: 'uppercase', fontWeight: '600' }}>Total del día</div>
                  <div style={{ fontSize: '22px', fontWeight: '700', color: '#2a78a5', fontFamily: "'DM Mono', monospace" }}>{fmt(totalDia)}</div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* SECCIÓN 4: Resumen del mes */}
        <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', marginBottom: '16px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2DDD4', display: 'flex', alignItems: 'center', gap: '10px', background: '#F0EDE6' }}>
            <div style={{ width: '26px', height: '26px', background: '#2a78a5', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '600', flexShrink: 0 }}>4</div>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#1A1714' }}>Resumen del mes</div>
          </div>
          <div style={{ padding: '20px' }}>
            <div style={{ marginBottom: '16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Seleccionar mes</label>
                <input type="month" value={mesSeleccionado} onChange={(e) => { setMesSeleccionado(e.target.value); cargarResumenMes(e.target.value); }} style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #E2DDD4', borderRadius: '8px', fontSize: '14px' }} />
              </div>
              <button onClick={() => descargarExcel()} disabled={!resumenMes} style={{ marginTop: '22px', padding: '10px 16px', background: '#27AE60', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: resumenMes ? 'pointer' : 'not-allowed', opacity: resumenMes ? 1 : 0.5, transition: 'background 0.2s' }} onMouseEnter={(e) => resumenMes && (e.target.style.background = '#1E8449')} onMouseLeave={(e) => (e.target.style.background = '#27AE60')}>📥 Descargar Excel</button>
            </div>

            {resumenMes ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '20px' }}>
                  <div style={{ padding: '16px', background: '#F7F5F0', borderRadius: '8px', borderLeft: '4px solid #2a78a5' }}>
                    <div style={{ fontSize: '11px', color: '#6B6560', textTransform: 'uppercase', fontWeight: '600', marginBottom: '4px' }}>Total General</div>
                    <div style={{ fontSize: '20px', fontWeight: '700', color: '#2a78a5', fontFamily: "'DM Mono', monospace" }}>{fmt(resumenMes.total)}</div>
                  </div>
                  <div style={{ padding: '16px', background: '#F7F5F0', borderRadius: '8px', borderLeft: '4px solid #10B981' }}>
                    <div style={{ fontSize: '11px', color: '#6B6560', textTransform: 'uppercase', fontWeight: '600', marginBottom: '4px' }}>Pacientes</div>
                    <div style={{ fontSize: '20px', fontWeight: '700', color: '#10B981', fontFamily: "'DM Mono', monospace" }}>{resumenMes.pacientes}</div>
                  </div>
                  <div style={{ padding: '16px', background: '#F7F5F0', borderRadius: '8px', borderLeft: '4px solid #8B5CF6' }}>
                    <div style={{ fontSize: '11px', color: '#6B6560', textTransform: 'uppercase', fontWeight: '600', marginBottom: '4px' }}>Transacciones</div>
                    <div style={{ fontSize: '20px', fontWeight: '700', color: '#8B5CF6', fontFamily: "'DM Mono', monospace" }}>{resumenMes.transacciones}</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: '600', color: '#1A1714', marginBottom: '12px', textTransform: 'uppercase' }}>Por Método</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {Object.entries(resumenMes.porMetodo).map(([metodo, monto]) => (
                        <div key={metodo} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #E2DDD4' }}>
                          <span style={{ fontSize: '13px', color: '#6B6560' }}>{metodo}</span>
                          <span style={{ fontSize: '13px', fontWeight: '600', color: '#1A1714', fontFamily: "'DM Mono', monospace" }}>{fmt(monto)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: '600', color: '#1A1714', marginBottom: '12px', textTransform: 'uppercase' }}>Por Cajera</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {Object.entries(resumenMes.porCajera).map(([cajera, monto]) => (
                        <div key={cajera} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #E2DDD4' }}>
                          <span style={{ fontSize: '13px', color: '#6B6560' }}>{cajera}</span>
                          <span style={{ fontSize: '13px', fontWeight: '600', color: '#1A1714', fontFamily: "'DM Mono', monospace" }}>{fmt(monto)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#6B6560' }}>
                <div style={{ fontSize: '14px', marginBottom: '8px' }}>Selecciona un mes para ver el resumen</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de cobro */}
      {modalActivo && pacienteEnModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '28px 24px', maxWidth: '450px', width: '90%', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ marginBottom: '20px', borderBottom: '1px solid #E2DDD4', paddingBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#1A1714' }}>{pacienteEnModal.mascota}</h3>
              <p style={{ fontSize: '13px', color: '#6B6560', marginTop: '4px' }}>{pacienteEnModal.dueno}</p>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Cajera</label>
                <div style={{ width: '100%', padding: '10px 12px', background: '#F0EDE6', borderRadius: '8px', fontSize: '14px', color: '#1A1714', fontWeight: '600', border: '1.5px solid #E2DDD4' }}>{selectCajeraModal}</div>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Método de pago</label>
                <select value={selectMetodo} onChange={(e) => setSelectMetodo(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #E2DDD4', borderRadius: '8px', fontSize: '14px' }}>
                  <option value="">Seleccionar...</option>
                  <option value="Efectivo">Efectivo</option>
                  <option value="Tarjeta BAC">Tarjeta BAC</option>
                  <option value="Tarjeta BN">Tarjeta BN</option>
                  <option value="SINPE">SINPE</option>
                  <option value="Transferencia">Transferencia</option>
                </select>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Monto (₡)</label>
                <input type="number" value={inputMonto} onChange={(e) => setInputMonto(e.target.value)} placeholder="0" min="0" style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #E2DDD4', borderRadius: '8px', fontSize: '14px' }} />
              </div>
              {inputMonto && selectMetodo && (
                <div style={{ marginTop: '16px', padding: '12px', background: '#F7F5F0', borderRadius: '8px', borderLeft: '4px solid #2a78a5' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
                    <span style={{ color: '#6B6560' }}>Subtotal:</span>
                    <span style={{ fontWeight: '600', color: '#1A1714' }}>₡{parseFloat(inputMonto).toLocaleString('es-CR')}</span>
                  </div>
                  {(selectMetodo === 'Tarjeta BAC' || selectMetodo === 'Tarjeta BN') && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
                      <span style={{ color: '#6B6560' }}>Comisión (13%):</span>
                      <span style={{ fontWeight: '600', color: '#E67E22' }}>₡{(parseFloat(inputMonto) * 0.13).toLocaleString('es-CR', { maximumFractionDigits: 0 })}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid #E2DDD4', fontSize: '14px' }}>
                    <span style={{ color: '#1A1714', fontWeight: '600' }}>Total:</span>
                    <span style={{ fontWeight: '700', color: '#2a78a5', fontSize: '16px' }}>₡{((selectMetodo === 'Tarjeta BAC' || selectMetodo === 'Tarjeta BN') ? parseFloat(inputMonto) * 1.13 : parseFloat(inputMonto)).toLocaleString('es-CR', { maximumFractionDigits: 0 })}</span>
                  </div>
                </div>
              )}
              <div style={{ marginBottom: '12px', marginTop: '12px' }}>
                <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Comentarios (opcional)</label>
                <textarea value={comentariosCobro} onChange={(e) => setComentariosCobro(e.target.value)} placeholder="Ej: Problemas con tarjeta, se reintentará..." style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #E2DDD4', borderRadius: '8px', fontSize: '14px', minHeight: '80px', fontFamily: 'inherit', resize: 'none' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={cerrarModal} style={{ padding: '10px 16px', fontSize: '14px', background: '#F0EDE6', color: '#1A1714', border: '1.5px solid #E2DDD4', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', transition: 'background 0.2s' }} onMouseEnter={(e) => e.target.style.background = '#E2DDD4'} onMouseLeave={(e) => e.target.style.background = '#F0EDE6'}>Cancelar</button>
              <button onClick={confirmarCobro} style={{ padding: '10px 16px', fontSize: '14px', background: '#2a78a5', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', transition: 'background 0.2s' }} onMouseEnter={(e) => e.target.style.background = '#1f5780'} onMouseLeave={(e) => e.target.style.background = '#2a78a5'}>Cobrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#2a78a5',
          color: 'white',
          padding: '12px 20px',
          borderRadius: '20px',
          fontSize: '14px',
          fontWeight: '600',
          zIndex: 9999
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
