export const fecha = (f, opciones = { day: '2-digit', month: 'short', year: 'numeric' }) => {
  if (!f) return '—';
  const d = new Date(f);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-BO', { timeZone: 'UTC', ...opciones });
};
export const fechaHora = (f) => (f ? new Date(f).toLocaleString('es-BO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
export const numero = (n, dec = 0) => (n === null || n === undefined || Number.isNaN(Number(n)) ? '—' : Number(n).toLocaleString('es-BO', { minimumFractionDigits: dec, maximumFractionDigits: dec }));
export const bs = (n) => `Bs ${numero(n, 2)}`;
export const hoyISO = () => new Date().toISOString().slice(0, 10);
export const haceDiasISO = (d) => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);

export const ETIQUETAS_LABOR = {
  SIEMBRA: 'Siembra', RIEGO: 'Riego', FERTILIZACION: 'Fertilización', FUMIGACION: 'Fumigación',
  DESHIERBE: 'Deshierbe', PODA: 'Poda', COSECHA: 'Cosecha', MONITOREO: 'Monitoreo', OTRA: 'Otra',
};
export const COLORES_LABOR = {
  SIEMBRA: '#8BC34A', RIEGO: '#2E6F95', FERTILIZACION: '#C8823A', FUMIGACION: '#B5523B',
  DESHIERBE: '#6B8F3A', PODA: '#7D6B9E', COSECHA: '#D4A017', MONITOREO: '#4B8B8B', OTRA: '#9A958A',
};
export const ETIQUETAS_OBS = { PLAGA: 'Plaga', ENFERMEDAD: 'Enfermedad', CLIMA: 'Clima', SUELO: 'Suelo', OTRO: 'Otro' };
export const ETIQUETAS_EVENTO = { COSECHA: 'Cosecha', ACOPIO: 'Acopio', LAVADO: 'Lavado', EMPAQUE: 'Empaque', DESPACHO: 'Despacho', VENTA: 'Venta' };

export const claseSeveridad = (s) => (s >= 4 ? 'rojo' : s === 3 ? 'ambar' : 'gris');
export const iniciales = (nombre = '') => nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
