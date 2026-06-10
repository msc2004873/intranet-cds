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

    // Helper to parse fecha robustly (handles Excel serials, strings, Date objects)
    const parseFecha = (valor) => {
      // If already a Date, return it
      if (valor instanceof Date) return valor;

      // If it's a number (Excel serial)
      if (typeof valor === 'number') {
        return excelSerialToDate(valor);
      }

      // If it's a string, try to parse it
      if (typeof valor === 'string') {
        // Try DD/MM/YY format first (European: 1/6/26 or 1/6/26 18:41 with optional time)
        // CRITICAL BUG FIX: Regex must NOT require $ end-of-string (allows optional time)
        const match = valor.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
        if (match) {
          let [, day, month, year] = match.map(Number);
          if (year < 100) year += 2000; // 26 → 2026
          // Assume DD/MM/YY (European format)
          // Set time to 00:00:00 to avoid timezone issues
          return new Date(year, month - 1, day, 0, 0, 0);
        }

        // Fallback: try standard parsing (should not reach here for well-formatted dates)
        return new Date(valor);
      }

      return null;
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
          const forma = row[colMap.formaPago]?.trim?.().toUpperCase?.() || '';
          const monto = parseFloat(row[colMap.monto]) || 0;
          const salida = Math.abs(parseFloat(row[colMap.salidas])) || 0;

          if (!caja || !fecha) {
            console.log(`Row ${idx}: Skipped - missing caja or fecha`);
            return;
          }

          // Parse fecha using robust helper
          const fechaObj = parseFecha(fecha);

          if (!fechaObj || isNaN(fechaObj.getTime())) {
            console.error(`❌ Row ${idx}: Failed to parse fecha="${fecha}"`);
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

          // CRITICAL: Group by CR date, not UTC date
          // Convert UTC to CR (UTC-6) to group correctly
          const fechaCR = new Date(fechaObj.getTime() - 6 * 60 * 60 * 1000);
          const fechaKey = fechaCR.toISOString().split('T')[0]; // YYYY-MM-DD in CR
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

        console.error('📦 FINAL GROUPED CIERRES:');
        result.forEach(c => {
          console.error(`  ${c.caja} | ${c.fecha}: EFECTIVO=${c.efectivo}, TARJETA=${c.tarjeta}, SINPE=${c.sinpe}, TRANS=${c.transferencia}, SALIDAS=${c.salidas}`);
        });
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
