// M2 · Control técnico de campo: labores, aplicaciones registradas y observaciones.
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { autorizar } from '../middleware/auth.js';
import { validar } from '../middleware/validar.js';
import { asyncH, noEncontrado, prohibido } from '../utils/errores.js';
import { auditar } from '../utils/auditoria.js';
import { puede } from '../utils/permisos.js';
import { TIPOS_LABOR, TIPOS_OBSERVACION } from '../constantes.js';

const r = Router();

const esquemaAplicacion = z.object({
  producto: z.string().min(2).max(80),
  ingredienteActivo: z.string().max(80).nullable().optional(),
  cantidadUsada: z.number().nonnegative().max(100000).nullable().optional(),
  unidad: z.enum(['L', 'ml', 'g', 'kg', 'saco', 'bolsa']).nullable().optional(),
  periodoCarenciaDias: z.number().int().min(0).max(365).nullable().optional(),
  responsableTecnico: z.string().min(3).max(80),
});

const esquemaLabor = z.object({
  parcelaId: z.number().int().positive(),
  siembraId: z.number().int().positive().nullable().optional(),
  tipo: z.enum(TIPOS_LABOR),
  fecha: z.coerce.date().optional(),
  descripcion: z.string().max(500).nullable().optional(),
  horas: z.number().min(0).max(24).optional(),
  costoBs: z.number().min(0).max(1000000).optional(),
  trabajadorId: z.number().int().positive().nullable().optional(),
  origen: z.enum(['WEB', 'OFFLINE']).optional(),
  aplicacion: esquemaAplicacion.nullable().optional(),
});

async function verificarParcela(fincaId, parcelaId) {
  const p = await prisma.parcela.findFirst({ where: { id: parcelaId, fincaId } });
  if (!p) throw noEncontrado('Parcela');
  return p;
}

r.get('/labores', autorizar('labores:leer'), asyncH(async (req, res) => {
  const { parcelaId, tipo, desde, hasta } = req.query;
  const where = {
    parcela: { fincaId: req.usuario.fincaId },
    ...(parcelaId ? { parcelaId: Number(parcelaId) } : {}),
    ...(tipo ? { tipo: String(tipo) } : {}),
    ...(desde || hasta ? { fecha: { ...(desde ? { gte: new Date(desde) } : {}), ...(hasta ? { lte: new Date(hasta) } : {}) } } : {}),
  };
  const labores = await prisma.labor.findMany({
    where,
    include: {
      parcela: { select: { codigo: true, nombre: true } },
      aplicacion: true,
      trabajador: { select: { nombre: true } },
      registradoPor: { select: { nombre: true } },
    },
    orderBy: { fecha: 'desc' },
    take: Math.min(Number(req.query.limite) || 200, 1000),
  });
  res.json(labores);
}));

r.post('/labores', autorizar('labores:escribir'), validar(esquemaLabor), asyncH(async (req, res) => {
  const { aplicacion, ...datos } = req.body;
  await verificarParcela(req.usuario.fincaId, datos.parcelaId);
  // Sólo técnicos/administradores registran aplicaciones de agroquímicos
  if (aplicacion && !puede(req.usuario.rol, 'aplicaciones:escribir')) throw prohibido('Sólo un técnico puede registrar aplicaciones de agroquímicos');
  if (!datos.siembraId) {
    const s = await prisma.siembra.findFirst({ where: { parcelaId: datos.parcelaId, estado: 'EN_CURSO' }, orderBy: { fechaSiembra: 'desc' } });
    datos.siembraId = s?.id ?? null;
  }
  const labor = await prisma.labor.create({
    data: { ...datos, registradoPorId: req.usuario.id, ...(aplicacion ? { aplicacion: { create: aplicacion } } : {}) },
    include: { aplicacion: true },
  });
  await auditar({ usuarioId: req.usuario.id, fincaId: req.usuario.fincaId, accion: 'CREAR', entidad: 'Labor', entidadId: labor.id });
  res.status(201).json(labor);
}));

r.delete('/labores/:id', autorizar('parcelas:escribir'), asyncH(async (req, res) => {
  const l = await prisma.labor.findFirst({ where: { id: Number(req.params.id), parcela: { fincaId: req.usuario.fincaId } } });
  if (!l) throw noEncontrado('Labor');
  await prisma.labor.delete({ where: { id: l.id } });
  await auditar({ usuarioId: req.usuario.id, fincaId: req.usuario.fincaId, accion: 'ELIMINAR', entidad: 'Labor', entidadId: l.id });
  res.status(204).end();
}));

// Observaciones fitosanitarias / clima
const esquemaObs = z.object({
  parcelaId: z.number().int().positive(),
  tipo: z.enum(TIPOS_OBSERVACION),
  severidad: z.number().int().min(1).max(5),
  nota: z.string().min(3).max(500),
  fecha: z.coerce.date().optional(),
});

r.get('/observaciones', autorizar('labores:leer'), asyncH(async (req, res) => {
  res.json(await prisma.observacion.findMany({
    where: { parcela: { fincaId: req.usuario.fincaId }, ...(req.query.parcelaId ? { parcelaId: Number(req.query.parcelaId) } : {}) },
    include: { parcela: { select: { codigo: true, nombre: true } } },
    orderBy: { fecha: 'desc' },
    take: 200,
  }));
}));

r.post('/observaciones', autorizar('labores:escribir'), validar(esquemaObs), asyncH(async (req, res) => {
  await verificarParcela(req.usuario.fincaId, req.body.parcelaId);
  const o = await prisma.observacion.create({ data: req.body });
  await auditar({ usuarioId: req.usuario.id, fincaId: req.usuario.fincaId, accion: 'CREAR', entidad: 'Observacion', entidadId: o.id });
  res.status(201).json(o);
}));

export default r;
