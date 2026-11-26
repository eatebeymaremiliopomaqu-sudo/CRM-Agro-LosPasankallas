// M3 · Trabajadores, asistencia y jornales
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { autorizar } from '../middleware/auth.js';
import { validar } from '../middleware/validar.js';
import { asyncH, noEncontrado, solicitudInvalida } from '../utils/errores.js';
import { auditar } from '../utils/auditoria.js';
import { calcularPago, planilla } from '../services/nomina.js';

const r = Router();

const esquemaTrabajador = z.object({
  nombre: z.string().min(3).max(80),
  documento: z.string().max(20).nullable().optional(),
  telefono: z.string().max(20).nullable().optional(),
  cargo: z.enum(['JORNALERO', 'CAPATAZ', 'TRACTORISTA', 'REGADOR', 'OTRO']).optional(),
  jornalBs: z.number().min(0).max(2000),
  activo: z.boolean().optional(),
  consentimientoWhatsapp: z.boolean().optional(),
});

/** Al cambiar el consentimiento se guarda la fecha (evidencia ética de la guía). */
const conFechaConsentimiento = (datos, previo = null) => {
  if (datos.consentimientoWhatsapp === undefined || datos.consentimientoWhatsapp === previo?.consentimientoWhatsapp) return datos;
  return { ...datos, fechaConsentimiento: datos.consentimientoWhatsapp ? new Date() : null };
};

async function trabajadorPropio(fincaId, id) {
  const t = await prisma.trabajador.findFirst({ where: { id: Number(id), fincaId } });
  if (!t) throw noEncontrado('Trabajador');
  return t;
}

const rangoFechas = (desde, hasta) => {
  const d = desde ? new Date(desde) : new Date(Date.now() - 14 * 86400000);
  const h = hasta ? new Date(hasta) : new Date();
  if (Number.isNaN(d.getTime()) || Number.isNaN(h.getTime()) || d > h) throw solicitudInvalida('Rango de fechas inválido');
  return { gte: d, lte: h };
};

r.get('/', autorizar('trabajadores:leer'), asyncH(async (req, res) => {
  res.json(await prisma.trabajador.findMany({
    where: { fincaId: req.usuario.fincaId, ...(req.query.todos ? {} : { activo: true }) },
    include: { _count: { select: { asistencias: true } } },
    orderBy: { nombre: 'asc' },
  }));
}));

r.post('/', autorizar('trabajadores:escribir'), validar(esquemaTrabajador), asyncH(async (req, res) => {
  const t = await prisma.trabajador.create({ data: { ...conFechaConsentimiento(req.body), fincaId: req.usuario.fincaId } });
  await auditar({ usuarioId: req.usuario.id, fincaId: req.usuario.fincaId, accion: 'CREAR', entidad: 'Trabajador', entidadId: t.id });
  res.status(201).json(t);
}));

r.patch('/:id(\\d+)', autorizar('trabajadores:escribir'), validar(esquemaTrabajador.partial()), asyncH(async (req, res) => {
  const t0 = await trabajadorPropio(req.usuario.fincaId, req.params.id);
  const t = await prisma.trabajador.update({ where: { id: t0.id }, data: conFechaConsentimiento(req.body, t0) });
  await auditar({ usuarioId: req.usuario.id, fincaId: req.usuario.fincaId, accion: 'ACTUALIZAR', entidad: 'Trabajador', entidadId: t.id });
  res.json(t);
}));

// Asistencia
r.get('/asistencias', autorizar('trabajadores:leer'), asyncH(async (req, res) => {
  res.json(await prisma.asistencia.findMany({
    where: { trabajador: { fincaId: req.usuario.fincaId }, fecha: rangoFechas(req.query.desde, req.query.hasta) },
    include: { trabajador: { select: { nombre: true } }, lote: { select: { codigo: true } } },
    orderBy: [{ fecha: 'desc' }],
  }));
}));

