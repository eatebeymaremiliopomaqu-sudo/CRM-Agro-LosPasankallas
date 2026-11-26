// M2 · Trazabilidad completa de un lote de cosecha:
// lote de campo → campaña → labores (aplicaciones y carencia) → cosecha → eventos → ventas.
// La ficha pública NUNCA expone ids internos, trabajadores, responsables técnicos,
// precios ni datos personales de clientes (solo el tipo de cliente y la fecha).
import { prisma } from '../db.js';

const DIA_MS = 86400000;
export const LABORES_TRAZABLES = ['SIEMBRA', 'RIEGO', 'FERTILIZACION', 'FUMIGACION', 'DESHIERBE', 'PODA', 'COSECHA', 'MONITOREO'];

export const TIPOS_CLIENTE_PUBLICO = {
  MINORISTA: 'Venta minorista',
  MAYORISTA: 'Mercado mayorista',
  RESTAURANTE: 'Restaurante',
  MERCADO: 'Mercado local',
};

const includeFicha = {
  eventos: { orderBy: { fecha: 'asc' }, select: { tipo: true, fecha: true, detalle: true } },
  campania: {
    include: {
      lote: { select: { codigo: true, nombre: true, areaHa: true, tipoSuelo: true, riego: true, finca: { select: { nombre: true, municipio: true, departamento: true } } } },
      labores: {
        where: { tipo: { in: LABORES_TRAZABLES } },
        orderBy: { fecha: 'asc' },
        select: { tipo: true, fecha: true, descripcion: true, aplicacion: { select: { producto: true, motivo: true, ingredienteActivo: true, periodoCarenciaDias: true } } },
      },
    },
  },
  detallesVenta: { select: { cantidad: true, unidad: true, venta: { select: { fecha: true, cliente: { select: { tipo: true } } } } } },
};

/** Fecha en que termina la carencia (fecha de aplicación + días), o null. */
export function finCarencia(fechaAplicacion, dias) {
  if (!dias || dias <= 0) return null;
  return new Date(new Date(fechaAplicacion).getTime() + dias * DIA_MS);
}

/**
 * Convierte el lote de cosecha cargado por Prisma en la ficha pública.
 * Función pura: se prueba sin base de datos.
 */
export function armarFichaPublica(lc, ahora = new Date()) {
  const { campania } = lc;
  const cosecha = new Date(lc.fechaCosecha);
  // Solo el manejo HASTA la cosecha forma parte de la historia de este lote de cosecha.
  const labores = campania.labores.filter((l) => new Date(l.fecha) <= cosecha).map((l) => {
    const fin = finCarencia(l.fecha, l.aplicacion?.periodoCarenciaDias);
    return {
      tipo: l.tipo,
      fecha: l.fecha,
      descripcion: l.descripcion,
      producto: l.aplicacion?.producto ?? null,
      motivo: l.aplicacion?.motivo ?? null,
      ingredienteActivo: l.aplicacion?.ingredienteActivo ?? null,
      carenciaDias: l.aplicacion?.periodoCarenciaDias ?? null,
      fechaFinCarencia: fin,
      carenciaVigente: fin ? ahora < fin : false,
      // ¿Se cosechó respetando la carencia? (fecha de cosecha >= fin de carencia)
      carenciaRespetada: fin ? new Date(lc.fechaCosecha) >= fin : null,
    };
  });
  const ventas = (lc.detallesVenta || []).map((d) => ({
    fecha: d.venta.fecha,
    cantidad: d.cantidad,
    unidad: d.unidad,
    destino: TIPOS_CLIENTE_PUBLICO[d.venta.cliente?.tipo] || 'Venta',
  }));
  const aplicaciones = labores.filter((l) => l.producto);
  return {
    codigo: lc.codigo,
    producto: campania.cultivo,
    variedad: campania.variedad,
    calidad: lc.calidad,
    cantidadKg: lc.cantidadKg,
    destino: lc.destino,
    fechaSiembra: campania.fechaSiembra,
    fechaCosecha: lc.fechaCosecha,
    finca: { ...campania.lote.finca },
    lote: { codigo: campania.lote.codigo, nombre: campania.lote.nombre, areaHa: campania.lote.areaHa, tipoSuelo: campania.lote.tipoSuelo, riego: campania.lote.riego },
    labores,
    eventos: lc.eventos,
    ventas,
    resumen: {
      totalLabores: labores.length,
      aplicaciones: aplicaciones.length,
      carenciaRespetada: aplicaciones.every((a) => a.carenciaRespetada !== false),
      kgVendidos: ventas.filter((v) => v.unidad === 'kg').reduce((s, v) => s + v.cantidad, 0),
    },
  };
}

