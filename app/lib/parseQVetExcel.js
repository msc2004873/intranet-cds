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
      if (valor instanceof Date) {
        console.error(`📅 parseFecha received Date: ${valor.toISOString()}`);
        return valor;
      }

      // If it's a number (Excel serial)
      if (typeof valor === 'number') {
        const result = excelSerialToDate(valor);
        console.error(`📅 parseFecha received NUMBER ${valor} → ${result.toISOString()}`);
        return result;
      }

      // If it's a string, try to parse it
      if (typeof valor === 'string') {
        console.error(`📅 parseFecha received STRING: "${valor}"`);
        // Try DD/MM/YY format first (European: 1/6/26 or 1/6/26 18:41 with optional time)
        const match = valor.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
        if (match) {
          let [, day, month, year] = match.map(Number);
          console.error(`   Regex matched: day=${day}, month=${month}, year=${year}`);
          if (year < 100) year += 2000; // 26 → 2026
          // Assume DD/MM/YY (European format)
          const result = new Date(year, month - 1, day, 0, 0, 0);
          console.error(`   Result: ${result.toISOString().split('T')[0]}`);
          return result;
        }

        // Fallback: try standard parsing
        console.error(`   No regex match, using new Date()`);
        return new Date(valor);
      }

      console.error(`📅 parseFecha received UNKNOWN type`);
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

          const periodoStart = periodo.inicio.toISOString().split('T')[0];
          const periodoEnd = periodo.fin.toISOString().split('T')[0];

          // Compute CR date FIRST, then filter by it.
          // XLSX with cellDates:true returns Excel serials as UTC, treating the stored
          // CR local time value as UTC. So "18:54 CR" comes in as hour=18 UTC (not 0).
          // For pure date cells (midnight, hour=0), +18h stays on the same day.
          // For all other times (>=6), subtract 6h to get CR date.
          const hour = fechaObj.getUTCHours();
          let fechaKey;
          if (hour < 6) {
            // Pure date cell (midnight UTC) or very early CR time stored as UTC.
            // +18h keeps us on the correct same day without crossing into previous day.
            const fechaCR = new Date(fechaObj.getTime() + 18 * 60 * 60 * 1000);
            fechaKey = fechaCR.toISOString().split('T')[0];
          } else {
            // Date+time cell: XLSX stored CR local time as UTC value.
            // Subtract 6h gives the correct CR date (e.g., 18:54 UTC → 12:54 UTC → same date).
            const fechaCR = new Date(fechaObj.getTime() - 6 * 60 * 60 * 1000);
            fechaKey = fechaCR.toISOString().split('T')[0];
          }

          console.error(`📍 Row ${idx}: ${caja} | CR:${fechaKey} | ${forma} | ₡${monto}`);

          // Filter by CR date (not raw UTC) — avoids excluding end-of-day entries that
          // cross midnight UTC (e.g., 18:54 CR on last day of period = next UTC day).
          if (fechaKey < periodoStart || fechaKey > periodoEnd) {
            console.log(`Row ${idx}: Outside period [${periodoStart} - ${periodoEnd}] (CR date: ${fechaKey})`);
            return;
          }

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