const esquemaAsistencia = z.object({
  trabajadorId: z.number().int().positive(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  horas: z.number().min(0).max(24),
  tarea: z.string().max(80).nullable().optional(),
  loteId: z.number().int().positive().nullable().optional(),
});

// Registro masivo (pasar lista del día): idempotente por trabajador+fecha
r.post('/asistencias', autorizar('trabajadores:escribir'), validar(z.object({ registros: z.array(esquemaAsistencia).min(1).max(200) })), asyncH(async (req, res) => {
  const fincaId = req.usuario.fincaId;
  const ids = [...new Set(req.body.registros.map((x) => x.trabajadorId))];
  const validos = await prisma.trabajador.count({ where: { id: { in: ids }, fincaId } });
  if (validos !== ids.length) throw solicitudInvalida('Hay trabajadores que no pertenecen a la finca');
  const resultado = await prisma.$transaction(
    req.body.registros.map(({ fecha, ...x }) => {
      const f = new Date(`${fecha}T12:00:00.000Z`);
      return prisma.asistencia.upsert({
        where: { trabajadorId_fecha: { trabajadorId: x.trabajadorId, fecha: f } },
        update: { horas: x.horas, tarea: x.tarea ?? null, loteId: x.loteId ?? null },
        create: { ...x, fecha: f },
      });
    })
  );
  await auditar({ usuarioId: req.usuario.id, fincaId, accion: 'CREAR', entidad: 'Asistencia', detalle: `${resultado.length} registros` });
  res.status(201).json({ guardados: resultado.length });
}));

// Planilla de jornales del periodo (cálculo en vivo)
r.get('/planilla', autorizar('trabajadores:leer'), asyncH(async (req, res) => {
  const fecha = rangoFechas(req.query.desde, req.query.hasta);
  const [trabajadores, asistencias] = await Promise.all([
    prisma.trabajador.findMany({ where: { fincaId: req.usuario.fincaId } }),
    prisma.asistencia.findMany({ where: { trabajador: { fincaId: req.usuario.fincaId }, fecha } }),
  ]);
  const filas = planilla(trabajadores, asistencias);
  res.json({ desde: fecha.gte, hasta: fecha.lte, filas, totalBs: Math.round(filas.reduce((s, f) => s + f.montoBs, 0) * 100) / 100 });
}));

// Generar pago de un trabajador para un periodo
r.post('/:id(\\d+)/pagos', autorizar('pagos:gestionar'), validar(z.object({ desde: z.string(), hasta: z.string() })), asyncH(async (req, res) => {
  const t = await trabajadorPropio(req.usuario.fincaId, req.params.id);
  const fecha = rangoFechas(req.body.desde, req.body.hasta);
  const asistencias = await prisma.asistencia.findMany({ where: { trabajadorId: t.id, fecha } });
  if (!asistencias.length) throw solicitudInvalida('No hay asistencias en ese periodo');
  const { dias, montoBs } = calcularPago(asistencias, t.jornalBs);
  const pago = await prisma.pago.create({ data: { trabajadorId: t.id, desde: fecha.gte, hasta: fecha.lte, dias, montoBs } });
  await auditar({ usuarioId: req.usuario.id, fincaId: req.usuario.fincaId, accion: 'CREAR', entidad: 'Pago', entidadId: pago.id, detalle: `${montoBs} Bs` });
  res.status(201).json(pago);
}));

r.get('/pagos', autorizar('trabajadores:leer'), asyncH(async (req, res) => {
  res.json(await prisma.pago.findMany({ where: { trabajador: { fincaId: req.usuario.fincaId } }, include: { trabajador: { select: { nombre: true } } }, orderBy: { creadoEn: 'desc' }, take: 100 }));
}));

r.patch('/pagos/:pid', autorizar('pagos:gestionar'), validar(z.object({ estado: z.enum(['PENDIENTE', 'PAGADO']) })), asyncH(async (req, res) => {
  const p = await prisma.pago.findFirst({ where: { id: Number(req.params.pid), trabajador: { fincaId: req.usuario.fincaId } } });
  if (!p) throw noEncontrado('Pago');
  res.json(await prisma.pago.update({ where: { id: p.id }, data: { estado: req.body.estado } }));
}));

export default r;
