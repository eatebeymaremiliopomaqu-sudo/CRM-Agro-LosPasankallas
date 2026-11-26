// M5 · Gestión de ventas y cobros
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { autorizar } from '../middleware/auth.js';
import { validar } from '../middleware/validar.js';
import { asyncH, noEncontrado, solicitudInvalida } from '../utils/errores.js';
import { auditar } from '../utils/auditoria.js';
import { loteCosechaEnCarencia } from '../utils/carencia.js';
import { disponibles, etapaSegunStock } from '../utils/vivero.js';

const r = Router();

const esquemaDetalleVenta = z.object({
  producto: z.string().min(1).max(80),
  cantidad: z.number().positive(),
  unidad: z.string().min(1).max(10),
  precioBs: z.number().min(0),
  subtotal: z.number().min(0),
  loteCosechaId: z.number().int().positive().nullable().optional(),
  productoId: z.number().int().positive().optional(),
  lotePlantinId: z.number().int().positive().nullable().optional(), // M6: venta de plantines
});

const esquemaVenta = z.object({
  clienteId: z.number().int().positive(),
  fecha: z.coerce.date().optional(),
  notas: z.string().max(500).nullable().optional(),
  detalles: z.array(esquemaDetalleVenta).min(1),
  justificacion: z.string().max(500).optional(), // solo PROPIETARIO, para vender un lote cosechado en carencia
});

async function ventaPropia(fincaId, id) {
  const v = await prisma.venta.findFirst({
    where: { id: Number(id), cliente: { fincaId } },
  });
  if (!v) throw noEncontrado('Venta');
  return v;
}

function calcularEstado(total, pagado, fecha) {
  if (pagado >= total) return 'PAGADO';
  const hace7Dias = new Date();
  hace7Dias.setDate(hace7Dias.getDate() - 7);
  if (fecha < hace7Dias && pagado < total) return 'VENCIDO';
  return 'PENDIENTE';
}

r.get('/', autorizar('ventas:leer'), asyncH(async (req, res) => {
  const where = { cliente: { fincaId: req.usuario.fincaId } };

  if (req.query.estado) where.estado = req.query.estado;
  if (req.query.clienteId) where.clienteId = Number(req.query.clienteId);
  if (req.query.conSaldo === 'true') where.saldo = { gt: 0 };
  if (req.query.desde) {
    where.fecha = { gte: new Date(req.query.desde) };
  }
  if (req.query.hasta) {
    where.fecha = { ...where.fecha, lte: new Date(req.query.hasta) };
  }

  const ventas = await prisma.venta.findMany({
    where,
    include: {
      cliente: { select: { nombre: true, tipo: true } },
      _count: { select: { detalles: true, cobros: true } },
    },
    orderBy: { fecha: 'desc' },
    take: 100,
  });
  res.json(ventas);
}));

r.get('/cuentas-por-cobrar', autorizar('ventas:leer'), asyncH(async (req, res) => {
  const ventas = await prisma.venta.findMany({
    where: {
      cliente: { fincaId: req.usuario.fincaId },
      saldo: { gt: 0 },
    },
    include: {
      cliente: { select: { nombre: true, tipo: true, telefono: true } },
    },
    orderBy: { fecha: 'asc' },
  });

  const resumen = {
    totalPorCobrar: ventas.reduce((sum, v) => sum + v.saldo, 0),
    totalVencido: ventas.filter(v => v.estado === 'VENCIDO').reduce((sum, v) => sum + v.saldo, 0),
    cantidadVentas: ventas.length,
    ventas,
  };

  res.json(resumen);
}));

r.get('/:id', autorizar('ventas:leer'), asyncH(async (req, res) => {
  await ventaPropia(req.usuario.fincaId, req.params.id);
  const venta = await prisma.venta.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      cliente: true,
      detalles: {
        orderBy: { id: 'asc' },
        include: {
          loteCosecha: {
            select: {
              id: true,
              codigo: true,
              tokenPublico: true,
              campania: {
                select: {
                  cultivo: true,
                  lote: { select: { codigo: true, nombre: true } },
                },
              },
            },
          },
        },
      },
      cobros: { orderBy: { fecha: 'desc' } },
    },
  });
  res.json(venta);
}));

