import * as XLSX from 'xlsx';

export function parseQVetExcel(file, periodo) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target.result;
        const workbook = XLSX.read(data, { type: 'array' });
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

        console.log('Parser - Columns:', colMap);
        console.log('Parser - Period:', { inicio: periodo.inicio, fin: periodo.fin });

        rows.forEach((row, idx) => {
          const caja = row[colMap.caja]?.trim();
          const fecha = row[colMap.fecha];
          const forma = row[colMap.formaPago]?.trim();
          const monto = parseFloat(row[colMap.monto]) || 0;
          const salida = Math.abs(parseFloat(row[colMap.salidas])) || 0;

          if (!caja || !fecha) {
            console.log(`Row ${idx}: Skipped - missing caja or fecha`);
            return;
          }

          // Validar que la fecha está en el período
          const fechaObj = new Date(fecha);
          console.log(`Row ${idx}: caja=${caja}, fecha=${fecha} (${fechaObj}), forma=${forma}, monto=${monto}`);

          if (fechaObj < periodo.inicio || fechaObj > periodo.fin) {
            console.log(`Row ${idx}: Outside period range`);
            return; // Ignorar filas fuera del período
          }

          const key = `${caja}|${fecha}`;

          if (!cierres[key]) {
            cierres[key] = {
              caja,
              fecha: fecha.toString().split('T')[0], // Fecha sin hora
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

        const result = Object.values(cierres);
        resolve(result);
      } catch (err) {
        reject(new Error(`Error parsing Excel: ${err.message}`));
      }
    };

    reader.onerror = () => reject(new Error('Error reading file'));
    reader.readAsArrayBuffer(file);
  });
}
