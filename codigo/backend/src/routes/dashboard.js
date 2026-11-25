// Tablero: indicadores y series para los gráficos (Chart.js)
import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncH } from '../utils/errores.js';
import { modulosDe } from '../utils/permisos.js';

const r = Router();

r.get('/', asyncH(async (req, res) => {
  const fincaId = req.usuario.fincaId;
  const hoy = new Date();
  const hace30 = new Date(hoy.getTime() - 30 * 86400000);
  const hace7 = new Date(hoy.getTime() - 7 * 86400000);
  const finca = await prisma.finca.findUnique({ where: { id: fincaId } });

  const [parcelas, trabajadores, laboresMes, alertas, lotes, laboresTipo, asistencias30, cosechasMes, insumosBajos] = await Promise.all([
    prisma.parcela.findMany({ where: { fincaId, activa: true }, select: { areaHa: true } }),
    prisma.trabajador.count({ where: { fincaId, activo: true } }),
    prisma.labor.count({ where: { parcela: { fincaId }, fecha: { gte: hace30 } } }),
    prisma.observacion.findMany({ where: { parcela: { fincaId }, severidad: { gte: 4 }, fecha: { gte: hace7 } }, include: { parcela: { select: { codigo: true } } }, orderBy: { fecha: 'desc' }, take: 5 }),
    prisma.loteCosecha.count({ where: { siembra: { parcela: { fincaId } } } }),
    prisma.labor.groupBy({ by: ['tipo'], where: { parcela: { fincaId }, fecha: { gte: hace30 } }, _count: { _all: true } }),
    prisma.asistencia.findMany({ where: { trabajador: { fincaId }, fecha: { gte: hace30 } }, select: { fecha: true, horas: true } }),
    prisma.loteCosecha.findMany({ where: { siembra: { parcela: { fincaId } } }, select: { fechaCosecha: true, cantidadKg: true, siembra: { select: { cultivo: true } } } }),
    prisma.insumo.findMany({ where: { fincaId }, select: { nombre: true, stock: true, stockMinimo: true, unidad: true } }),
  ]);

  // Horas trabajadas por día (últimos 30 días)
  const porDia = {};
  for (const a of asistencias30) {
    const k = a.fecha.toISOString().slice(0, 10);
    porDia[k] = (porDia[k] || 0) + a.horas;
  }
  // Kg cosechados por cultivo
  const porCultivo = {};
  for (const l of cosechasMes) porCultivo[l.siembra.cultivo] = (porCultivo[l.siembra.cultivo] || 0) + l.cantidadKg;

  res.json({
    modulos: modulosDe(finca),
    indicadores: {
      parcelas: parcelas.length,
      hectareas: Math.round(parcelas.reduce((s, p) => s + p.areaHa, 0) * 100) / 100,
      trabajadores,
      laboresMes,
      lotes,
      kgCosechados: Math.round(cosechasMes.reduce((s, l) => s + l.cantidadKg, 0)),
    },
    alertas: alertas.map((a) => ({ id: a.id, parcela: a.parcela.codigo, tipo: a.tipo, severidad: a.severidad, nota: a.nota, fecha: a.fecha })),
    insumosBajos: insumosBajos.filter((i) => i.stock <= i.stockMinimo),
    series: {
      laboresPorTipo: laboresTipo.map((x) => ({ tipo: x.tipo, cantidad: x._count._all })),
      horasPorDia: Object.entries(porDia).sort().map(([fecha, horas]) => ({ fecha, horas })),
      kgPorCultivo: Object.entries(porCultivo).map(([cultivo, kg]) => ({ cultivo, kg: Math.round(kg) })),
    },
  });
}));

export default r;
