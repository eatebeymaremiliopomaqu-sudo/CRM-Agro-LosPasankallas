// Intérprete por reglas (modo "reglas"). Funciona sin internet ni LLM y sirve
// como respaldo cuando la API del LLM falla. Entiende español coloquial de campo.
import { normalizar } from './guardrails.js';

export const INTENCIONES = Object.freeze({
  CONFIRMAR: 'CONFIRMAR',
  CANCELAR: 'CANCELAR',
  AYUDA: 'AYUDA',
  CONSULTA: 'CONSULTA',
  REGISTRAR_LABOR: 'REGISTRAR_LABOR',
  REGISTRAR_ASISTENCIA: 'REGISTRAR_ASISTENCIA',
  REGISTRAR_OBSERVACION: 'REGISTRAR_OBSERVACION',
  REGISTRAR_COSECHA: 'REGISTRAR_COSECHA',
  DESCONOCIDA: 'DESCONOCIDA',
});

const KG_POR_QUINTAL = 46; // quintal boliviano
const KG_POR_ARROBA = 11.5;

const num = (s) => Number(String(s).replace(',', '.'));
const titulo = (s) => s.replace(/\b\p{L}/gu, (c) => c.toUpperCase());

const VERBOS_LABOR = [
  ['FUMIGACION', /\b(fumig\w*|aplique|aplicamos|aplicaron|aplico|rocie|rociamos|asperj\w*|curamos|cure)\b/],
  ['FERTILIZACION', /\b(fertilic\w*|fertiliz\w*|abone|abonamos|abonaron|abonado)\b/],
  ['RIEGO', /\b(regue|regamos|regaron|rego|riego|regando)\b/],
  ['DESHIERBE', /\b(deshierb\w*|desyerb\w*|carpi\w*|desmalez\w*)\b/],
  ['PODA', /\b(pode|podamos|podaron|poda|podando)\b/],
  ['SIEMBRA', /\b(sembr\w*|siembra|trasplant\w*)\b/],
  ['MONITOREO', /\b(monitore\w*|revise|revisamos|inspeccion\w*)\b/],
];

const PALABRAS_PLAGA = /\b(plaga|pulgon\w*|gusano\w*|mosca\w*|arana\w*|trips|oruga\w*|polilla\w*|chinche\w*|minador\w*|langosta\w*|caracol\w*|nematodo\w*)\b/;
const PALABRAS_ENFERMEDAD = /\b(hongo\w*|roya|tizon|mildiu|oidio|pudricion|virus|bacteria\w*|marchitez|mancha\w*|enferm\w*)\b/;
const PALABRAS_CLIMA = /\b(helada|granizo|sequia|lluvia\w*|viento\w*|inundaci\w*|tormenta)\b/;
const PALABRAS_SUELO = /\b(erosion|encharc\w*|compact\w*|salin\w*)\b/;

export function normalizarCodigoLote(valor) {
  if (valor === null || valor === undefined) return null;
  const s = String(valor).toUpperCase().replace(/\s+/g, '');
  const m = s.match(/(\d{1,3})$/);
  return m ? `L-${m[1].padStart(2, '0')}` : s;
}

