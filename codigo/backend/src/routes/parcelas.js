// M1 · Parcelas y cultivos
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { autorizar } from '../middleware/auth.js';
import { validar } from '../middleware/validar.js';
import { asyncH, noEncontrado } from '../utils/errores.js';
import { auditar } from '../utils/auditoria.js';

const r = Router();

const esquemaParcela = z.object({
  codigo: z.string().regex(/^P-\d{2,3}$/, 'Formato P-01'),
  nombre: z.string().min(2).max(60),
  areaHa: z.number().positive().max(1000),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  tipoSuelo: z.string().max(40).nullable().optional(),
  riego: z.enum(['GOTEO', 'ASPERSION', 'GRAVEDAD', 'SECANO']).nullable().optional(),
  activa: z.boolean().optional(),
});

async function parcelaPropia(req) {
  const p = await prisma.parcela.findFirst({ where: { id: Number(req.params.id), fincaId: req.usuario.fincaId } });
  if (!p) throw noEncontrado('Parcela');
  return p;
}

r.get('/', autorizar('parcelas:leer'), asyncH(async (req, res) => {
  const parcelas = await prisma.parcela.findMany({
    where: { fincaId: req.usuario.fincaId },
    include: { siembras: { where: { estado: 'EN_CURSO' }, take: 1, orderBy: { fechaSiembra: 'desc' } }, _count: { select: { labores: true, observaciones: true } } },
    orderBy: { codigo: 'asc' },
  });
  res.json(parcelas.map(({ siembras, ...p }) => ({ ...p, siembraActual: siembras[0] || null })));
}));

r.get('/:id', autorizar('parcelas:leer'), asyncH(async (req, res) => {
  await parcelaPropia(req);
  const p = await prisma.parcela.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      siembras: { orderBy: { fechaSiembra: 'desc' } },
      labores: { orderBy: { fecha: 'desc' }, take: 20, include: { aplicacion: true } },
      observaciones: { orderBy: { fecha: 'desc' }, take: 20 },
    },
  });
  res.json(p);
}));

r.post('/', autorizar('parcelas:escribir'), validar(esquemaParcela), asyncH(async (req, res) => {
  const p = await prisma.parcela.create({ data: { ...req.body, fincaId: req.usuario.fincaId } });
  await auditar({ usuarioId: req.usuario.id, fincaId: req.usuario.fincaId, accion: 'CREAR', entidad: 'Parcela', entidadId: p.id });
  res.status(201).json(p);
}));

r.patch('/:id', autorizar('parcelas:escribir'), validar(esquemaParcela.partial()), asyncH(async (req, res) => {
  const p0 = await parcelaPropia(req);
  const p = await prisma.parcela.update({ where: { id: p0.id }, data: req.body });
  await auditar({ usuarioId: req.usuario.id, fincaId: req.usuario.fincaId, accion: 'ACTUALIZAR', entidad: 'Parcela', entidadId: p.id });
  res.json(p);
}));

// Baja lógica: se conserva el historial para la trazabilidad
r.delete('/:id', autorizar('parcelas:escribir'), asyncH(async (req, res) => {
  const p0 = await parcelaPropia(req);
  await prisma.parcela.update({ where: { id: p0.id }, data: { activa: false } });
  await auditar({ usuarioId: req.usuario.id, fincaId: req.usuario.fincaId, accion: 'ELIMINAR', entidad: 'Parcela', entidadId: p0.id, detalle: 'baja lógica' });
  res.status(204).end();
}));

// Siembras (ciclos de cultivo)
const esquemaSiembra = z.object({
  cultivo: z.string().min(2).max(40),
  variedad: z.string().max(40).nullable().optional(),
  fechaSiembra: z.coerce.date(),
  fechaCosechaEst: z.coerce.date().nullable().optional(),
  estado: z.enum(['EN_CURSO', 'COSECHADA', 'PERDIDA']).optional(),
});

r.post('/:id/siembras', autorizar('parcelas:escribir'), validar(esquemaSiembra), asyncH(async (req, res) => {
  const p = await parcelaPropia(req);
  const s = await prisma.siembra.create({ data: { ...req.body, parcelaId: p.id } });
  await auditar({ usuarioId: req.usuario.id, fincaId: req.usuario.fincaId, accion: 'CREAR', entidad: 'Siembra', entidadId: s.id });
  res.status(201).json(s);
}));

r.patch('/siembras/:sid', autorizar('parcelas:escribir'), validar(esquemaSiembra.partial()), asyncH(async (req, res) => {
  const s0 = await prisma.siembra.findFirst({ where: { id: Number(req.params.sid), parcela: { fincaId: req.usuario.fincaId } } });
  if (!s0) throw noEncontrado('Siembra');
  res.json(await prisma.siembra.update({ where: { id: s0.id }, data: req.body }));
}));

export default r;