r.post('/', autorizar('ventas:escribir'), validar(esquemaVenta), asyncH(async (req, res) => {
  const cliente = await prisma.cliente.findFirst({
    where: { id: req.body.clienteId, fincaId: req.usuario.fincaId },
  });
  if (!cliente) throw noEncontrado('Cliente');

  // ADR-010: no se vende un lote de cosecha que se cosechó dentro de la carencia (salvo PROPIETARIO con justificación)
  for (const d of req.body.detalles) {
    if (!d.loteCosechaId) continue;
    const lc = await prisma.loteCosecha.findFirst({ where: { id: d.loteCosechaId, campania: { lote: { fincaId: req.usuario.fincaId } } } });
    if (!lc) throw noEncontrado(`Lote de cosecha ${d.loteCosechaId}`);
    const c = await loteCosechaEnCarencia(lc.id);
    if (!c.enCarencia) continue;
    const forzar = req.query.forzar === 'true' && req.usuario.rol === 'PROPIETARIO';
    if (!forzar) return res.status(409).json({ error: 'CARENCIA_VIGENTE', mensaje: c.mensaje, detalles: { loteCosecha: c.codigo, puedeForzar: req.usuario.rol === 'PROPIETARIO' } });
    if (!req.body.justificacion || req.body.justificacion.trim().length < 10) throw solicitudInvalida('Justificación requerida (mínimo 10 caracteres) para vender un lote cosechado en carencia');
    await auditar({ usuarioId: req.usuario.id, fincaId: req.usuario.fincaId, accion: 'FORZAR_CARENCIA', entidad: 'Venta', detalle: `${c.mensaje} Justificación: ${req.body.justificacion}` });
  }

  const total = req.body.detalles.reduce((sum, d) => sum + d.subtotal, 0);
  const fecha = req.body.fecha || new Date();

  const operaciones = [];

  // M6: los plantines salen del stock del lote del vivero
  for (const detalle of req.body.detalles) {
    if (!detalle.lotePlantinId) continue;
    const lp = await prisma.lotePlantin.findFirst({ where: { id: detalle.lotePlantinId, fincaId: req.usuario.fincaId } });
    if (!lp) throw noEncontrado(`Lote de plantines ${detalle.lotePlantinId}`);
    const libres = disponibles(lp);
    if (libres < detalle.cantidad) throw solicitudInvalida(`Plantines insuficientes en ${lp.codigo}: hay ${libres} disponibles`);
  }

  for (const detalle of req.body.detalles) {
    if (detalle.productoId) {
      const producto = await prisma.productoCosechado.findFirst({
        where: { id: detalle.productoId, fincaId: req.usuario.fincaId },
      });
      if (!producto) {
        throw noEncontrado(`Producto con ID ${detalle.productoId}`);
      }
      if (producto.stock < detalle.cantidad) {
        throw solicitudInvalida(
          `Stock insuficiente de ${producto.nombre}: hay ${producto.stock} ${producto.unidad}, se requieren ${detalle.cantidad}`
        );
      }
    }
  }

  const venta = await prisma.$transaction(async (tx) => {
    const ventaCreada = await tx.venta.create({
      data: {
        clienteId: req.body.clienteId,
        fecha,
        total,
        pagado: 0,
        saldo: total,
        estado: 'PENDIENTE',
        notas: req.body.notas || null,
        detalles: {
          create: req.body.detalles.map(d => ({
            producto: d.producto,
            cantidad: d.cantidad,
            unidad: d.unidad,
            precioBs: d.precioBs,
            subtotal: d.subtotal,
            loteCosechaId: d.loteCosechaId || null,
            lotePlantinId: d.lotePlantinId || null,
          })),
        },
      },
      include: {
        cliente: { select: { nombre: true } },
        detalles: true,
      },
    });

    for (const detalle of req.body.detalles) {
      if (detalle.lotePlantinId) {
        const lp = await tx.lotePlantin.update({ where: { id: detalle.lotePlantinId }, data: { vendidos: { increment: Math.round(detalle.cantidad) } } });
        const etapa = etapaSegunStock(lp);
        if (etapa !== lp.etapa) await tx.lotePlantin.update({ where: { id: lp.id }, data: { etapa } });
      }
      if (detalle.productoId) {
        await tx.movimientoProducto.create({
          data: {
            productoId: detalle.productoId,
            tipo: 'SALIDA',
            cantidad: detalle.cantidad,
            motivo: 'VENTA',
            referencia: `Venta #${ventaCreada.id}`,
          },
        });

        await tx.productoCosechado.update({
          where: { id: detalle.productoId },
          data: { stock: { decrement: detalle.cantidad } },
        });
      }
    }

    return ventaCreada;
  });

  await auditar({
    usuarioId: req.usuario.id,
    fincaId: req.usuario.fincaId,
    accion: 'CREAR',
    entidad: 'Venta',
    entidadId: venta.id,
    detalle: `${total} Bs - ${cliente.nombre}`,
  });

  res.status(201).json(venta);
}));

const esquemaCobro = z.object({
  montoBs: z.number().positive(),
  metodo: z.enum(['EFECTIVO', 'TRANSFERENCIA', 'QR']).optional(),
  recibo: z.string().max(60).nullable().optional(),
  fecha: z.coerce.date().optional(),
});

r.post('/:id/cobros', autorizar('ventas:escribir'), validar(esquemaCobro), asyncH(async (req, res) => {
  const venta = await ventaPropia(req.usuario.fincaId, req.params.id);

  if (req.body.montoBs > venta.saldo) {
    throw solicitudInvalida(
      `El monto (${req.body.montoBs} Bs) excede el saldo pendiente (${venta.saldo} Bs)`
    );
  }

  const nuevoPagado = venta.pagado + req.body.montoBs;
  const nuevoSaldo = venta.total - nuevoPagado;
  const nuevoEstado = calcularEstado(venta.total, nuevoPagado, venta.fecha);

  const resultado = await prisma.$transaction(async (tx) => {
    const cobro = await tx.cobro.create({
      data: {
        ventaId: venta.id,
        montoBs: req.body.montoBs,
        metodo: req.body.metodo || 'EFECTIVO',
        recibo: req.body.recibo || null,
        fecha: req.body.fecha || new Date(),
      },
    });

    const ventaActualizada = await tx.venta.update({
      where: { id: venta.id },
      data: {
        pagado: nuevoPagado,
        saldo: nuevoSaldo,
        estado: nuevoEstado,
      },
      include: {
        cliente: { select: { nombre: true } },
        detalles: true,
        cobros: { orderBy: { fecha: 'desc' } },
      },
    });

    return { cobro, venta: ventaActualizada };
  });

  await auditar({
    usuarioId: req.usuario.id,
    fincaId: req.usuario.fincaId,
    accion: 'CREAR',
    entidad: 'Cobro',
    entidadId: resultado.cobro.id,
    detalle: `${req.body.montoBs} Bs - Venta #${venta.id}`,
  });

  res.status(201).json(resultado);
}));

export default r;
