// Atención de mensajes entrantes de WhatsApp (Twilio, Meta o simulador web).
// 1) Identifica al remitente por su número: usuario de la finca, trabajador, cliente o desconocido.
// 2) Atiende los comandos de consentimiento ALTA / BAJA (ADR-011).
// 3) Pasa el mensaje al agente con el perfil correspondiente (siempre con confirmación SI/NO).
import { prisma } from '../db.js';
import { config } from '../config.js';
import { crearAgente } from '../agente/agente.js';
import { interpretar } from '../agente/llm.js';
import { almacenPrisma, ejecutorPrisma } from '../agente/repositorio.js';
import { normalizar } from '../agente/guardrails.js';
import { normalizarNumeroWhatsApp } from './whatsapp.js';

export const procesarMensaje = crearAgente({
  interpretar,
  almacen: almacenPrisma,
  ejecutor: ejecutorPrisma,
  minutosConfirmacion: config.ia.minutosConfirmacion,
});

export const MENSAJE_DESCONOCIDO =
  '👋 Hola. Este número no está registrado en el CRM-Agro de la finca. ' +
  'Si eres cliente, pide a la finca que te registre; si eres trabajador, pide al encargado que agregue tu teléfono.';

/** Comando de consentimiento: "ALTA" o "BAJA" (también "acepto" / "stop"). */
export function comandoConsentimiento(texto) {
  const t = normalizar(texto).replace(/[.!]+$/, '');
  if (['alta', 'acepto', 'si acepto', 'suscribir', 'suscribirme'].includes(t)) return 'ALTA';
  if (['baja', 'stop', 'cancelar suscripcion', 'no quiero mensajes', 'darme de baja'].includes(t)) return 'BAJA';
  return null;
}

const mismoNumero = (a, b) => Boolean(a && b) && normalizarNumeroWhatsApp(a) === normalizarNumeroWhatsApp(b);

/** Busca quién escribe. Si se indica fincaId, solo dentro de esa finca (simulador). */
export async function identificarRemitente(numero, fincaId = null) {
  const de = normalizarNumeroWhatsApp(numero);
  const filtro = fincaId ? { fincaId } : {};
  const [usuarios, trabajadores, clientes] = await Promise.all([
    prisma.usuario.findMany({ where: { ...filtro, activo: true, telefono: { not: null } }, include: { finca: true } }),
    prisma.trabajador.findMany({ where: { ...filtro, activo: true, telefono: { not: null } }, include: { finca: true } }),
    prisma.cliente.findMany({ where: { ...filtro, activo: true, telefono: { not: null } }, include: { finca: true } }),
  ]);
  const usuario = usuarios.find((u) => mismoNumero(u.telefono, de)) || null;
  const trabajador =
    (usuario?.trabajadorId && trabajadores.find((t) => t.id === usuario.trabajadorId)) || trabajadores.find((t) => mismoNumero(t.telefono, de)) || null;
  const cliente = clientes.find((c) => mismoNumero(c.telefono, de)) || null;
  const finca = usuario?.finca || trabajador?.finca || cliente?.finca || null;
  let tipo = 'DESCONOCIDO';
  if (usuario) tipo = 'USUARIO';
  else if (trabajador) tipo = 'TRABAJADOR';
  else if (cliente) tipo = 'CLIENTE';
  return { de, tipo, usuario, trabajador, cliente, finca };
}

async function cambiarConsentimiento(r, acepta) {
  const data = { consentimientoWhatsapp: acepta, fechaConsentimiento: acepta ? new Date() : null };
  const cambios = [];
  if (r.usuario) cambios.push(prisma.usuario.update({ where: { id: r.usuario.id }, data }));
  if (r.trabajador) cambios.push(prisma.trabajador.update({ where: { id: r.trabajador.id }, data }));
  if (r.cliente) cambios.push(prisma.cliente.update({ where: { id: r.cliente.id }, data }));
  await Promise.all(cambios);
  return cambios.length;
}

/**
 * Atiende un mensaje entrante y devuelve la respuesta (el que llama decide cómo enviarla:
 * TwiML en Twilio, API REST en Meta, o solo bitácora en el simulador).
 */
export async function atenderMensajeEntrante({ de, texto, fincaIdForzada = null }) {
  const r = await identificarRemitente(de, fincaIdForzada);
  const fincaId = r.finca?.id ?? fincaIdForzada;
  const registrar = (direccion, t) => (fincaId ? prisma.mensajeWhatsApp.create({ data: { fincaId, telefono: r.de, direccion, texto: String(t).slice(0, 4000) } }) : null);
  await registrar('ENTRANTE', texto);

  let resultado;
  const cmd = comandoConsentimiento(texto);

  if (r.tipo === 'DESCONOCIDO') {
    resultado = { estado: 'INFO', respuesta: MENSAJE_DESCONOCIDO };
  } else if (r.finca && !r.finca.whatsappActivo) {
    resultado = { estado: 'INFO', respuesta: 'El canal de WhatsApp no está activo para esta finca.' };
  } else if (cmd) {
    const n = await cambiarConsentimiento(r, cmd === 'ALTA');
    resultado = {
      estado: 'INFO',
      respuesta:
        cmd === 'ALTA'
          ? `✅ Gracias. Registramos tu consentimiento para recibir mensajes de ${r.finca.nombre} por WhatsApp. Puedes escribir BAJA cuando quieras.`
          : '👋 Listo: ya no te enviaremos avisos automáticos. Si cambias de opinión, escribe ALTA.',
      consentimiento: cmd,
      registrosActualizados: n,
    };
  } else if (r.tipo === 'CLIENTE' && !r.cliente.consentimientoWhatsapp) {
    resultado = {
      estado: 'INFO',
      respuesta: `Hola ${r.cliente.nombre.split(' ')[0]} 👋. Para atender tus pedidos por WhatsApp necesitamos tu consentimiento. Responde *ALTA* para aceptar (puedes escribir BAJA cuando quieras).`,
    };
  } else {
    const perfil = r.tipo === 'USUARIO' ? r.usuario.rol : r.tipo === 'TRABAJADOR' ? 'TRABAJADOR' : 'CLIENTE';
    resultado = await procesarMensaje({
      fincaId,
      canal: 'WHATSAPP',
      remitente: r.de,
      texto,
      perfil,
      usuario: r.usuario ? { id: r.usuario.id, nombre: r.usuario.nombre, rol: r.usuario.rol, trabajadorId: r.usuario.trabajadorId } : null,
      trabajadorId: r.trabajador?.id ?? null,
      cliente: r.tipo === 'CLIENTE' ? { id: r.cliente.id, nombre: r.cliente.nombre } : null,
    });
  }

  await registrar('SALIENTE', resultado.respuesta);
  return { ...resultado, remitente: { tipo: r.tipo, numero: r.de, nombre: r.usuario?.nombre || r.trabajador?.nombre || r.cliente?.nombre || null }, fincaId };
}
