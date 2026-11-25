// M5 · Gestión de pedidos
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { autorizar } from '../middleware/auth.js';
import { validar } from '../middleware/validar.js';
import { asyncH, noEncontrado } from '../utils/errores.js';
import { auditar } from '../utils/auditoria.js';

const r = Router();

const esquemaDetallePedido = z.object({
  producto: z.string().min(1).max(80),
  cantidad: z.number().positive(),
  unidad: z.string().min(1).max(10),
  precioBs: z.number().min(0),
  subtotal: z.number().min(0),
});

const esquemaPedido = z.object({
  clienteId: z.number().int().positive(),
  fechaEntrega: z.coerce.date().nullable().optional(),
  estado: z.enum(['PENDIENTE', 'CONFIRMADO', 'ENTREGADO', 'CANCELADO']).optional(),
  notas: z.string().max(500).nullable().optional(),
  detalles: z.array(esquemaDetallePedido).min(1),
});

async function pedidoPropio(fincaId, id) {
  const p = await prisma.pedido.findFirst({
    where: { id: Number(id), cliente: { fincaId } },
  });
  if (!p) throw noEncontrado('Pedido');
  return p;
}

r.get('/', autorizar('ventas:leer'), asyncH(async (req, res) => {
  const where = { cliente: { fincaId: req.usuario.fincaId } };

  if (req.query.estado) where.estado = req.query.estado;
  if (req.query.clienteId) where.clienteId = Number(req.query.clienteId);
  if (req.query.desde) {
    where.fecha = { gte: new Date(req.query.desde) };
  }
  if (req.query.hasta) {
    where.fecha = { ...where.fecha, lte: new Date(req.query.hasta) };
  }

  const pedidos = await prisma.pedido.findMany({
    where,
    include: {
      cliente: { select: { nombre: true, tipo: true } },
      _count: { select: { detalles: true } },
    },
    orderBy: { fecha: 'desc' },
    take: 100,
  });
  res.json(pedidos);
}));

r.get('/:id', autorizar('ventas:leer'), asyncH(async (req, res) => {
  await pedidoPropio(req.usuario.fincaId, req.params.id);
  const pedido = await prisma.pedido.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      cliente: true,
      detalles: { orderBy: { id: 'asc' } },
    },
  });
  res.json(pedido);
}));

r.post('/', autorizar('ventas:escribir'), validar(esquemaPedido), asyncH(async (req, res) => {
  const cliente = await prisma.cliente.findFirst({
    where: { id: req.body.clienteId, fincaId: req.usuario.fincaId },
  });
  if (!cliente) throw noEncontrado('Cliente');

  const total = req.body.detalles.reduce((sum, d) => sum + d.subtotal, 0);

  const pedido = await prisma.pedido.create({
    data: {
      clienteId: req.body.clienteId,
      fechaEntrega: req.body.fechaEntrega || null,
      estado: req.body.estado || 'PENDIENTE',
      total,
      notas: req.body.notas || null,
      detalles: {
        create: req.body.detalles,
      },
    },
    include: {
      cliente: { select: { nombre: true } },
      detalles: true,
    },
  });

  await auditar({
    usuarioId: req.usuario.id,
    fincaId: req.usuario.fincaId,
    accion: 'CREAR',
    entidad: 'Pedido',
    entidadId: pedido.id,
    detalle: `${total} Bs`,
  });

  res.status(201).json(pedido);
}));

r.put('/:id', autorizar('ventas:escribir'), validar(z.object({
  estado: z.enum(['PENDIENTE', 'CONFIRMADO', 'ENTREGADO', 'CANCELADO']).optional(),
  fechaEntrega: z.coerce.date().nullable().optional(),
  notas: z.string().max(500).nullable().optional(),
})), asyncH(async (req, res) => {
  const p0 = await pedidoPropio(req.usuario.fincaId, req.params.id);

  const pedido = await prisma.pedido.update({
    where: { id: p0.id },
    data: req.body,
    include: {
      cliente: { select: { nombre: true } },
      detalles: true,
    },
  });

  await auditar({
    usuarioId: req.usuario.id,
    fincaId: req.usuario.fincaId,
    accion: 'ACTUALIZAR',
    entidad: 'Pedido',
    entidadId: pedido.id,
  });

  res.json(pedido);
}));

export default r;
