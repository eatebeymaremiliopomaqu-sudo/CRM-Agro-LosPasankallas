// M6 · Vivero: lotes de plantines (siembra, germinación, merma, stock). La venta pasa por M5 (/api/ventas).
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { autorizar } from '../middleware/auth.js';
import { validar } from '../middleware/validar.js';
import { asyncH, noEncontrado, solicitudInvalida } from '../utils/errores.js';
import { auditar } from '../utils/auditoria.js';
import { ETAPAS_PLANTIN, conIndicadores, etapaSegunStock, validarConteo } from '../utils/vivero.js';

const r = Router();

const esquema = z.object({
  especie: z.string().trim().min(2).max(60),
  variedad: z.string().max(60).nullable().optional(),
  fechaSiembra: z.coerce.date(),
  bandejas: z.number().int().min(1).max(10000).optional(),
  semillasSembradas: z.number().int().min(1).max(1000000),
  germinadas: z.number().int().min(0).optional(),
  merma: z.number().int().min(0).optional(),
  etapa: z.enum(ETAPAS_PLANTIN).optional(),
  precioBs: z.number().min(0).max(10000).optional(),
  costoBs: z.number().min(0).max(10000000).optional(),
  fechaListo: z.coerce.date().nullable().optional(),
  notas: z.string().max(300).nullable().optional(),
});

async function lotePropio(fincaId, id) {
  const lp = await prisma.lotePlantin.findFirst({ where: { id: Number(id), fincaId } });
  if (!lp) throw noEncontrado('Lote de plantines');
  return lp;
}

r.get('/', autorizar('vivero:leer'), asyncH(async (req, res) => {
  const lista = await prisma.lotePlantin.findMany({ where: { fincaId: req.usuario.fincaId }, orderBy: { fechaSiembra: 'desc' } });
  res.json(lista.map(conIndicadores));
}));

r.post('/', autorizar('vivero:escribir'), validar(esquema), asyncH(async (req, res) => {
  const errores = validarConteo({ germinadas: 0, merma: 0, ...req.body });
  if (errores.length) throw solicitudInvalida('Conteo inválido', errores);
  const fincaId = req.usuario.fincaId;
  const anio = new Date(req.body.fechaSiembra).getUTCFullYear();
  const n = await prisma.lotePlantin.count({ where: { fincaId, codigo: { startsWith: `VIV-${anio}-` } } });
  const lp = await prisma.lotePlantin.create({ data: { ...req.body, fincaId, codigo: `VIV-${anio}-${String(n + 1).padStart(2, '0')}` } });
  await auditar({ usuarioId: req.usuario.id, fincaId, accion: 'CREAR', entidad: 'LotePlantin', entidadId: lp.id, detalle: lp.codigo });
  res.status(201).json(conIndicadores(lp));
}));

// Avance: conteo de germinadas, merma, etapa, precio
r.patch('/:id(\\d+)', autorizar('vivero:escribir'), validar(esquema.partial()), asyncH(async (req, res) => {
  const actual = await lotePropio(req.usuario.fincaId, req.params.id);
  const nuevo = { ...actual, ...req.body };
  const errores = validarConteo(nuevo);
  if (errores.length) throw solicitudInvalida('Conteo inválido', errores);
  const etapa = etapaSegunStock(nuevo);
  const lp = await prisma.lotePlantin.update({
    where: { id: actual.id },
    data: { ...req.body, etapa, ...(etapa === 'LISTO' && !actual.fechaListo && !req.body.fechaListo ? { fechaListo: new Date() } : {}) },
  });
  await auditar({ usuarioId: req.usuario.id, fincaId: req.usuario.fincaId, accion: 'ACTUALIZAR', entidad: 'LotePlantin', entidadId: lp.id, detalle: `germinadas ${lp.germinadas}, merma ${lp.merma}, etapa ${lp.etapa}` });
  res.json(conIndicadores(lp));
}));

export default r;
