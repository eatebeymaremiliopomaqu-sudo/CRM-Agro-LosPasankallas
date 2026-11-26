// Alertas automáticas por WhatsApp (capacidad transversal): vista previa, envío manual y bitácora.
import { Router } from 'express';
import { prisma } from '../db.js';
import { autorizar } from '../middleware/auth.js';
import { asyncH } from '../utils/errores.js';
import { auditar } from '../utils/auditoria.js';
import { calcularAlertas, enviarAlertas, TIPOS_ALERTA } from '../services/alertas.js';
import { proveedorWhatsApp } from '../services/whatsapp.js';

const r = Router();

// Vista previa de las alertas de hoy (no envía nada)
r.get('/', autorizar('alertas:ver'), asyncH(async (req, res) => {
  const finca = await prisma.finca.findUnique({ where: { id: req.usuario.fincaId }, select: { whatsappActivo: true, alertasActivas: true, horaAlertas: true } });
  const items = await calcularAlertas(req.usuario.fincaId);
  const p = proveedorWhatsApp();
  res.json({ ...finca, proveedor: p.nombre, simulado: p.simulado, tipos: TIPOS_ALERTA, items });
}));

// Disparo manual (botón de la demo)
r.post('/enviar', autorizar('alertas:enviar'), asyncH(async (req, res) => {
  const resultado = await enviarAlertas(req.usuario.fincaId, { disparo: 'MANUAL' });
  await auditar({ usuarioId: req.usuario.id, fincaId: req.usuario.fincaId, accion: 'CREAR', entidad: 'BitacoraAlerta', detalle: `Envío manual: ${resultado.enviados.length} destinatario(s), ${resultado.items.length} aviso(s)` });
  res.json(resultado);
}));

// Bitácora de alertas enviadas
r.get('/bitacora', autorizar('alertas:ver'), asyncH(async (req, res) => {
  res.json(await prisma.bitacoraAlerta.findMany({ where: { fincaId: req.usuario.fincaId }, orderBy: { fecha: 'desc' }, take: Math.min(Number(req.query.limite) || 50, 200) }));
}));

export default r;