export function extraerLote(t) {
  const m = t.match(/\b(?:lote|parcela|potrero|l|p)\s*(?:n(?:ro|o|um)?\.?|#|-|°|º)?\s*(\d{1,3})\b/);
  if (m) return `L-${m[1].padStart(2, '0')}`;
  return null;
}

export function extraerHoras(t) {
  const m = t.match(/(\d+(?:[.,]\d+)?)\s*(?:h|hr|hrs|horas?)\b/);
  return m ? num(m[1]) : null;
}

export function extraerKg(t) {
  const m = t.match(/(\d+(?:[.,]\d+)?)\s*(kg|kilos?|kilogramos?|qq|quintales?|arrobas?)\b/);
  if (!m) return null;
  const valor = num(m[1]);
  const u = m[2];
  if (u.startsWith('q')) return Math.round(valor * KG_POR_QUINTAL * 100) / 100;
  if (u.startsWith('arroba')) return Math.round(valor * KG_POR_ARROBA * 100) / 100;
  return valor;
}

export function extraerCantidadUsada(t) {
  const m = t.match(/(\d+(?:[.,]\d+)?)\s*(ml|cc|l|lt|lts|litros?|g|gr|gramos?|kg|kilos?|sacos?|bolsas?)\b/);
  if (!m) return null;
  const mapa = { ml: 'ml', cc: 'ml', l: 'L', lt: 'L', lts: 'L', g: 'g', gr: 'g' };
  const u = m[2];
  let unidad = mapa[u];
  if (!unidad) {
    if (u.startsWith('litro')) unidad = 'L';
    else if (u.startsWith('gramo')) unidad = 'g';
    else if (u.startsWith('kilo') || u === 'kg') unidad = 'kg';
    else if (u.startsWith('saco')) unidad = 'saco';
    else unidad = 'bolsa';
  }
  return { cantidad: num(m[1]), unidad };
}

export function extraerProducto(t) {
  const m = t.match(/\b(?:con|producto)\s+(?!el\b|la\b|los\b|las\b|un\b|una\b)([a-z0-9][a-z0-9\- ]{1,30}?)(?=\s*(?:,|;|\.|\d|\ben\b|\by\b|\bpara\b|\bcontra\b|$))/);
  if (!m) return null;
  const p = m[1].trim();
  if (/^(agua|mochila|bomba|tractor|ayuda)$/.test(p)) return null;
  return titulo(p);
}

export function extraerTrabajador(t) {
  let m = t.match(/\basistencia\s+(?:de\s+)?(?:don\s+|dona\s+)?([a-z]+(?:\s+(?!\d)[a-z]+)?)/);
  if (m) {
    const nombre = m[1].replace(/\s+(hoy|ayer|en|con|por|de|trabajo|vino|\d+).*$/, '');
    return titulo(nombre);
  }
  m = t.match(/(?:^|\b)(?:don\s+|dona\s+)?([a-z]+(?:\s+[a-z]+)?)\s+(?:trabajo|vino|asistio|estuvo)\b/);
  if (!m) return null;
  const nombre = m[1].replace(/^(hoy|ayer|antier)\s+/, '');
  const NO_NOMBRES = new Set(['hoy', 'ayer', 'se', 'el', 'la', 'quien', 'nadie', 'todos', 'gente', 'personal', 'no', 'que', 'cuantos', 'cuantas']);
  if (nombre.split(' ').some((w) => NO_NOMBRES.has(w))) return null;
  return titulo(nombre);
}

export function extraerFecha(t, ahora = new Date()) {
  const d = new Date(ahora);
  if (/\b(anteayer|antier)\b/.test(t)) d.setDate(d.getDate() - 2);
  else if (/\bayer\b/.test(t)) d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function extraerSeveridad(t) {
  const m = t.match(/\bseveridad\s*(\d)\b/);
  if (m) return Math.min(5, Math.max(1, Number(m[1])));
  if (/\b(muy grave|critic\w*|total)\b/.test(t)) return 5;
  if (/\b(fuerte|alta|grave|severa|mucho|bastante)\b/.test(t)) return 4;
  if (/\b(moderad\w*|media|regular)\b/.test(t)) return 3;
  if (/\b(leve|poco|baja|inicio)\b/.test(t)) return 2;
  return 2;
}

export function tipoObservacion(t) {
  if (PALABRAS_PLAGA.test(t)) return 'PLAGA';
  if (PALABRAS_ENFERMEDAD.test(t)) return 'ENFERMEDAD';
  if (PALABRAS_CLIMA.test(t)) return 'CLIMA';
  if (PALABRAS_SUELO.test(t)) return 'SUELO';
  return null;
}

function tipoLabor(t) {
  for (const [tipo, re] of VERBOS_LABOR) if (re.test(t)) return tipo;
  return null;
}

/** Devuelve { intencion, datos, faltantes } a partir de un texto libre. */
export function interpretarPorReglas(texto, ahora = new Date()) {
  const t = normalizar(texto);
  const r = (intencion, datos = {}, faltantes = []) => ({ intencion, datos, faltantes });

  if (!t) return r(INTENCIONES.AYUDA);
  if (/^(si|s|ok|okey|dale|confirmo|confirmar|correcto|de acuerdo|listo|afirmativo)[.! ]*$/.test(t)) return r(INTENCIONES.CONFIRMAR);
  if (/^(no|n|cancelar|cancela|anular|anula|olvidalo|negativo)[.! ]*$/.test(t)) return r(INTENCIONES.CANCELAR);
  if (/^(hola|ayuda|menu|help|buenas|buenos dias|buenas tardes|buenas noches|\?)\b/.test(t) && t.length < 25) return r(INTENCIONES.AYUDA);

  // Preguntas ("¿cuántos vinieron hoy?") son consultas, no registros
  if (/^(cuant[oa]s?|quien(es)?|como va|como vamos)\b/.test(t)) {
    return r(INTENCIONES.CONSULTA, { tema: /trabajador|asistencia|personal|vinieron|vino|gente/.test(t) ? 'TRABAJADORES' : 'GENERAL' });
  }

  const fecha = extraerFecha(t, ahora);
  const lote = extraerLote(t);

  // Cosecha
  if (/\b(cosech\w*|recolect\w*)\b/.test(t) && extraerKg(t) !== null) {
    const cultivo = (t.match(/(?:kg|kilos?|qq|quintales?|arrobas?)\s+de\s+([a-z]+)/) || [])[1];
    const calidad = /\bsegunda\b/.test(t) ? 'SEGUNDA' : /\bdescarte\b/.test(t) ? 'DESCARTE' : 'PRIMERA';
    const datos = { lote, cantidadKg: extraerKg(t), cultivo: cultivo ? titulo(cultivo) : null, calidad, fecha };
    return r(INTENCIONES.REGISTRAR_COSECHA, datos, lote ? [] : ['lote']);
  }

  // Asistencia
  if (/\b(asistencia|asistio|trabajo|trabajaron|vino|vinieron|estuvo)\b/.test(t)) {
    const trabajador = extraerTrabajador(t);
    const datos = { trabajador, horas: extraerHoras(t) ?? 8, lote, fecha, tarea: tipoLabor(t) };
    return r(INTENCIONES.REGISTRAR_ASISTENCIA, datos, trabajador ? [] : ['trabajador']);
  }

  // Labor de campo
  const labor = tipoLabor(t);
  if (labor) {
    const datos = { tipo: labor, lote, horas: extraerHoras(t), fecha, descripcion: String(texto).trim().slice(0, 300) };
    const faltantes = lote ? [] : ['lote'];
    if (labor === 'FUMIGACION' || labor === 'FERTILIZACION') {
      datos.producto = extraerProducto(t);
      const c = extraerCantidadUsada(t.replace(/\b\d+(?:[.,]\d+)?\s*(?:h|hr|hrs|horas?)\b/g, ''));
      if (c) Object.assign(datos, { cantidadUsada: c.cantidad, unidad: c.unidad });
      if (labor === 'FUMIGACION' && !datos.producto) faltantes.push('producto');
    }
    return r(INTENCIONES.REGISTRAR_LABOR, datos, faltantes);
  }

  // Observación fitosanitaria o de clima
  const tipoObs = tipoObservacion(t);
  if (tipoObs) {
    const datos = { tipo: tipoObs, lote, severidad: extraerSeveridad(t), nota: String(texto).trim().slice(0, 300), fecha };
    return r(INTENCIONES.REGISTRAR_OBSERVACION, datos, lote ? [] : ['lote']);
  }

  if (/\b(resumen|reporte|informe|cuantos|cuantas|estado|como va|como vamos|pendientes)\b/.test(t)) {
    return r(INTENCIONES.CONSULTA, { tema: /trabajador|asistencia|personal|vinieron|gente/.test(t) ? 'TRABAJADORES' : 'GENERAL' });
  }

  return r(INTENCIONES.DESCONOCIDA);
}
