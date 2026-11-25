// M5 · Inventario de productos cosechados
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { autorizar } from '../middleware/auth.js';
import { validar } from '../middleware/validar.js';
import { asyncH, noEncontrado, solicitudInvalida } from '../utils/errores.js';
import { auditar } from '../utils/auditoria.js';

const r = Router();

const esquemaProducto = z.object({
  nombre: z.string().min(2).max(80),
  cultivo: z.string().min(2).max(40),
  unidad: z.string().min(1).max(10),
  stock: z.number().min(0).optional(),
  stockMinimo: z.number().min(0).optional(),
  precioVentaBs: z.number().min(0).optional(),
});

r.get('/', autorizar('ventas:leer'), asyncH(async (req, res) => {
  const lista = await prisma.productoCosechado.findMany({
    where: { fincaId: req.usuario.fincaId },
    orderBy: { nombre: 'asc' },
  });
  res.json(lista.map((p) => ({ ...p, bajoMinimo: p.stock <= p.stockMinimo })));
}));

r.post('/', autorizar('ventas:escribir'), validar(esquemaProducto), asyncH(async (req, res) => {
  const p = await prisma.productoCosechado.create({
    data: { ...req.body, fincaId: req.usuario.fincaId },
  });
  await auditar({
    usuarioId: req.usuario.id,
    fincaId: req.usuario.fincaId,
    accion: 'CREAR',
    entidad: 'ProductoCosechado',
    entidadId: p.id,
  });
  res.status(201).json(p);
}));

r.put('/:id', autorizar('ventas:escribir'), validar(esquemaProducto.partial()), asyncH(async (req, res) => {
  const p0 = await prisma.productoCosechado.findFirst({
    where: { id: Number(req.params.id), fincaId: req.usuario.fincaId },
  });
  if (!p0) throw noEncontrado('Producto');
  const p = await prisma.productoCosechado.update({
    where: { id: p0.id },
    data: req.body,
  });
  await auditar({
    usuarioId: req.usuario.id,
    fincaId: req.usuario.fincaId,
    accion: 'ACTUALIZAR',
    entidad: 'ProductoCosechado',
    entidadId: p.id,
  });
  res.json(p);
}));

r.get('/movimientos', autorizar('ventas:leer'), asyncH(async (req, res) => {
  const where = {
    producto: { fincaId: req.usuario.fincaId },
  };
  if (req.query.productoId) where.productoId = Number(req.query.productoId);
  if (req.query.tipo) where.tipo = req.query.tipo;

  const movimientos = await prisma.movimientoProducto.findMany({
    where,
    include: { producto: { select: { nombre: true, unidad: true } } },
    orderBy: { fecha: 'desc' },
    take: 100,
  });
  res.json(movimientos);
}));

const esquemaMovimiento = z.object({
  tipo: z.enum(['ENTRADA', 'SALIDA']),
  cantidad: z.number().positive(),
  motivo: z.string().max(120).optional(),
  referencia: z.string().max(60).optional(),
});

r.post('/movimientos', autorizar('ventas:escribir'), validar(esquemaMovimiento.extend({
  productoId: z.number().int().positive(),
})), asyncH(async (req, res) => {
  const p = await prisma.productoCosechado.findFirst({
    where: { id: req.body.productoId, fincaId: req.usuario.fincaId },
  });
  if (!p) throw noEncontrado('Producto');

  const delta = req.body.tipo === 'ENTRADA' ? req.body.cantidad : -req.body.cantidad;
  if (p.stock + delta < 0) {
    throw solicitudInvalida(`Stock insuficiente: hay ${p.stock} ${p.unidad}`);
  }

  const [mov, actualizado] = await prisma.$transaction([
    prisma.movimientoProducto.create({
      data: {
        productoId: p.id,
        tipo: req.body.tipo,
        cantidad: req.body.cantidad,
        motivo: req.body.motivo || null,
        referencia: req.body.referencia || null,
      },
    }),
    prisma.productoCosechado.update({
      where: { id: p.id },
      data: { stock: { increment: delta } },
    }),
  ]);

  res.status(201).json({
    movimiento: mov,
    producto: { ...actualizado, bajoMinimo: actualizado.stock <= actualizado.stockMinimo },
  });
}));

export default r;
