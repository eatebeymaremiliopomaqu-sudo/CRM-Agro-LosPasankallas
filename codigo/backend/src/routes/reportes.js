// M7 · Reportes y finanzas: costos por lote, ingresos, margen (solo PROPIETARIO: finanzas:ver).
import { Router } from 'express';
import { prisma } from '../db.js';
import { autorizar } from '../middleware/auth.js';
import { asyncH } from '../utils/errores.js';
import { reporteCostos } from '../services/finanzas.js';

const r = Router();

const filtros = (q) => ({ desde: q.desde || undefined, hasta: q.hasta ? `${String(q.hasta).slice(0, 10)}T23:59:59.999Z` : undefined, campaniaId: q.campaniaId || undefined });

r.get('/costos', autorizar('finanzas:ver'), asyncH(async (req, res) => {
  res.json(await reporteCostos(req.usuario.fincaId, filtros(req.query)));
}));

// Campañas para el filtro
r.get('/campanias', autorizar('finanzas:ver'), asyncH(async (req, res) => {
  res.json(await prisma.campania.findMany({ where: { lote: { fincaId: req.usuario.fincaId } }, include: { lote: { select: { codigo: true } } }, orderBy: { fechaSiembra: 'desc' } }));
}));

const csv = (filas, columnas) => {
  const esc = (v) => (v == null ? '' : /[",;\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  return [columnas.map((c) => c[1]).join(';'), ...filas.map((f) => columnas.map((c) => esc(f[c[0]])).join(';'))].join('\r\n');
};

// Exportación CSV (separador ";" para abrir directo en Excel en español)
r.get('/costos.csv', autorizar('finanzas:ver'), asyncH(async (req, res) => {
  const rep = await reporteCostos(req.usuario.fincaId, filtros(req.query));
  const columnas = [
    ['codigo', 'Lote'], ['cultivo', 'Cultivo'], ['kgCosechados', 'Kg cosechados'], ['costoLabores', 'Costo labores (Bs)'], ['costoJornales', 'Costo jornales (Bs)'],
    ['costoInsumos', 'Costo insumos (Bs)'], ['costoTotal', 'Costo total (Bs)'], ['ingresos', 'Ingresos (Bs)'], ['margen', 'Margen (Bs)'], ['margenPct', 'Margen %'], ['costoPorKg', 'Costo por kg (Bs)'],
  ];
  res.type('text/csv; charset=utf-8').attachment('costos_por_lote.csv').send('﻿' + csv(rep.lotes, columnas));
}));

export default r;
