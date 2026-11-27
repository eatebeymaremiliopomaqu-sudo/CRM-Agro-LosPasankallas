// Agente de IA (canal web) y webhooks de WhatsApp (Meta Cloud API y Twilio).
// WhatsApp es una capacidad transversal (ADR-004): se activa con Finca.whatsappActivo.
import express, { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../db.js';
import { config } from '../config.js';
import { autorizar } from '../middleware/auth.js';
import { validar } from '../middleware/validar.js';
import { asyncH } from '../utils/errores.js';
import { atenderMensajeEntrante, procesarMensaje } from '../services/atencionWhatsApp.js';
import { extraerMensajes, extraerMensajeTwilio, proveedorWhatsApp, twiml, verificarFirma, verificarFirmaTwilio } from '../services/whatsapp.js';

export { procesarMensaje };

const limiteAgente = rateLimit({ windowMs: 60 * 1000, max: 30, skip: () => process.env.NODE_ENV === 'test', message: { error: 'Demasiados mensajes, espere un minuto.' } });
const limiteWebhook = rateLimit({ windowMs: 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false });

// ── Canal web (chat dentro del CRM) ──
export const agenteRouter = Router();

agenteRouter.post('/mensaje', limiteAgente, autorizar('agente:usar'), validar(z.object({ texto: z.string().min(1).max(800) })), asyncH(async (req, res) => {
  const usuario = await prisma.usuario.findUnique({ where: { id: req.usuario.id }, select: { id: true, nombre: true, rol: true, trabajadorId: true } });
  const r = await procesarMensaje({ fincaId: req.usuario.fincaId, canal: 'WEB', remitente: `usuario:${usuario.id}`, texto: req.body.texto, usuario, perfil: usuario.rol });
  res.json(r);
}));

agenteRouter.get('/acciones', autorizar('agente:usar'), asyncH(async (req, res) => {
  res.json(await prisma.accionPendiente.findMany({ where: { fincaId: req.usuario.fincaId }, orderBy: { creadoEn: 'desc' }, take: 50 }));
}));

agenteRouter.get('/whatsapp/mensajes', autorizar('agente:usar'), asyncH(async (req, res) => {
  const p = proveedorWhatsApp();
  res.json({
    modo: p.simulado ? 'SIMULADO' : p.nombre.toUpperCase(),
    proveedor: p.nombre,
    motivoSimulado: p.motivo || null,
    mensajes: await prisma.mensajeWhatsApp.findMany({ where: { fincaId: req.usuario.fincaId }, orderBy: { fecha: 'desc' }, take: 100 }),
  });
}));

/** Contactos con teléfono de la finca, para elegir el remitente en el simulador. */
agenteRouter.get('/whatsapp/contactos', autorizar('agente:usar'), asyncH(async (req, res) => {
  const fincaId = req.usuario.fincaId;
  const [usuarios, clientes, trabajadores] = await Promise.all([
    prisma.usuario.findMany({ where: { fincaId, activo: true, telefono: { not: null } }, select: { nombre: true, rol: true, telefono: true, consentimientoWhatsapp: true } }),
    prisma.cliente.findMany({ where: { fincaId, activo: true, telefono: { not: null } }, select: { nombre: true, telefono: true, consentimientoWhatsapp: true } }),
    prisma.trabajador.findMany({ where: { fincaId, activo: true, telefono: { not: null }, usuarios: { none: {} } }, select: { nombre: true, telefono: true, consentimientoWhatsapp: true } }),
  ]);
  res.json([
    ...usuarios.map((u) => ({ ...u, tipo: 'USUARIO' })),
    ...trabajadores.map((t) => ({ ...t, rol: 'TRABAJADOR', tipo: 'TRABAJADOR' })),
    ...clientes.map((c) => ({ ...c, rol: 'CLIENTE', tipo: 'CLIENTE' })),
  ]);
}));

/**
 * Simulador de WhatsApp para la demo: procesa el texto como si llegara por WhatsApp
 * desde el teléfono indicado (usuario, trabajador, cliente o desconocido) de esta finca.
 */
agenteRouter.post('/whatsapp/simular', limiteAgente, autorizar('agente:usar'), validar(z.object({ telefono: z.string().min(8).max(25), texto: z.string().min(1).max(800) })), asyncH(async (req, res) => {
  const r = await atenderMensajeEntrante({ de: req.body.telefono, texto: req.body.texto, fincaIdForzada: req.usuario.fincaId });
  res.json({ ...r, modo: 'SIMULADOR' });
}));

// ── Webhook de Meta WhatsApp Cloud API ──
export const webhookRouter = Router();

// Verificación inicial (Meta hace GET con hub.challenge)
webhookRouter.get('/', (req, res) => {
  if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === config.whatsapp.verifyToken) {
    console.log('[whatsapp:meta] webhook verificado por Meta');
    return res.status(200).send(req.query['hub.challenge']);
  }
  console.warn('[whatsapp:meta] verificación rechazada: el token no coincide con WHATSAPP_VERIFY_TOKEN');
  res.sendStatus(403);
});

