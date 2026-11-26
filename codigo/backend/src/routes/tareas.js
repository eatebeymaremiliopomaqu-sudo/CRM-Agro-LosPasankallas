// M3 · Tareas asignadas a trabajadores ("Mis tareas" del rol TRABAJADOR).
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { autorizar } from '../middleware/auth.js';
import { validar } from '../middleware/validar.js';
import { asyncH, noEncontrado, solicitudInvalida, prohibido } from '../utils/errores.js';
import { auditar } from '../utils/auditoria.js';
import { notificarTareaAsignada } from '../services/whatsapp.js';
import { ordenarTareas, puedeGestionarTarea, transicionTarea, PRIORIDADES_TAREA, ESTADOS_TAREA } from '../utils/tareas.js';

const r = Router();

const esquemaTarea = z.object({
  trabajadorId: z.number().int().positive(),
  titulo: z.string().trim().min(3).max(120),
  descripcion: z.string().max(500).nullable().optional(),
  loteId: z.number().int().positive().nullable().optional(),
  prioridad: z.enum(PRIORIDADES_TAREA).optional(),
  fechaVencimiento: z.coerce.date().nullable().optional(),
});

const incluir = {
  trabajador: { select: { id: true, nombre: true, cargo: true, consentimientoWhatsapp: true } },
  asignadoPor: { select: { nombre: true } },
  lote: { select: { codigo: true, nombre: true } },
};

/** El JWT no lleva trabajadorId: se lee de la BD para no depender de un token viejo. */
async function usuarioConTrabajador(req) {
  const u = await prisma.usuario.findUnique({ where: { id: req.usuario.id }, select: { trabajadorId: true } });
  return { ...req.usuario, trabajadorId: u?.trabajadorId ?? null };
}

async function tareaDeFinca(fincaId, id) {
  const t = await prisma.tarea.findFirst({ where: { id: Number(id), trabajador: { fincaId } }, include: incluir });
  if (!t) throw noEncontrado('Tarea');
  return t;
}

async function validarReferencias(fincaId, { trabajadorId, loteId }) {
  if (trabajadorId) {
    const t = await prisma.trabajador.findFirst({ where: { id: trabajadorId, fincaId, activo: true } });
    if (!t) throw solicitudInvalida('El trabajador no pertenece a esta finca o está inactivo');
  }
  if (loteId) {
    const l = await prisma.lote.findFirst({ where: { id: loteId, fincaId } });
    if (!l) throw solicitudInvalida('El lote no pertenece a esta finca');
  }
}

// GET / - Todas las tareas de la finca (encargado/propietario) con filtros
r.get('/', autorizar('tareas:escribir'), asyncH(async (req, res) => {
  const { trabajadorId, estado, prioridad, loteId, desde, hasta } = req.query;
  const where = { trabajador: { fincaId: req.usuario.fincaId } };
  if (trabajadorId) where.trabajadorId = Number(trabajadorId);
  if (estado && ESTADOS_TAREA.includes(estado)) where.estado = estado;
  if (prioridad && PRIORIDADES_TAREA.includes(prioridad)) where.prioridad = prioridad;
  if (loteId) where.loteId = Number(loteId);
  if (desde || hasta) where.fechaVencimiento = { ...(desde && { gte: new Date(desde) }), ...(hasta && { lte: new Date(hasta) }) };
  const tareas = await prisma.tarea.findMany({ where, include: incluir, take: 300 });
  res.json(ordenarTareas(tareas));
}));

// GET /mis-tareas - Tareas del trabajador vinculado al usuario actual
r.get('/mis-tareas', autorizar('tareas:leer'), asyncH(async (req, res) => {
  const u = await usuarioConTrabajador(req);
  if (!u.trabajadorId) return res.json([]);
  const where = { trabajadorId: u.trabajadorId };
  if (req.query.estado && ESTADOS_TAREA.includes(req.query.estado)) where.estado = req.query.estado;
  const tareas = await prisma.tarea.findMany({ where, include: incluir, take: 200 });
  res.json(ordenarTareas(tareas));
}));

// POST / - Asignar tarea (avisa por WhatsApp solo si el trabajador dio consentimiento)
r.post('/', autorizar('tareas:escribir'), validar(esquemaTarea), asyncH(async (req, res) => {
  await validarReferencias(req.usuario.fincaId, req.body);
  const tarea = await prisma.tarea.create({
    data: {
      trabajadorId: req.body.trabajadorId,
      asignadoPorId: req.usuario.id,
      titulo: req.body.titulo,
      descripcion: req.body.descripcion || null,
      loteId: req.body.loteId || null,
      prioridad: req.body.prioridad || 'MEDIA',
      fechaVencimiento: req.body.fechaVencimiento || null,
    },
    include: { ...incluir, trabajador: true },
  });

  const aviso = await notificarTareaAsignada(req.usuario.fincaId, tarea.trabajador, tarea).catch((e) => ({ enviado: false, razon: e.message }));
  if (aviso.enviado) await prisma.tarea.update({ where: { id: tarea.id }, data: { notificada: true } });

  await auditar({ usuarioId: req.usuario.id, fincaId: req.usuario.fincaId, accion: 'CREAR', entidad: 'Tarea', entidadId: tarea.id, detalle: `Asignada a ${tarea.trabajador.nombre}` });
  const { trabajador, ...resto } = tarea;
  res.status(201).json({
    ...resto,
    trabajador: { id: trabajador.id, nombre: trabajador.nombre, cargo: trabajador.cargo, consentimientoWhatsapp: trabajador.consentimientoWhatsapp },
    notificada: aviso.enviado,
    aviso,
  });
}));

// PUT /:id - Editar datos de la tarea (no el estado: para eso están las acciones)
r.put('/:id(\\d+)', autorizar('tareas:escribir'), validar(esquemaTarea.partial()), asyncH(async (req, res) => {
  const actual = await tareaDeFinca(req.usuario.fincaId, req.params.id);
  await validarReferencias(req.usuario.fincaId, req.body);
  const tarea = await prisma.tarea.update({ where: { id: actual.id }, data: req.body, include: incluir });
  await auditar({ usuarioId: req.usuario.id, fincaId: req.usuario.fincaId, accion: 'ACTUALIZAR', entidad: 'Tarea', entidadId: tarea.id });
  res.json(tarea);
}));

// PUT /:id/iniciar | /completar | /cancelar
for (const accion of ['iniciar', 'completar', 'cancelar']) {
  const permiso = accion === 'cancelar' ? 'tareas:escribir' : 'tareas:leer';
  r.put(`/:id(\\d+)/${accion}`, autorizar(permiso), asyncH(async (req, res) => {
    const actual = await tareaDeFinca(req.usuario.fincaId, req.params.id);
    const u = await usuarioConTrabajador(req);
    if (!puedeGestionarTarea(u, actual)) throw prohibido('Solo puedes gestionar tus propias tareas');
    const t = transicionTarea(actual.estado, accion);
    if (!t.ok) throw solicitudInvalida(t.error);
    const tarea = await prisma.tarea.update({
      where: { id: actual.id },
      data: { estado: t.estado, ...(t.estado === 'COMPLETADA' && { fechaCompletada: new Date() }) },
      include: incluir,
    });
    await auditar({ usuarioId: req.usuario.id, fincaId: req.usuario.fincaId, accion: 'ACTUALIZAR', entidad: 'Tarea', entidadId: tarea.id, detalle: t.estado });
    res.json(tarea);
  }));
}

export default r;
