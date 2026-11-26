// Exportación a CSV (separador ";" y BOM UTF-8 para que Excel en español lo abra bien).
const escapar = (v) => {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'number' ? String(v).replace('.', ',') : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** @param {object[]} filas  @param {[clave:string, titulo:string][]} columnas */
export function aCSV(filas, columnas) {
  const cabecera = columnas.map(([, t]) => escapar(t)).join(';');
  const cuerpo = filas.map((f) => columnas.map(([k]) => escapar(f[k])).join(';'));
  return [cabecera, ...cuerpo].join('\r\n');
}

export function descargarCSV(nombre, filas, columnas) {
  const blob = new Blob(['﻿' + aCSV(filas, columnas)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: nombre });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
