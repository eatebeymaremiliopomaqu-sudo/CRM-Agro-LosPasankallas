import crypto from 'node:crypto';

/** Iniciales de la finca para prefijar códigos: "Finca San Rafael" -> "FSR". */
export function inicialesFinca(nombre = '') {
  const palabras = nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  const ini = palabras.map((p) => p[0].toUpperCase()).join('').slice(0, 4);
  return ini || 'LOT';
}

/** Código legible del lote: FSR-2026-0007 */
export function codigoLote(nombreFinca, anio, correlativo) {
  if (!Number.isInteger(correlativo) || correlativo < 1) throw new Error('Correlativo inválido');
  return `${inicialesFinca(nombreFinca)}-${anio}-${String(correlativo).padStart(4, '0')}`;
}

/** Token público no adivinable para la URL del QR (no expone ids internos). */
export function tokenPublico(bytes = 12) {
  return crypto.randomBytes(bytes).toString('base64url');
}

/** Normaliza un teléfono a dígitos con código de país (Bolivia 591 por defecto). */
export function normalizarTelefono(tel = '', pais = '591') {
  const digitos = String(tel).replace(/\D/g, '');
  if (!digitos) return '';
  if (digitos.length === 8) return pais + digitos;
  return digitos;
}
