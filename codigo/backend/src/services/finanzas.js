// M7 · Reportes y finanzas: costos por lote, ingresos y margen.
//
// FÓRMULAS (explicadas en el informe):
//   costo labores   = Σ labor.costoBs                                    (gastos directos: combustible, alquiler, servicios)
//   costo jornales  = Σ (asistencia.horas / 8) × trabajador.jornalBs      (asistencias registradas en el lote)
//   costo insumos   = Σ aplicacion.cantidadUsada × insumo.costoUnitBs     (insumos usados en las aplicaciones del lote)
//   costo total     = labores + jornales + insumos
//   ingresos        = Σ detalleVenta.subtotal de los lotes de cosecha del lote (trazabilidad cosecha → venta)
//   margen          = ingresos − costo total
//   margen %        = margen / ingresos × 100        (sin ingresos: no se calcula)
//   costo por kg    = costo total / kg cosechados
import { prisma } from '../db.js';
import { normalizar } from '../agente/guardrails.js';

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const HORAS_JORNAL = 8;

/** Busca el costo unitario del insumo de una aplicación: por vínculo directo o por nombre. */
export function costoUnitInsumo(aplicacion, insumos = []) {
  if (aplicacion.insumo) return aplicacion.insumo.costoUnitBs;
  const n = normalizar(aplicacion.producto);
  const i = insumos.find((x) => normalizar(x.nombre) === n);
  return i ? i.costoUnitBs : 0;
}

/**
 * Calcula costos, ingresos y márgenes por lote. Función pura.
 * @param {object} d { lotes, labores, asistencias, ventas (detalles con loteCosecha.campania.loteId), cosechas, insumos }
 */
export function calcularCostosPorLote({ lotes = [], labores = [], asistencias = [], detallesVenta = [], cosechas = [], insumos = [] }) {
  const filas = new Map(lotes.map((l) => [l.id, { loteId: l.id, codigo: l.codigo, nombre: l.nombre, cultivo: l.cultivo ?? null, costoLabores: 0, costoJornales: 0, costoInsumos: 0, ingresos: 0, kgCosechados: 0 }]));
  const fila = (id) => filas.get(id);

  for (const lab of labores) {
    const f = fila(lab.loteId);
    if (!f) continue;
    f.costoLabores += lab.costoBs || 0;
    if (lab.aplicacion?.cantidadUsada) f.costoInsumos += lab.aplicacion.cantidadUsada * costoUnitInsumo(lab.aplicacion, insumos);
  }
  for (const a of asistencias) {
    const f = fila(a.loteId);
    if (f) f.costoJornales += (a.horas / HORAS_JORNAL) * (a.trabajador?.jornalBs || 0);
  }
  for (const c of cosechas) {
    const f = fila(c.loteId);
    if (f) f.kgCosechados += c.cantidadKg;
  }
  let ingresosSinLote = 0;
  for (const d of detallesVenta) {
    const f = d.loteId != null ? fila(d.loteId) : null;
    if (f) f.ingresos += d.subtotal;
    else ingresosSinLote += d.subtotal;
  }

  const lista = [...filas.values()].map((f) => {
    const costoTotal = f.costoLabores + f.costoJornales + f.costoInsumos;
    const margen = f.ingresos - costoTotal;
    return {
      ...f,
      costoLabores: r2(f.costoLabores),
      costoJornales: r2(f.costoJornales),
      costoInsumos: r2(f.costoInsumos),
      costoTotal: r2(costoTotal),
      ingresos: r2(f.ingresos),
      margen: r2(margen),
      margenPct: f.ingresos > 0 ? Math.round((margen / f.ingresos) * 1000) / 10 : null,
      costoPorKg: f.kgCosechados > 0 ? r2(costoTotal / f.kgCosechados) : null,
      kgCosechados: r2(f.kgCosechados),
    };
  });

  const suma = (k) => r2(lista.reduce((s, f) => s + f[k], 0));
  const ingresos = r2(suma('ingresos') + ingresosSinLote);
  const costoTotal = suma('costoTotal');
  const margen = r2(ingresos - costoTotal);
  return {
    lotes: lista,
    totales: {
      costoLabores: suma('costoLabores'),
      costoJornales: suma('costoJornales'),
      costoInsumos: suma('costoInsumos'),
      costoTotal,
      ingresosLotes: suma('ingresos'),
      ingresosSinLote: r2(ingresosSinLote),
      ingresos,
      margen,
      margenPct: ingresos > 0 ? Math.round((margen / ingresos) * 1000) / 10 : null,
      kgCosechados: suma('kgCosechados'),
    },
  };
}

