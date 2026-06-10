import * as XLSX from 'xlsx';

export function parseQVetExcel(file, periodo) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    // Helper to convert Excel serial numbers to Date
    const excelSerialToDate = (serial) => {
      // Excel date serial: day 1 = Jan 1, 1900
      // JavaScript epoch: Jan 1, 1970
      // Days between: 25569
      if (typeof serial !== 'number') return null;
      return new Date((serial - 25569) * 86400 * 1000);
    };

    reader.onload = (e) => {
      try {
        const data = e.target.result;
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet);

        // Detectar headers automáticamente
        const headers = Object.keys(rows[0] || {});
        const colMap = {
          caja: headers.find(h => h.toLowerCase().includes('caja')),
          formaPago: headers.find(h => h.toLowerCase().includes('forma') || h.toLowerCase().includes('pago')),
          fecha: headers.find(h => h.toLowerCase().includes('fecha')),
          monto: headers.find(h => h.toLowerCase().includes('venta') || h.toLowerCase().includes('monto')),
          salidas: headers.find(h => h.toLowerCase().includes('salida') || h.toLowerCase().includes('saldo')),
        };

        // Validar que encontramos las columnas clave
        if (!colMap.caja || !colMap.fecha || !colMap.monto) {
          reject(new Error('Excel format not recognized. Missing required columns: caja, fecha, or monto'));
          return;
        }

        // Filtrar por período (ignorar filas fuera del rango sin error)
        const formasPago = ['EFECTIVO', 'TARJETA', 'SINPE MOVIL', 'TRANSFERENCIA', 'OTRO'];
        const cierres = {};

        console.log('🔍 PARSER - Total rows in Excel:', rows.length);
        console.log('🔍 PARSER - Columns:', colMap);
        console.log('🔍 PARSER - Period:', { inicio: periodo.inicio, fin: periodo.fin });

        rows.forEach((row, idx) => {
          const caja = row[colMap.caja]?.trim();
          let fecha = row[colMap.fecha];
          const forma = row[colMap.formaPago]?.trim();
          const monto = parseFloat(row[colMap.monto]) || 0;
          const salida = Math.abs(parseFloat(row[colMap.salidas])) || 0;

          if (!caja || !fecha) {
            console.log(`Row ${idx}: Skipped - missing caja or fecha`);
            return;
          }

          // Convertir fecha si es un número serial de Excel
          let fechaObj;
          if (typeof fecha === 'number') {
            fechaObj = excelSerialToDate(fecha);
          } else if (typeof fecha === 'string') {
            fechaObj = new Date(fecha);
          } else if (fecha instanceof Date) {
            fechaObj = fecha;
          } else {
            console.log(`Row ${idx}: Unknown date format:`, fecha);
            return;
          }

          if (!fechaObj || isNaN(fechaObj.getTime())) {
            console.log(`Row ${idx}: Invalid date after conversion`);
            return;
          }

          const fechaStr = fechaObj.toISOString().split('T')[0]; // YYYY-MM-DD
          const periodoStart = periodo.inicio.toISOString().split('T')[0];
          const periodoEnd = periodo.fin.toISOString().split('T')[0];

          console.error(`📍 Row ${idx}: ${caja} | ${fechaStr} | ${forma} | ₡${monto}`);

          // Compare dates as strings (YYYY-MM-DD) to include FULL day (including end of day 5)
          if (fechaStr < periodoStart || fechaStr > periodoEnd) {
            console.log(`Row ${idx}: Outside period [${periodoStart} - ${periodoEnd}]`);
            return;
          }

          // Use parsed date for key to avoid grouping issues
          const fechaKey = fechaObj.toISOString().split('T')[0]; // YYYY-MM-DD
          const key = `${caja}|${fechaKey}`;

          if (!cierres[key]) {
            cierres[key] = {
              caja,
              fecha: fechaKey, // Fecha sin hora
              efectivo: 0,
              tarjeta: 0,
              sinpe: 0,
              transferencia: 0,
              otro: 0,
              salidas: 0,
            };
          }

          // Sumar por forma de pago
          if (forma === 'EFECTIVO') cierres[key].efectivo += monto;
          else if (forma === 'TARJETA') cierres[key].tarjeta += monto;
          else if (forma === 'SINPE MOVIL') cierres[key].sinpe += monto;
          else if (forma === 'TRANSFERENCIA') cierres[key].transferencia += monto;
          else if (forma === 'OTRO') cierres[key].otro += monto;

          // Salidas (tomar primer valor, es igual en todas las filas)
          if (salida > 0) cierres[key].salidas = salida;
        });

        const result = Object.values(cierres).map(cierre => ({
          ...cierre,
          fecha: typeof cierre.fecha === 'string' ? cierre.fecha : new Date(cierre.fecha).toISOString().split('T')[0],
          caja: normalizarCaja(cierre.caja)
        }));

        console.log('Final parsed cierres:', result.map(c => ({ caja: c.caja, fecha: c.fecha })));
        resolve(result);

      function normalizarCaja(caja) {
        if (!caja) return caja;
        const lower = caja.toLowerCase().trim();
        if (lower.includes('clínica') || lower.includes('clinica')) return 'Caja 1 (clínica)';
        if (lower.includes('caja 2')) return 'Caja 2';
        return caja;
      }
      } catch (err) {
        reject(new Error(`Error parsing Excel: ${err.message}`));
      }
    };

    reader.onerror = () => reject(new Error('Error reading file'));
    reader.readAsArrayBuffer(file);
  });
}
