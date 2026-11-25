import { INTENCIONES } from './parser.js';

// Campos permitidos por intención: cualquier otro dato que devuelva el LLM se descarta.
const CAMPOS = {
  REGISTRAR_LABOR: ['tipo', 'parcela', 'horas', 'fecha', 'descripcion', 'producto', 'cantidadUsada', 'unidad'],
  REGISTRAR_ASISTENCIA: ['trabajador', 'horas', 'parcela', 'fecha', 'tarea'],
  REGISTRAR_OBSERVACION: ['tipo', 'parcela', 'severidad', 'nota', 'fecha'],
  REGISTRAR_COSECHA: ['parcela', 'cantidadKg', 'cultivo', 'calidad', 'fecha'],
  CONSULTA: ['tema'],
};

const esPrimitivo = (v) => v === null || ['string', 'number', 'boolean'].includes(typeof v);

/** Valida la forma del JSON del LLM. Si no es confiable, devuelve null (se usa el intérprete por reglas). */
export function validarRespuestaLLM(crudo) {
  if (typeof crudo !== 'string') return null;
  const inicio = crudo.indexOf('{');
  const fin = crudo.lastIndexOf('}');
  if (inicio < 0 || fin < inicio) return null;
  let obj;
  try {
    obj = JSON.parse(crudo.slice(inicio, fin + 1));
  } catch {
    return null;
  }
  if (!obj || !Object.values(INTENCIONES).includes(obj.intencion)) return null;
  const permitidos = CAMPOS[obj.intencion] || [];
  const datos = {};
  if (obj.datos && typeof obj.datos === 'object') {
    for (const k of permitidos) {
      const v = obj.datos[k];
      if (v !== undefined && esPrimitivo(v)) datos[k] = typeof v === 'string' ? v.slice(0, 300) : v;
    }
  }
  // Si falta un dato obligatorio, lo agregamos a faltantes aunque el LLM no lo haya hecho
  const faltantes = Array.isArray(obj.faltantes) ? obj.faltantes.map(String).slice(0, 5) : [];
  const obligatorios = {
    REGISTRAR_LABOR: ['parcela', 'tipo'],
    REGISTRAR_ASISTENCIA: ['trabajador'],
    REGISTRAR_OBSERVACION: ['parcela'],
    REGISTRAR_COSECHA: ['parcela', 'cantidadKg'],
  }[obj.intencion] || [];
  for (const o of obligatorios) if ((datos[o] === undefined || datos[o] === null || datos[o] === '') && !faltantes.includes(o)) faltantes.push(o);
  if (obj.intencion === 'REGISTRAR_ASISTENCIA' && datos.horas == null) datos.horas = 8;
  return { intencion: obj.intencion, datos, faltantes };
}
