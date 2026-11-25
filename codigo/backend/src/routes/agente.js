// M5 · Agente de IA (canal web) y webhook de WhatsApp
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../db.js';
import { config } from '../config.js';
import { autorizar } from '../middleware/auth.js';
import { validar } from '../middleware/validar.js';
import { asyncH } from '../utils/errores.js';
import { crearAgente } from '../agente/agente.js';
import { interpretar } from '../agente/llm.js';
import { almacenPrisma, ejecutorPrisma } from '../agente/repositorio.js';
import { crearClienteWhatsApp, extraerMensajes, verificarFirma } from '../services/whatsapp.js';
import { normalizarTelefono } from '../utils/codigos.js';
import { tieneModulo } from '../utils/permisos.js';

export const procesarMensaje = crearAgente({
  interpretar,
  almacen: almacenPrisma,
  ejecutor: ejecutorPrisma,
  minutosConfirmacion: config.ia.minutosConfirmacion,
});

const wa = crearClienteWhatsApp(config.whatsapp);
const limiteAgente = rateLimit({ windowMs: 60 * 1000, max: 30, message: { error: 'Demasiados mensajes, espere un minuto.' } });

// ── Canal web (chat dentro del CRM) ──
export const agenteRouter = Router();

agenteRouter.post('/mensaje', limiteAgente, autorizar('agente:usar'), validar(z.object({ texto: z.string().min(1).max(800) })), asyncH(async (req, res) => {
  const usuario = await prisma.usuario.findUnique({ where: { id: req.usuario.id }, select: { id: true, nombre: true, rol: true } });
  const r = await procesarMensaje({ fincaId: req.usuario.fincaId, canal: 'WEB', remitente: `usuario:${usuario.id}`, texto: req.body.texto, usuario });
  res.json(r);
}));

agenteRouter.get('/acciones', autorizar('agente:usar'), asyncH(async (req, res) => {
  res.json(await prisma.accionPendiente.findMany({ where: { fincaId: req.usuario.fincaId }, orderBy: { creadoEn: 'desc' }, take: 50 }));
}));

agenteRouter.get('/whatsapp/mensajes', autorizar('agente:usar'), asyncH(async (req, res) => {
  res.json({
    modo: wa.simulado ? 'SIMULADO' : 'CLOUD_API',
    mensajes: await prisma.mensajeWhatsApp.findMany({ where: { fincaId: req.usuario.fincaId }, orderBy: { fecha: 'desc' }, take: 100 }),
  });
}));

/**
 * Simulador de WhatsApp para la demo: procesa el texto como si llegara por WhatsApp
 * desde el teléfono indicado (que debe pertenecer a un usuario de la finca).
 */
agenteRouter.post('/whatsapp/simular', limiteAgente, autorizar('agente:usar'), validar(z.object({ telefono: z.string().min(8).max(20), texto: z.string().min(1).max(800) })), asyncH(async (req, res) => {
  const r = await atenderWhatsApp({ de: normalizarTelefono(req.body.telefono), texto: req.body.texto, fincaIdForzada: req.usuario.fincaId });
  res.json(r);
}));

// ── Webhook público de WhatsApp Cloud API ──
export const webhookRouter = Router();

// Verificación inicial (Meta hace GET con hub.challenge)
webhookRouter.get('/', (req, res) => {
  if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === config.whatsapp.verifyToken) {
    return res.status(200).send(req.query['hub.challenge']);
  }
  res.sendStatus(403);
});

webhookRouter.post('/', asyncH(async (req, res) => {
  if (!verificarFirma(req.rawBody || Buffer.from(''), req.get('x-hub-signature-256'), config.whatsapp.appSecret)) {
    return res.sendStatus(401);
  }
  // Meta espera 200 rápido; procesamos y respondemos sin bloquear reintentos.
  res.sendStatus(200);
  for (const m of extraerMensajes(req.body)) {
    try {
      await atenderWhatsApp({ de: m.de, texto: m.texto });
    } catch (e) {
      console.error('[whatsapp] error procesando mensaje', e.message);
    }
  }
}));

/** Identifica al remitente por su teléfono, procesa con el agente y responde. */
async function atenderWhatsApp({ de, texto, fincaIdForzada = null }) {
  const usuarios = await prisma.usuario.findMany({ where: { activo: true, telefono: { not: null } }, include: { finca: true } });
  const usuario = usuarios.find((u) => normalizarTelefono(u.telefono) === de && (!fincaIdForzada || u.fincaId === fincaIdForzada));

  let respuesta;
  let fincaId = usuario?.fincaId ?? fincaIdForzada;
  if (!usuario) {
    respuesta = 'Este número no está registrado en el CRM-Agro. Pide al administrador de la finca que agregue tu teléfono a tu usuario.';
  } else if (!tieneModulo(usuario.finca, 'M5')) {
    respuesta = 'El módulo de WhatsApp no está activo para esta finca.';
  } else if (usuario.rol === 'CONSULTA') {
    respuesta = 'Tu usuario es de sólo consulta: no puede registrar datos por WhatsApp.';
  }

  if (fincaId) await prisma.mensajeWhatsApp.create({ data: { fincaId, telefono: de, direccion: 'ENTRANTE', texto: texto.slice(0, 1000) } });

  let resultado = { estado: 'INFO', respuesta };
  if (!respuesta) {
    resultado = await procesarMensaje({ fincaId, canal: 'WHATSAPP', remitente: de, texto, usuario: { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol } });
  }
  if (fincaId) await prisma.mensajeWhatsApp.create({ data: { fincaId, telefono: de, direccion: 'SALIENTE', texto: resultado.respuesta.slice(0, 4000) } });
  try {
    await wa.enviarTexto(de, resultado.respuesta);
  } catch (e) {
    console.error('[whatsapp] no se pudo enviar la respuesta:', e.message);
    resultado.envio = 'FALLIDO';
  }
  return { ...resultado, modo: wa.simulado ? 'SIMULADO' : 'CLOUD_API' };
}
