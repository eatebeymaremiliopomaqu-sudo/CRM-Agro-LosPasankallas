// M1 · Lotes y cultivos
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { autorizar } from '../middleware/auth.js';
import { validar } from '../middleware/validar.js';
import { asyncH, noEncontrado } from '../utils/errores.js';
import { auditar } from '../utils/auditoria.js';

const r = Router();

const esquemaLote = z.object({
  codigo: z.string().regex(/^L-\d{2,3}$/, 'Formato L-01'),
  nombre: z.string().min(2).max(60),
  areaHa: z.number().positive().max(1000),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  tipoSuelo: z.string().max(40).nullable().optional(),
  riego: z.enum(['GOTEO', 'ASPERSION', 'GRAVEDAD', 'SECANO']).nullable().optional(),
  activa: z.boolean().optional(),
});

async function lotePropio(req) {
  const l = await prisma.lote.findFirst({ where: { id: Number(req.params.id), fincaId: req.usuario.fincaId } });
  if (!l) throw noEncontrado('Lote');
  return l;
}

r.get('/', autorizar('lotes:leer'), asyncH(async (req, res) => {
  const lotes = await prisma.lote.findMany({
    where: { fincaId: req.usuario.fincaId },
    include: { campanias: { where: { estado: 'EN_CURSO' }, take: 1, orderBy: { fechaSiembra: 'desc' } }, _count: { select: { labores: true, observaciones: true } } },
    orderBy: { codigo: 'asc' },
  });
  res.json(lotes.map(({ campanias, ...l }) => ({ ...l, campaniaActual: campanias[0] || null })));
}));

r.get('/:id', autorizar('lotes:leer'), asyncH(async (req, res) => {
  await lotePropio(req);
  const l = await prisma.lote.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      campanias: { orderBy: { fechaSiembra: 'desc' } },
      labores: { orderBy: { fecha: 'desc' }, take: 20, include: { aplicacion: true } },
      observaciones: { orderBy: { fecha: 'desc' }, take: 20 },
    },
  });
  res.json(l);
}));

r.post('/', autorizar('lotes:escribir'), validar(esquemaLote), asyncH(async (req, res) => {
  const l = await prisma.lote.create({ data: { ...req.body, fincaId: req.usuario.fincaId } });
  await auditar({ usuarioId: req.usuario.id, fincaId: req.usuario.fincaId, accion: 'CREAR', entidad: 'Lote', entidadId: l.id });
  res.status(201).json(l);
}));

r.patch('/:id', autorizar('lotes:escribir'), validar(esquemaLote.partial()), asyncH(async (req, res) => {
  const l0 = await lotePropio(req);
  const l = await prisma.lote.update({ where: { id: l0.id }, data: req.body });
  await auditar({ usuarioId: req.usuario.id, fincaId: req.usuario.fincaId, accion: 'ACTUALIZAR', entidad: 'Lote', entidadId: l.id });
  res.json(l);
}));

// Baja lógica: se conserva el historial para la trazabilidad
r.delete('/:id', autorizar('lotes:escribir'), asyncH(async (req, res) => {
  const l0 = await lotePropio(req);
  await prisma.lote.update({ where: { id: l0.id }, data: { activa: false } });
  await auditar({ usuarioId: req.usuario.id, fincaId: req.usuario.fincaId, accion: 'ELIMINAR', entidad: 'Lote', entidadId: l0.id, detalle: 'baja lógica' });
  res.status(204).end();
}));

// Campañas (ciclos de cultivo)
const esquemaCampania = z.object({
  cultivo: z.string().min(2).max(40),
  variedad: z.string().max(40).nullable().optional(),
  fechaSiembra: z.coerce.date(),
  fechaCosechaEst: z.coerce.date().nullable().optional(),
  estado: z.enum(['EN_CURSO', 'COSECHADA', 'PERDIDA']).optional(),
});

r.post('/:id/campanias', autorizar('lotes:escribir'), validar(esquemaCampania), asyncH(async (req, res) => {
  const l = await lotePropio(req);
  const c = await prisma.campania.create({ data: { ...req.body, loteId: l.id } });
  await auditar({ usuarioId: req.usuario.id, fincaId: req.usuario.fincaId, accion: 'CREAR', entidad: 'Campania', entidadId: c.id });
  res.status(201).json(c);
}));

r.patch('/campanias/:cid', autorizar('lotes:escribir'), validar(esquemaCampania.partial()), asyncH(async (req, res) => {
  const c0 = await prisma.campania.findFirst({ where: { id: Number(req.params.cid), lote: { fincaId: req.usuario.fincaId } } });
  if (!c0) throw noEncontrado('Campaña');
  res.json(await prisma.campania.update({ where: { id: c0.id }, data: req.body }));
}));

export default r;