/** Ingresos por mes (YYYY-MM) a partir de las ventas. */
export function ingresosPorMes(ventas = []) {
  const m = {};
  for (const v of ventas) {
    const k = new Date(v.fecha).toISOString().slice(0, 7);
    m[k] = r2((m[k] || 0) + v.total);
  }
  return Object.entries(m).sort().map(([mes, total]) => ({ mes, total }));
}

/** Carga los datos de la finca y calcula. Filtros: desde, hasta (fechas) y campaniaId. */
export async function reporteCostos(fincaId, { desde, hasta, campaniaId } = {}) {
  const rango = desde || hasta ? { ...(desde && { gte: new Date(desde) }), ...(hasta && { lte: new Date(hasta) }) } : undefined;
  const campania = campaniaId ? await prisma.campania.findFirst({ where: { id: Number(campaniaId), lote: { fincaId } } }) : null;
  const filtroLote = campania ? { id: campania.loteId } : {};
  const [lotes, labores, asistencias, detalles, cosechas, insumos, ventas, plantines] = await Promise.all([
    prisma.lote.findMany({ where: { fincaId, ...filtroLote }, include: { campanias: { orderBy: { fechaSiembra: 'desc' }, take: 1 } }, orderBy: { codigo: 'asc' } }),
    prisma.labor.findMany({ where: { lote: { fincaId, ...filtroLote }, ...(rango && { fecha: rango }), ...(campania && { campaniaId: campania.id }) }, include: { aplicacion: { include: { insumo: true } } } }),
    prisma.asistencia.findMany({ where: { trabajador: { fincaId }, loteId: campania ? campania.loteId : { not: null }, ...(rango && { fecha: rango }) }, include: { trabajador: { select: { jornalBs: true } } } }),
    prisma.detalleVenta.findMany({ where: { venta: { cliente: { fincaId }, ...(rango && { fecha: rango }) }, ...(campania && { loteCosecha: { campaniaId: campania.id } }) }, include: { loteCosecha: { include: { campania: { select: { loteId: true } } } } } }),
    prisma.loteCosecha.findMany({ where: { campania: { lote: { fincaId, ...filtroLote } }, ...(rango && { fechaCosecha: rango }), ...(campania && { campaniaId: campania.id }) }, include: { campania: { select: { loteId: true } } } }),
    prisma.insumo.findMany({ where: { fincaId } }),
    prisma.venta.findMany({ where: { cliente: { fincaId }, ...(rango && { fecha: rango }) }, select: { fecha: true, total: true } }),
    prisma.lotePlantin.findMany({ where: { fincaId } }),
  ]);
  const resultado = calcularCostosPorLote({
    lotes: lotes.map((l) => ({ id: l.id, codigo: l.codigo, nombre: l.nombre, cultivo: l.campanias[0]?.cultivo })),
    labores,
    asistencias,
    detallesVenta: detalles
      .filter((d) => !d.lotePlantinId)
      .map((d) => ({ subtotal: d.subtotal, loteId: d.loteCosecha?.campania.loteId ?? null })),
    cosechas: cosechas.map((c) => ({ loteId: c.campania.loteId, cantidadKg: c.cantidadKg })),
    insumos,
  });
  // Vivero (M6): costo de producción e ingresos por plantines, aparte de los lotes de campo
  const ingresosPlantines = r2(detalles.filter((d) => d.lotePlantinId).reduce((s, d) => s + d.subtotal, 0));
  const costoPlantines = campania ? 0 : r2(plantines.reduce((s, p) => s + p.costoBs, 0));
  return {
    ...resultado,
    vivero: campania ? null : { costo: costoPlantines, ingresos: ingresosPlantines, margen: r2(ingresosPlantines - costoPlantines) },
    ingresosPorMes: ingresosPorMes(ventas),
    filtros: { desde: desde || null, hasta: hasta || null, campaniaId: campania?.id ?? null },
  };
}
