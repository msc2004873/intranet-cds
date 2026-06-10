export function generateAuditRows(cierreCaja, revisionCaja, qvetData) {
  const rows = [];
  const tiposMovimiento = ['EFECTIVO', 'TARJETA', 'SINPE', 'TRANSFERENCIA', 'SALIDAS'];

  tiposMovimiento.forEach(tipo => {
    // Obtener montos de cada nivel
    let montoCajera = 0;
    let montoRevisora = 0;
    let montoQvet = 0;

    if (tipo === 'EFECTIVO') {
      // Cajera: suma de denominaciones
      montoCajera = cierreCaja.denominaciones_sobre
        ? Object.entries(cierreCaja.denominaciones_sobre).reduce((sum, [denom, qty]) => sum + (parseInt(denom) * qty), 0)
        : 0;
      // Revisora
      montoRevisora = revisionCaja.efectivo_revisado || 0;
      // QVet
      montoQvet = qvetData.efectivo || 0;
    } else if (tipo === 'TARJETA') {
      // Cajera
      montoCajera = (cierreCaja.tarjeta_bac || 0) + (cierreCaja.tarjeta_bn || 0);
      // Revisora
      montoRevisora = (revisionCaja.tarjeta_bac_revisado || 0) + (revisionCaja.tarjeta_bn_revisado || 0);
      // QVet
      montoQvet = qvetData.tarjeta || 0;
    } else if (tipo === 'SINPE') {
      // Cajera
      const sinpeArray = parsearJSON(cierreCaja.sinpe_json) || [];
      montoCajera = sinpeArray.reduce((sum, item) => sum + (item.monto || 0), 0);
      // Revisora
      const sinpeRevisadoArray = parsearJSON(revisionCaja.sinpe_revisado_json) || [];
      montoRevisora = sinpeRevisadoArray.reduce((sum, item) => sum + (item.monto_revisado || item.monto || 0), 0);
      // QVet
      montoQvet = qvetData.sinpe || 0;
    } else if (tipo === 'TRANSFERENCIA') {
      // Cajera
      const deposArray = parsearJSON(cierreCaja.depositos_json) || [];
      montoCajera = deposArray.reduce((sum, item) => sum + (item.monto || 0), 0);
      // Revisora
      const deposRevisadoArray = parsearJSON(revisionCaja.depositos_revisados_json) || [];
      montoRevisora = deposRevisadoArray.reduce((sum, item) => sum + (item.monto_revisado || item.monto || 0), 0);
      // QVet
      montoQvet = qvetData.transferencia || 0;
    } else if (tipo === 'SALIDAS') {
      // Cajera
      const salidasArray = parsearJSON(cierreCaja.salidas_json) || [];
      montoCajera = salidasArray.reduce((sum, item) => sum + (item.monto || 0), 0);
      // Revisora
      const salidasRevisadoArray = parsearJSON(revisionCaja.salidas_revisadas_json) || [];
      montoRevisora = salidasRevisadoArray.reduce((sum, item) => sum + (item.monto_revisado || item.monto || 0), 0);
      // QVet
      montoQvet = qvetData.salidas || 0;
    }

    function parsearJSON(value) {
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch (e) {
          return [];
        }
      }
      return Array.isArray(value) ? value : [];
    }

    // Calcular diferencias y severidad
    const diferenciaRevision = montoRevisora - montoCajera;
    const diferenciaAuditoria = montoQvet - montoRevisora;

    const calcularSeveridad = (diferencia) => {
      if (Math.abs(diferencia) < 50) return 'GREEN';
      if (Math.abs(diferencia) < 500) return 'YELLOW';
      return 'RED';
    };

    const severidadRevision = calcularSeveridad(diferenciaRevision);
    const severidadAuditoria = calcularSeveridad(diferenciaAuditoria);

    rows.push({
      revision_caja_id: revisionCaja.id,
      tipo_movimiento: tipo,
      caja: cierreCaja.caja,
      monto_cajera: montoCajera,
      monto_revisora: montoRevisora,
      monto_qvet: montoQvet,
      diferencia_revision: diferenciaRevision,
      diferencia_auditoria: diferenciaAuditoria,
      severidad_revision: severidadRevision,
      severidad_auditoria: severidadAuditoria,
      comentario_revision: null,
      comentario_auditoria: null,
      archivo_url_comprobante: null,
    });
  });

  return rows;
}
