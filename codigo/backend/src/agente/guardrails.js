// Límites del agente de IA.
// Regla de negocio no negociable: el agente REGISTRA lo que el usuario ya hizo,
// pero NUNCA recomienda productos, dosis ni mezclas de agroquímicos.

export const MAX_LARGO_MENSAJE = 800;

export const MENSAJE_SIN_DOSIS =
  '⚠️ No puedo recomendar productos, dosis ni mezclas de agroquímicos. ' +
  'Esa decisión corresponde al ingeniero agrónomo responsable y a la etiqueta del producto registrado ante SENASAG. ' +
  'Sí puedo *registrar* una aplicación que ya se realizó, por ejemplo: "fumigué la parcela P-02 con Producto X, 2 litros".';

const normalizar = (t) =>
  String(t || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[¿¡]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const AGROQUIMICO =
  '(agroquimic|quimic|veneno|fungicid|insecticid|herbicid|plaguicid|pesticid|acaricid|nematicid|fertiliz|abono|urea|foliar|producto|glifosato|mancozeb|cipermetrin|clorpirifos|imidacloprid|abamectin|paraquat|2,4-d|dosis|mezcla)';

// Patrones de PEDIDO de recomendación (consejo), no de registro de algo ya hecho.
const PATRONES_PEDIDO = [
  /\b(que|cual|cuanta|cuanto|cuantos|cuantas)\s+dosis\b/,
  /\bdosis\s+(recomendad|ideal|correct|adecuad|optim|exact)/,
  /\b(recomienda|recomiendas|recomiendame|recomendarias|recomendacion|aconsejas|aconsejame|sugieres|sugiereme)\b/,
  /\b(cuanto|cuanta|cuantos|cuantas)\s+(\w+\s+){0,3}(debo|tengo que|hay que|deberia|necesito|le)\s+(echar|poner|aplicar|usar|mezclar|fumigar|rociar|echo|pongo|aplico|uso|mezclo|fumigo)/,
  /\b(cuanto|cuanta|cuantos|cuantas)\s+(ml|cc|litros?|gramos?|kilos?|kg|g|l)\b.*\b(por|en|de)\b/,
  /\b(que|cual|con que)\s+(producto|veneno|quimico|fungicida|insecticida|herbicida|abono|fertilizante)\s+(uso|aplico|echo|pongo|le echo|le pongo|sirve|es mejor|me conviene)/,
  /\bcon que\s+(fumigo|curo|mato|controlo|combato|aplico)\b/,
  /\bque\s+(le\s+)?(echo|pongo|aplico)\s+(para|contra|a)\b/,
  /\b(puedo|se puede|conviene)\s+mezclar\b/,
  /\b(como|cada cuanto)\s+(aplico|fumigo|uso|echo)\b/,
  /\bpara\s+(matar|controlar|combatir|curar|eliminar)\s+(\w+\s+){0,3}(que|cuanto|con que)\b/,
];

/**
 * Devuelve true si el mensaje pide una recomendación de producto/dosis/mezcla.
 * Se combina "intención de consejo" + "tema agroquímico" o patrones inequívocos.
 */
export function pideRecomendacionDosis(texto) {
  const t = normalizar(texto);
  if (!t) return false;
  const temaQuimico = new RegExp(AGROQUIMICO).test(t) || /\b(plaga|pulgon|gusano|hongo|roya|tizon|mosca|arana|trips|maleza|oruga|mildiu|polilla)\b/.test(t);
  const inequivoco = /\b(que|cual|cuanta|cuanto)\s+dosis\b|\bdosis\s+(recomendad|ideal|correct|adecuad)|\bpuedo mezclar\b|\bcon que\s+(fumigo|curo|mato)\b/.test(t);
  if (inequivoco) return true;
  if (!temaQuimico) return false;
  return PATRONES_PEDIDO.some((p) => p.test(t));
}

// Detecta en la SALIDA del LLM cifras de dosificación (p. ej. "200 ml por mochila", "2 L/ha").
const PATRON_DOSIS_SALIDA =
  /\d+([.,]\d+)?\s*(ml|cc|l|lt|lts|litros?|g|gr|gramos?|kg|kilos?)\s*(\/|por|x|cada)\s*(ha|hectarea|hectareas|mochila|bomba|tanque|litro|l|20\s*l|cilindro|planta|m2)\b/;

export function salidaContieneDosis(texto) {
  return PATRON_DOSIS_SALIDA.test(normalizar(texto));
}

/** Filtra la respuesta libre del LLM: si trae dosificaciones, se reemplaza por el mensaje seguro. */
export function filtrarSalida(texto) {
  if (!texto) return '';
  if (salidaContieneDosis(texto)) return MENSAJE_SIN_DOSIS;
  return String(texto).slice(0, 1200);
}

/** Limpia la entrada: quita caracteres de control y recorta el largo. */
export function sanitizarEntrada(texto) {
  return String(texto ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, MAX_LARGO_MENSAJE);
}

/** Intentos básicos de manipular al agente (prompt injection). */
export function pareceInyeccion(texto) {
  const t = normalizar(texto);
  return /(ignora|olvida|omite)\s+(todas\s+)?(las\s+)?(instrucciones|reglas|indicaciones)|system prompt|modo desarrollador|actua como|jailbreak|sin restricciones/.test(t);
}

export { normalizar };
