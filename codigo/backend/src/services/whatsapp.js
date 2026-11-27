// WhatsApp como capacidad transversal (ADR-004, ADR-009).
// Proveedores: twilio | meta | simulado (WHATSAPP_PROVIDER). Sin credenciales se simula:
// el mensaje queda en la bitácora MensajeWhatsApp y se imprime en consola.
import crypto from 'node:crypto';
import { prisma } from '../db.js';
import { config } from '../config.js';
import { mensajeTareaAsignada } from '../utils/tareas.js';

/** URL base de la Graph API de Meta (versión configurable con WHATSAPP_GRAPH_VERSION; las versiones viejas se retiran). */
export const urlGraph = (version = config.whatsapp.graphVersion) => `https://graph.facebook.com/${version || 'v24.0'}`;
const TWILIO_API = 'https://api.twilio.com/2010-04-01';

// ───────────── Números ─────────────

/** "whatsapp:+591 700-00001" → "59170000001". 8 dígitos se asumen de Bolivia (591). */
export function normalizarNumeroWhatsApp(valor = '', pais = '591') {
  const digitos = String(valor).replace(/^whatsapp:/i, '').replace(/\D/g, '');
  if (!digitos) return '';
  return digitos.length === 8 ? pais + digitos : digitos;
}

/** "59170000001" → "whatsapp:+59170000001" (formato que exige Twilio). */
export const aDireccionTwilio = (numero) => `whatsapp:+${normalizarNumeroWhatsApp(numero)}`;

// ───────────── Meta Cloud API ─────────────

/**
 * Verifica la firma X-Hub-Signature-256 del webhook de Meta con el App Secret.
 * Sin secreto configurado se acepta solo si no se exige (desarrollo); en producción se exige siempre.
 */
export function verificarFirma(cuerpoCrudo, firmaCabecera, appSecret, { exigir = false } = {}) {
  if (!appSecret) return !exigir;
  if (!firmaCabecera || !firmaCabecera.startsWith('sha256=')) return false;
  const esperado = crypto.createHmac('sha256', appSecret).update(cuerpoCrudo).digest('hex');
  const recibido = firmaCabecera.slice(7);
  if (recibido.length !== esperado.length) return false;
  return crypto.timingSafeEqual(Buffer.from(recibido, 'hex'), Buffer.from(esperado, 'hex'));
}

/** Extrae los mensajes de texto entrantes del payload del webhook de Meta. */
export function extraerMensajes(body) {
  const salida = [];
  for (const entry of body?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      const valor = change?.value ?? {};
      const nombres = Object.fromEntries((valor.contacts ?? []).map((c) => [c.wa_id, c.profile?.name]));
      for (const m of valor.messages ?? []) {
        if (m.type !== 'text' || !m.text?.body) continue;
        salida.push({ id: m.id, de: normalizarNumeroWhatsApp(m.from), nombre: nombres[m.from] || null, texto: m.text.body, telefonoNegocio: valor.metadata?.phone_number_id });
      }
    }
  }
  return salida;
}

// ───────────── Twilio ─────────────

/**
 * Firma de Twilio: HMAC-SHA1 (Auth Token) de la URL completa + cada parámetro POST
 * ordenado alfabéticamente como clave+valor, en Base64.
 * https://www.twilio.com/docs/usage/webhooks/webhooks-security
 */
export function firmaTwilio(authToken, url, params = {}) {
  const datos = Object.keys(params).sort().reduce((acc, k) => acc + k + (params[k] ?? ''), url);
  return crypto.createHmac('sha1', authToken).update(Buffer.from(datos, 'utf-8')).digest('base64');
}

export function verificarFirmaTwilio(authToken, url, params, firmaCabecera) {
  if (!authToken || !firmaCabecera) return false;
  const esperado = Buffer.from(firmaTwilio(authToken, url, params));
  const recibido = Buffer.from(String(firmaCabecera));
  return esperado.length === recibido.length && crypto.timingSafeEqual(esperado, recibido);
}

/** Extrae el mensaje entrante del webhook de Twilio (application/x-www-form-urlencoded). */
export function extraerMensajeTwilio(body = {}) {
  if (!body.From || typeof body.Body !== 'string') return null;
  return { id: body.MessageSid || null, de: normalizarNumeroWhatsApp(body.From), nombre: body.ProfileName || null, texto: body.Body };
}

const escaparXml = (t) => String(t).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]);

/** Respuesta TwiML: Twilio envía el texto como respuesta al mismo chat. */
export function twiml(texto) {
  if (!texto) return '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escaparXml(String(texto).slice(0, 1600))}</Message></Response>`;
}

