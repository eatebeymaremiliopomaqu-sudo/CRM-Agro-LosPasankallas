// Límites del agente de IA.
// Regla de negocio no negociable: el agente REGISTRA lo que el usuario ya hizo,
// pero NUNCA recomienda productos, dosis ni mezclas de agroquímicos.

export const MAX_LARGO_MENSAJE = 800;

export const MENSAJE_SIN_DOSIS =
  '⚠️ No puedo recomendar productos, dosis ni mezclas de agroquímicos. ' +
  'Esa decisión corresponde al ingeniero agrónomo responsable y a la etiqueta del producto registrado ante SENASAG. ' +
  'Sí puedo *registrar* una aplicación que ya se realizó, por ejemplo: "fumigué el lote L-02 con Producto X, 2 litros". También puedo mostrarte lo que ya se registró: "¿qué se aplicó en el lote 2?".';

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

export const MENSAJE_AGRONOMO =
  '🌿 Esa es una pregunta agronómica: no reemplazo al ingeniero agrónomo. ' +
  'Te sugiero consultarlo con el agrónomo responsable de la finca. ' +
  'Mientras tanto puedo registrar una observación, por ejemplo: "hay manchas en las hojas del lote 3, severidad 3".';

// Consultar lo que YA se registró (pasado/registro), p. ej. "¿qué dosis se aplicó en el lote 5?".
const PASADO_REGISTRO = /\b(se aplico|se aplicaron|aplicaron|se uso|se usaron|usaron|se le (aplico|puso|echo)|hemos aplicado|fue aplicad\w*|registrad[oa]s?|de etiqueta|que se aplico)\b/;
const PIDE_CONSEJO = /\b(debo|deberia|debemos|tengo que|tenemos que|hay que|recomiend\w*|aconsej\w*|suger\w*|conviene|puedo|podemos|mejor|necesito|le echo|le pongo|echo|pongo)\b/;

/** true si el mensaje pregunta por lo registrado en el sistema (no pide un consejo). */
export function esConsultaDeRegistro(texto) {
  const t = normalizar(texto);
  return PASADO_REGISTRO.test(t) && !PIDE_CONSEJO.test(t);
}

/** Preguntas de diagnóstico o manejo agronómico que corresponden al ingeniero agrónomo. */
export function esPreguntaAgronomica(texto) {
  const t = normalizar(texto);
  return (
    /\bpor que\s+(se\s+)?(amarill\w*|sec\w*|marchit\w*|pudr\w*|caen|cae|manch\w*|enferm\w*|muer\w*)/.test(t) ||
    /\bque\s+(enfermedad|plaga|hongo|virus)\s+(es|sera|tiene|tienen)\b/.test(t) ||
    /\bcomo\s+(curo|controlo|trato|combato|elimino|evito|prevengo)\b/.test(t) ||
    /\bque\s+hago\s+(con|para|si|contra)\b/.test(t)
  );
}

/**
 * Devuelve true si el mensaje pide una recomendación de producto/dosis/mezcla.
 * Se combina "intención de consejo" + "tema agroquímico" o patrones inequívocos.
 */
export function pideRecomendacionDosis(texto) {
  const t = normalizar(texto);
  if (!t) return false;
  if (esConsultaDeRegistro(t)) return false; // solo pide ver lo registrado
  const temaQuimico = new RegExp(AGROQUIMICO).test(t) || /\b(plaga|pulgon|gusano|hongo|roya|tizon|mosca|arana|trips|maleza|oruga|mildiu|polilla)\b/.test(t);
  const inequivoco =
    /\b(que|cual|cuanta|cuanto)\s+dosis\b|\bdosis\s+(recomendad|ideal|correct|adecuad)|\bpuedo mezclar\b|\bcon que\s+(fumigo|curo|mato)\b/.test(t) ||
    // "¿cuánto <cualquier producto> le echo/pongo/aplico (a la mochila)?" aunque el nombre comercial no sea conocido
    /\b(cuanto|cuanta|cuantos|cuantas)\b.*\b(le echo|le pongo|le aplico|le mezclo|echo|pongo|mezclo)\b/.test(t) ||
    /\b(cuanto|cuanta|cuantos|cuantas)\b.*\b(por|a la|en la|para la)\s+(mochila|bomba|fumigadora|aspersora|cilindro|tanque|hectarea)\b/.test(t);
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