webhookRouter.post('/', limiteWebhook, asyncH(async (req, res) => {
  if (!verificarFirma(req.rawBody || Buffer.from(''), req.get('x-hub-signature-256'), config.whatsapp.appSecret, { exigir: config.esProduccion })) {
    console.warn('[whatsapp:meta] firma X-Hub-Signature-256 inválida: revisa WHATSAPP_APP_SECRET');
    return res.sendStatus(401);
  }
  // Meta espera 200 rápido; procesamos después y respondemos por la API REST.
  res.sendStatus(200);
  for (const m of extraerMensajes(req.body)) {
    try {
      console.log(`[whatsapp:meta] ← ${m.de}: ${m.texto.slice(0, 80)}`);
      const r = await atenderMensajeEntrante({ de: m.de, texto: m.texto });
      await proveedorWhatsApp().enviarTexto(m.de, r.respuesta);
      console.log(`[whatsapp:meta] → ${m.de}: ${String(r.respuesta).slice(0, 80).replace(/\n/g, ' ')}`);
    } catch (e) {
      console.error('[whatsapp:meta] error procesando mensaje', e.message);
    }
  }
}));

// ── Webhook de Twilio (Sandbox o número aprobado) ──
export const twilioRouter = Router();
twilioRouter.use(express.urlencoded({ extended: false, limit: '50kb' }));

/** URL que Twilio firmó: la configurada (recomendado detrás de túneles) o la reconstruida. */
export const urlFirmadaTwilio = (req) => config.whatsapp.twilioWebhookUrl || `${req.protocol}://${req.get('host')}${req.originalUrl}`;

twilioRouter.post('/', limiteWebhook, asyncH(async (req, res) => {
  const { twilioAuthToken, twilioValidarFirma } = config.whatsapp;
  if (twilioValidarFirma || config.esProduccion) {
    if (!twilioAuthToken) return res.status(503).type('text/plain').send('Falta TWILIO_AUTH_TOKEN en el servidor');
    if (!verificarFirmaTwilio(twilioAuthToken, urlFirmadaTwilio(req), req.body, req.get('x-twilio-signature'))) {
      return res.status(403).type('text/plain').send('Firma X-Twilio-Signature inválida');
    }
  }
  const m = extraerMensajeTwilio(req.body);
  if (!m) return res.type('text/xml').send(twiml(''));
  let respuesta;
  try {
    respuesta = (await atenderMensajeEntrante({ de: m.de, texto: m.texto })).respuesta;
  } catch (e) {
    console.error('[whatsapp:twilio] error procesando mensaje', e.message);
    respuesta = 'Tuvimos un problema al procesar tu mensaje. Intenta de nuevo en un momento.';
  }
  // Respondemos con TwiML: Twilio entrega el texto en el mismo chat (dentro de la ventana de 24 h).
  res.type('text/xml').send(twiml(respuesta));
}));