// ───────────── Proveedores de envío ─────────────

/** Crea el proveedor de envío según la configuración. Siempre devuelve { nombre, simulado, enviarTexto }. */
export function crearProveedor(cfg = config.whatsapp, fetchFn = globalThis.fetch) {
  const simulado = (motivo) => ({
    nombre: 'simulado',
    simulado: true,
    motivo,
    async enviarTexto(para, texto) {
      if (process.env.NODE_ENV !== 'test') console.log(`[whatsapp:simulado] → ${para}: ${String(texto).slice(0, 90).replace(/\n/g, ' ')}…`);
      return { simulado: true };
    },
  });

  if (cfg.proveedor === 'twilio') {
    if (!cfg.twilioAccountSid || !cfg.twilioAuthToken) return simulado('Faltan TWILIO_ACCOUNT_SID o TWILIO_AUTH_TOKEN');
    return {
      nombre: 'twilio',
      simulado: false,
      async enviarTexto(para, texto) {
        const res = await fetchFn(`${TWILIO_API}/Accounts/${cfg.twilioAccountSid}/Messages.json`, {
          method: 'POST',
          signal: AbortSignal.timeout(10000),
          headers: {
            authorization: `Basic ${Buffer.from(`${cfg.twilioAccountSid}:${cfg.twilioAuthToken}`).toString('base64')}`,
            'content-type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({ From: cfg.twilioFrom, To: aDireccionTwilio(para), Body: String(texto).slice(0, 1600) }),
        });
        if (!res.ok) throw new Error(`Twilio respondió ${res.status}: ${(await res.text()).slice(0, 200)}`);
        return res.json();
      },
    };
  }

  if (cfg.proveedor === 'meta') {
    if (!cfg.token || !cfg.phoneNumberId) return simulado('Faltan WHATSAPP_TOKEN o WHATSAPP_PHONE_NUMBER_ID');
    return {
      nombre: 'meta',
      simulado: false,
      async enviarTexto(para, texto) {
        const res = await fetchFn(`${urlGraph(cfg.graphVersion)}/${cfg.phoneNumberId}/messages`, {
          method: 'POST',
          signal: AbortSignal.timeout(10000),
          headers: { authorization: `Bearer ${cfg.token}`, 'content-type': 'application/json' },
          body: JSON.stringify({ messaging_product: 'whatsapp', to: normalizarNumeroWhatsApp(para), type: 'text', text: { body: String(texto).slice(0, 4000) } }),
        });
        if (!res.ok) throw new Error(`Meta respondió ${res.status}: ${(await res.text()).slice(0, 200)}`);
        return res.json();
      },
    };
  }

  return simulado('WHATSAPP_PROVIDER=simulado');
}

let _proveedor;
export function proveedorWhatsApp() {
  if (!_proveedor) _proveedor = crearProveedor();
  return _proveedor;
}
/** Solo para pruebas: reemplaza el proveedor global. */
export function usarProveedor(p) {
  _proveedor = p;
}

/** Compatibilidad con el código anterior (Meta). */
export function crearClienteWhatsApp({ token, phoneNumberId }) {
  return crearProveedor({ proveedor: 'meta', token, phoneNumberId });
}

/**
 * Envía un mensaje saliente y lo registra en la bitácora.
 * Nunca lanza: devuelve { enviado, simulado, error? }.
 */
export async function enviarWhatsApp({ fincaId, telefono, texto }) {
  const para = normalizarNumeroWhatsApp(telefono);
  if (!para) return { enviado: false, error: 'SIN_TELEFONO' };
  const p = proveedorWhatsApp();
  await prisma.mensajeWhatsApp.create({ data: { fincaId, telefono: para, direccion: 'SALIENTE', texto: String(texto).slice(0, 4000) } });
  try {
    await p.enviarTexto(para, texto);
    return { enviado: true, simulado: p.simulado, proveedor: p.nombre };
  } catch (e) {
    console.error('[whatsapp] envío fallido:', e.message);
    return { enviado: false, simulado: p.simulado, proveedor: p.nombre, error: e.message };
  }
}

/** Aviso de tarea asignada: solo con consentimiento y teléfono (ADR-011). */
export async function notificarTareaAsignada(fincaId, trabajador, tarea) {
  if (!trabajador?.consentimientoWhatsapp) return { enviado: false, razon: 'SIN_CONSENTIMIENTO' };
  if (!trabajador.telefono) return { enviado: false, razon: 'SIN_TELEFONO' };
  return enviarWhatsApp({ fincaId, telefono: trabajador.telefono, texto: mensajeTareaAsignada(tarea) });
}
