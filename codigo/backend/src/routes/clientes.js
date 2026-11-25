// M5 · Gestión de clientes
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { autorizar } from '../middleware/auth.js';
import { validar } from '../middleware/validar.js';
import { asyncH, noEncontrado } from '../utils/errores.js';
import { auditar } from '../utils/auditoria.js';

const r = Router();

const esquemaCliente = z.object({
  nombre: z.string().min(2).max(80),
  tipo: z.enum(['MINORISTA', 'MAYORISTA', 'RESTAURANTE', 'MERCADO']).optional(),
  telefono: z.string().max(20).nullable().optional(),
  consentimientoWhatsapp: z.boolean().optional(),
  nit: z.string().max(20).nullable().optional(),
  direccion: z.string().max(200).nullable().optional(),
  activo: z.boolean().optional(),
});

async function clientePropio(fincaId, id) {
  const c = await prisma.cliente.findFirst({
    where: { id: Number(id), fincaId },
  });
  if (!c) throw noEncontrado('Cliente');
  return c;
}

r.get('/', autorizar('ventas:leer'), asyncH(async (req, res) => {
  const where = { fincaId: req.usuario.fincaId };
  if (req.query.tipo) where.tipo = req.query.tipo;
  if (req.query.todos !== 'true') where.activo = true;

  const clientes = await prisma.cliente.findMany({
    where,
    include: {
      _count: { select: { ventas: true, pedidos: true } },
    },
    orderBy: { nombre: 'asc' },
  });
  res.json(clientes);
}));

r.post('/', autorizar('ventas:escribir'), validar(esquemaCliente), asyncH(async (req, res) => {
  const data = {
    ...req.body,
    fincaId: req.usuario.fincaId,
    telefono: req.body.telefono || null,
    nit: req.body.nit || null,
    direccion: req.body.direccion || null,
  };

  if (req.body.consentimientoWhatsapp) {
    data.fechaConsentimiento = new Date();
  }

  const c = await prisma.cliente.create({ data });
  await auditar({
    usuarioId: req.usuario.id,
    fincaId: req.usuario.fincaId,
    accion: 'CREAR',
    entidad: 'Cliente',
    entidadId: c.id,
  });
  res.status(201).json(c);
}));

r.put('/:id', autorizar('ventas:escribir'), validar(esquemaCliente.partial()), asyncH(async (req, res) => {
  const c0 = await clientePropio(req.usuario.fincaId, req.params.id);

  const data = { ...req.body };
  if ('telefono' in req.body) data.telefono = req.body.telefono || null;
  if ('nit' in req.body) data.nit = req.body.nit || null;
  if ('direccion' in req.body) data.direccion = req.body.direccion || null;

  if (req.body.consentimientoWhatsapp && !c0.consentimientoWhatsapp) {
    data.fechaConsentimiento = new Date();
  } else if (req.body.consentimientoWhatsapp === false) {
    data.fechaConsentimiento = null;
  }

  const c = await prisma.cliente.update({
    where: { id: c0.id },
    data,
  });
  await auditar({
    usuarioId: req.usuario.id,
    fincaId: req.usuario.fincaId,
    accion: 'ACTUALIZAR',
    entidad: 'Cliente',
    entidadId: c.id,
  });
  res.json(c);
}));

r.delete('/:id', autorizar('ventas:escribir'), asyncH(async (req, res) => {
  const c0 = await clientePropio(req.usuario.fincaId, req.params.id);
  await prisma.cliente.update({
    where: { id: c0.id },
    data: { activo: false },
  });
  await auditar({
    usuarioId: req.usuario.id,
    fincaId: req.usuario.fincaId,
    accion: 'ELIMINAR',
    entidad: 'Cliente',
    entidadId: c0.id,
    detalle: 'baja lógica',
  });
  res.status(204).end();
}));

export default r;