export async function obtenerFichaPublica(token) {
  const lc = await prisma.loteCosecha.findUnique({ where: { tokenPublico: String(token).slice(0, 64) }, include: includeFicha });
  return lc ? armarFichaPublica(lc) : null;
}

/**
 * Consultas SQL de trazabilidad (SQLite). Son las que se documentan en el informe y
 * se EJECUTAN de verdad en GET /api/publico/lotes/:token/sql (con el token como parámetro "?",
 * nunca concatenado). Prisma guarda DateTime en SQLite como entero en milisegundos.
 */
export const CONSULTAS_TRAZABILIDAD = [
  {
    nombre: 'origen',
    descripcion: 'Lote de cosecha → campaña → lote de campo → finca (INNER JOIN: relaciones obligatorias).',
    sql: `-- 1. Origen del lote de cosecha
SELECT lc.codigo,
       lc.cantidadKg,
       lc.calidad,
       lc.fechaCosecha,
       c.cultivo,
       c.variedad,
       c.fechaSiembra,
       l.codigo  AS loteCampo,
       l.nombre  AS nombreLote,
       l.areaHa,
       f.nombre  AS finca,
       f.municipio
FROM LoteCosecha lc
JOIN Campania c ON c.id = lc.campaniaId      -- ciclo de cultivo que produjo la cosecha
JOIN Lote     l ON l.id = c.loteId           -- lote de campo (parcela física)
JOIN Finca    f ON f.id = l.fincaId          -- finca de origen (sin datos del propietario)
WHERE lc.tokenPublico = ?;`,
  },
  {
    nombre: 'labores',
    descripcion: 'Labores de la campaña con su aplicación fitosanitaria (LEFT JOIN: no toda labor tiene aplicación) y cálculo de fin de carencia.',
    sql: `-- 2. Labores de campo y carencia
SELECT lab.tipo,
       lab.fecha,
       lab.descripcion,
       ap.producto,
       ap.motivo,
       ap.periodoCarenciaDias,
       -- fin de carencia = fecha de aplicación + días de carencia (fechas en ms)
       lab.fecha + COALESCE(ap.periodoCarenciaDias, 0) * 86400000 AS finCarencia,
       -- 1 si la cosecha se hizo DESPUÉS de terminar la carencia
       CASE WHEN ap.id IS NULL THEN NULL
            WHEN lc.fechaCosecha >= lab.fecha + COALESCE(ap.periodoCarenciaDias, 0) * 86400000 THEN 1
            ELSE 0 END AS carenciaRespetada
FROM LoteCosecha lc
JOIN Labor lab           ON lab.campaniaId = lc.campaniaId
LEFT JOIN Aplicacion ap  ON ap.laborId = lab.id
WHERE lc.tokenPublico = ?
  AND lab.tipo IN ('SIEMBRA','RIEGO','FERTILIZACION','FUMIGACION','DESHIERBE','PODA','COSECHA','MONITOREO')
  AND lab.fecha <= lc.fechaCosecha          -- solo el manejo previo a esta cosecha
ORDER BY lab.fecha;`,
  },
  {
    nombre: 'eventos',
    descripcion: 'Cadena post-cosecha: acopio, lavado, empaque, despacho.',
    sql: `-- 3. Eventos de la cadena post-cosecha
SELECT et.tipo, et.fecha, et.detalle
FROM EventoTrazabilidad et
JOIN LoteCosecha lc ON lc.id = et.loteId
WHERE lc.tokenPublico = ?
ORDER BY et.fecha;`,
  },
  {
    nombre: 'ventas',
    descripcion: 'Ventas que incluyen este lote de cosecha. Solo se proyecta el TIPO de cliente, nunca su nombre ni teléfono.',
    sql: `-- 4. Ventas del lote (anonimizadas)
SELECT v.fecha,
       dv.cantidad,
       dv.unidad,
       cl.tipo AS tipoCliente          -- MINORISTA | MAYORISTA | RESTAURANTE | MERCADO
FROM DetalleVenta dv
JOIN Venta       v  ON v.id  = dv.ventaId
JOIN Cliente     cl ON cl.id = v.clienteId
JOIN LoteCosecha lc ON lc.id = dv.loteCosechaId
WHERE lc.tokenPublico = ?
ORDER BY v.fecha;`,
  },
];

const aJson = (filas) =>
  filas.map((f) => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, typeof v === 'bigint' ? Number(v) : v])));

/** Ejecuta las consultas documentadas con el token como parámetro enlazado. */
export async function ejecutarConsultasTrazabilidad(token) {
  const t = String(token).slice(0, 64);
  const resultados = {};
  for (const c of CONSULTAS_TRAZABILIDAD) resultados[c.nombre] = aJson(await prisma.$queryRawUnsafe(c.sql, t));
  return resultados;
}
