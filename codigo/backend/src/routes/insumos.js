// M4 · Inventario de insumos con alerta de stock mínimo
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { autorizar } from '../middleware/auth.js';
import { validar } from '../middleware/validar.js';
import { asyncH, noEncontrado, solicitudInvalida } from '../utils/errores.js';
import { auditar } from '../utils/auditoria.js';

const r = Router();

const esquemaInsumo = z.object({
  nombre: z.string().min(2).max(80),
  categoria: z.enum(['SEMILLA', 'FERTILIZANTE', 'AGROQUIMICO', 'HERRAMIENTA', 'OTRO']),
  unidad: z.string().min(1).max(10),
  stock: z.number().min(0).optional(),
  stockMinimo: z.number().min(0).optional(),
  costoUnitBs: z.number().min(0).optional(),
});

r.get('/', autorizar('insumos:leer'), asyncH(async (req, res) => {
  const lista = await prisma.insumo.findMany({ where: { fincaId: req.usuario.fincaId }, orderBy: { nombre: 'asc' } });
  res.json(lista.map((i) => ({ ...i, bajoMinimo: i.stock <= i.stockMinimo })));
}));

r.post('/', autorizar('insumos:escribir'), validar(esquemaInsumo), asyncH(async (req, res) => {
  const i = await prisma.insumo.create({ data: { ...req.body, fincaId: req.usuario.fincaId } });
  await auditar({ usuarioId: req.usuario.id, fincaId: req.usuario.fincaId, accion: 'CREAR', entidad: 'Insumo', entidadId: i.id });
  res.status(201).json(i);
}));

r.post('/:id/movimientos', autorizar('insumos:escribir'),
  validar(z.object({ tipo: z.enum(['ENTRADA', 'SALIDA']), cantidad: z.number().positive(), motivo: z.string().max(120).optional() })),
  asyncH(async (req, res) => {
    const i = await prisma.insumo.findFirst({ where: { id: Number(req.params.id), fincaId: req.usuario.fincaId } });
    if (!i) throw noEncontrado('Insumo');
    const delta = req.body.tipo === 'ENTRADA' ? req.body.cantidad : -req.body.cantidad;
    if (i.stock + delta < 0) throw solicitudInvalida(`Stock insuficiente: hay ${i.stock} ${i.unidad}`);
    const [mov, actualizado] = await prisma.$transaction([
      prisma.movimientoInsumo.create({ data: { insumoId: i.id, ...req.body } }),
      prisma.insumo.update({ where: { id: i.id }, data: { stock: { increment: delta } } }),
    ]);
    res.status(201).json({ movimiento: mov, insumo: { ...actualizado, bajoMinimo: actualizado.stock <= actualizado.stockMinimo } });
  }));

export default r;
