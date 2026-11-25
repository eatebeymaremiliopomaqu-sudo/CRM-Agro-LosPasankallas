// M3 · Trazabilidad: lotes de cosecha, eventos de la cadena y código QR público.
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { autorizar } from '../middleware/auth.js';
import { validar } from '../middleware/validar.js';
import { asyncH, noEncontrado } from '../utils/errores.js';
import { auditar } from '../utils/auditoria.js';
import { crearLote, qrDeLote, urlPublicaLote } from '../services/lotes.js';
import { TIPOS_EVENTO } from '../constantes.js';

export const privado = Router();
export const publico = Router();

const incluirLoteCosecha = {
  campania: { include: { lote: { select: { id: true, codigo: true, nombre: true } } } },
  eventos: { orderBy: { fecha: 'asc' } },
};

async function loteCosechaPropio(req) {
  const lc = await prisma.loteCosecha.findFirst({ where: { id: Number(req.params.id), campania: { lote: { fincaId: req.usuario.fincaId } } }, include: incluirLoteCosecha });
  if (!lc) throw noEncontrado('Lote de cosecha');
  return lc;
}

privado.get('/lotes', autorizar('trazabilidad:leer'), asyncH(async (req, res) => {
  const lotesCosecha = await prisma.loteCosecha.findMany({
    where: { campania: { lote: { fincaId: req.usuario.fincaId } } },
    include: incluirLoteCosecha,
    orderBy: { fechaCosecha: 'desc' },
  });
  res.json(lotesCosecha.map((lc) => ({ ...lc, urlPublica: urlPublicaLote(lc.tokenPublico) })));
}));

const esquemaLoteCosecha = z.object({
  campaniaId: z.number().int().positive(),
  fechaCosecha: z.coerce.date(),
  cantidadKg: z.number().positive().max(1000000),
  calidad: z.enum(['PRIMERA', 'SEGUNDA', 'DESCARTE']).optional(),
  destino: z.string().max(120).nullable().optional(),
});

privado.post('/lotes', autorizar('trazabilidad:escribir'), validar(esquemaLoteCosecha), asyncH(async (req, res) => {
  const loteCosecha = await crearLote({ fincaId: req.usuario.fincaId, ...req.body });
  await auditar({ usuarioId: req.usuario.id, fincaId: req.usuario.fincaId, accion: 'CREAR', entidad: 'LoteCosecha', entidadId: loteCosecha.id, detalle: loteCosecha.codigo });
  res.status(201).json({ ...loteCosecha, urlPublica: urlPublicaLote(loteCosecha.tokenPublico) });
}));

privado.get('/lotes/:id', autorizar('trazabilidad:leer'), asyncH(async (req, res) => {
  const lc = await loteCosechaPropio(req);
  res.json({ ...lc, urlPublica: urlPublicaLote(lc.tokenPublico), qr: await qrDeLote(lc) });
}));

privado.get('/lotes/:id/qr.svg', autorizar('trazabilidad:leer'), asyncH(async (req, res) => {
  const lc = await loteCosechaPropio(req);
  res.type('image/svg+xml').send(await qrDeLote(lc, 'svg'));
}));

privado.post('/lotes/:id/eventos', autorizar('trazabilidad:escribir'),
  validar(z.object({ tipo: z.enum(TIPOS_EVENTO), fecha: z.coerce.date().optional(), detalle: z.string().max(300).nullable().optional() })),
  asyncH(async (req, res) => {
    const lc = await loteCosechaPropio(req);
    const e = await prisma.eventoTrazabilidad.create({ data: { ...req.body, loteId: lc.id } });
    await auditar({ usuarioId: req.usuario.id, fincaId: req.usuario.fincaId, accion: 'CREAR', entidad: 'EventoTrazabilidad', entidadId: e.id });
    res.status(201).json(e);
  }));

/**
 * Vista pública del QR: sólo datos que el consumidor puede ver.
 * No expone ids internos, trabajadores ni costos. Las aplicaciones se muestran
 * como producto + fecha + carencia (transparencia), nunca como recomendación.
 */
publico.get('/:token', asyncH(async (req, res) => {
  const token = String(req.params.token).slice(0, 64);
  const lc = await prisma.loteCosecha.findUnique({
    where: { tokenPublico: token },
    include: {
      eventos: { orderBy: { fecha: 'asc' }, select: { tipo: true, fecha: true, detalle: true } },
      campania: {
        include: {
          lote: { select: { codigo: true, nombre: true, finca: { select: { nombre: true, municipio: true, departamento: true } } } },
          labores: {
            where: { tipo: { in: ['SIEMBRA', 'RIEGO', 'FERTILIZACION', 'FUMIGACION', 'DESHIERBE', 'PODA', 'COSECHA'] } },
            orderBy: { fecha: 'asc' },
            select: { tipo: true, fecha: true, aplicacion: { select: { producto: true, periodoCarenciaDias: true } } },
          },
        },
      },
    },
  });
  if (!lc) throw noEncontrado('Lote de cosecha');
  const { campania } = lc;
  res.set('Cache-Control', 'public, max-age=300');
  res.json({
    codigo: lc.codigo,
    producto: campania.cultivo,
    variedad: campania.variedad,
    calidad: lc.calidad,
    cantidadKg: lc.cantidadKg,
    fechaSiembra: campania.fechaSiembra,
    fechaCosecha: lc.fechaCosecha,
    finca: campania.lote.finca,
    lote: `${campania.lote.codigo} · ${campania.lote.nombre}`,
    labores: campania.labores.map((x) => ({ tipo: x.tipo, fecha: x.fecha, producto: x.aplicacion?.producto || null, carenciaDias: x.aplicacion?.periodoCarenciaDias ?? null })),
    eventos: lc.eventos,
  });
}));
