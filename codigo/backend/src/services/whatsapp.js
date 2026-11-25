// Integración con WhatsApp Cloud API (Meta). Si no hay credenciales, el envío
// se simula (queda guardado en la bitácora de mensajes), útil para la demo.
import crypto from 'node:crypto';

const GRAPH = 'https://graph.facebook.com/v21.0';

/** Verifica la firma X-Hub-Signature-256 del webhook con el App Secret. */
export function verificarFirma(cuerpoCrudo, firmaCabecera, appSecret) {
  if (!appSecret) return true; // sin secreto configurado (modo desarrollo)
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
        salida.push({ id: m.id, de: m.from, nombre: nombres[m.from] || null, texto: m.text.body, telefonoNegocio: valor.metadata?.phone_number_id });
      }
    }
  }
  return salida;
}

export function crearClienteWhatsApp({ token, phoneNumberId }) {
  const simulado = !token || !phoneNumberId;
  return {
    simulado,
    async enviarTexto(para, texto) {
      if (simulado) {
        console.log(`[whatsapp:simulado] → ${para}: ${texto.slice(0, 80)}…`);
        return { simulado: true };
      }
      const res = await fetch(`${GRAPH}/${phoneNumberId}/messages`, {
        method: 'POST',
        signal: AbortSignal.timeout(10000),
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', to: para, type: 'text', text: { body: texto.slice(0, 4000) } }),
      });
      if (!res.ok) throw new Error(`WhatsApp API respondió ${res.status}: ${await res.text()}`);
      return res.json();
    },
  };
}
