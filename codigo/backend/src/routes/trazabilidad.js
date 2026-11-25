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

const incluirLote = {
  siembra: { include: { parcela: { select: { id: true, codigo: true, nombre: true } } } },
  eventos: { orderBy: { fecha: 'asc' } },
};

async function lotePropio(req) {
  const l = await prisma.loteCosecha.findFirst({ where: { id: Number(req.params.id), siembra: { parcela: { fincaId: req.usuario.fincaId } } }, include: incluirLote });
  if (!l) throw noEncontrado('Lote');
  return l;
}

privado.get('/lotes', autorizar('trazabilidad:leer'), asyncH(async (req, res) => {
  const lotes = await prisma.loteCosecha.findMany({
    where: { siembra: { parcela: { fincaId: req.usuario.fincaId } } },
    include: incluirLote,
    orderBy: { fechaCosecha: 'desc' },
  });
  res.json(lotes.map((l) => ({ ...l, urlPublica: urlPublicaLote(l.tokenPublico) })));
}));

const esquemaLote = z.object({
  siembraId: z.number().int().positive(),
  fechaCosecha: z.coerce.date(),
  cantidadKg: z.number().positive().max(1000000),
  calidad: z.enum(['PRIMERA', 'SEGUNDA', 'DESCARTE']).optional(),
  destino: z.string().max(120).nullable().optional(),
});

privado.post('/lotes', autorizar('trazabilidad:escribir'), validar(esquemaLote), asyncH(async (req, res) => {
  const lote = await crearLote({ fincaId: req.usuario.fincaId, ...req.body });
  await auditar({ usuarioId: req.usuario.id, fincaId: req.usuario.fincaId, accion: 'CREAR', entidad: 'LoteCosecha', entidadId: lote.id, detalle: lote.codigo });
  res.status(201).json({ ...lote, urlPublica: urlPublicaLote(lote.tokenPublico) });
}));

privado.get('/lotes/:id', autorizar('trazabilidad:leer'), asyncH(async (req, res) => {
  const l = await lotePropio(req);
  res.json({ ...l, urlPublica: urlPublicaLote(l.tokenPublico), qr: await qrDeLote(l) });
}));

privado.get('/lotes/:id/qr.svg', autorizar('trazabilidad:leer'), asyncH(async (req, res) => {
  const l = await lotePropio(req);
  res.type('image/svg+xml').send(await qrDeLote(l, 'svg'));
}));

privado.post('/lotes/:id/eventos', autorizar('trazabilidad:escribir'),
  validar(z.object({ tipo: z.enum(TIPOS_EVENTO), fecha: z.coerce.date().optional(), detalle: z.string().max(300).nullable().optional() })),
  asyncH(async (req, res) => {
    const l = await lotePropio(req);
    const e = await prisma.eventoTrazabilidad.create({ data: { ...req.body, loteId: l.id } });
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
  const l = await prisma.loteCosecha.findUnique({
    where: { tokenPublico: token },
    include: {
      eventos: { orderBy: { fecha: 'asc' }, select: { tipo: true, fecha: true, detalle: true } },
      siembra: {
        include: {
          parcela: { select: { codigo: true, nombre: true, finca: { select: { nombre: true, municipio: true, departamento: true } } } },
          labores: {
            where: { tipo: { in: ['SIEMBRA', 'RIEGO', 'FERTILIZACION', 'FUMIGACION', 'DESHIERBE', 'PODA', 'COSECHA'] } },
            orderBy: { fecha: 'asc' },
            select: { tipo: true, fecha: true, aplicacion: { select: { producto: true, periodoCarenciaDias: true } } },
          },
        },
      },
    },
  });
  if (!l) throw noEncontrado('Lote');
  const { siembra } = l;
  res.set('Cache-Control', 'public, max-age=300');
  res.json({
    codigo: l.codigo,
    producto: siembra.cultivo,
    variedad: siembra.variedad,
    calidad: l.calidad,
    cantidadKg: l.cantidadKg,
    fechaSiembra: siembra.fechaSiembra,
    fechaCosecha: l.fechaCosecha,
    finca: siembra.parcela.finca,
    parcela: `${siembra.parcela.codigo} · ${siembra.parcela.nombre}`,
    labores: siembra.labores.map((x) => ({ tipo: x.tipo, fecha: x.fecha, producto: x.aplicacion?.producto || null, carenciaDias: x.aplicacion?.periodoCarenciaDias ?? null })),
    eventos: l.eventos,
  });
}));
