-- Consultas SQL clave de CRM-Agro (SQLite). Se explican en el informe (sección "Base de datos").
-- Las fechas de Prisma en SQLite se guardan como enteros en milisegundos.
-- La trazabilidad completa está en src/services/trazabilidad.js (se ejecuta en GET /api/publico/lotes/:token/sql).

-- ① COSTO, INGRESO Y MARGEN POR LOTE DE CAMPO (M7)
WITH labores AS (
  SELECT lab.loteId,
         SUM(lab.costoBs)                                    AS costoLabores,
         SUM(COALESCE(ap.cantidadUsada, 0) * COALESCE(ins.costoUnitBs, 0)) AS costoInsumos
  FROM Labor lab
  LEFT JOIN Aplicacion ap ON ap.laborId = lab.id
  LEFT JOIN Insumo ins    ON ins.id = ap.insumoId
  GROUP BY lab.loteId
),
jornales AS (
  SELECT a.loteId, SUM(a.horas / 8.0 * t.jornalBs) AS costoJornales
  FROM Asistencia a
  JOIN Trabajador t ON t.id = a.trabajadorId
  WHERE a.loteId IS NOT NULL
  GROUP BY a.loteId
),
ingresos AS (
  SELECT c.loteId, SUM(dv.subtotal) AS ingresos
  FROM DetalleVenta dv
  JOIN LoteCosecha lc ON lc.id = dv.loteCosechaId
  JOIN Campania c     ON c.id = lc.campaniaId
  GROUP BY c.loteId
)
SELECT l.codigo,
       ROUND(COALESCE(lb.costoLabores, 0) + COALESCE(j.costoJornales, 0) + COALESCE(lb.costoInsumos, 0), 2) AS costoTotal,
       ROUND(COALESCE(i.ingresos, 0), 2) AS ingresos,
       ROUND(COALESCE(i.ingresos, 0) - (COALESCE(lb.costoLabores, 0) + COALESCE(j.costoJornales, 0) + COALESCE(lb.costoInsumos, 0)), 2) AS margen
FROM Lote l
LEFT JOIN labores  lb ON lb.loteId = l.id
LEFT JOIN jornales j  ON j.loteId  = l.id
LEFT JOIN ingresos i  ON i.loteId  = l.id
WHERE l.fincaId = ?
ORDER BY l.codigo;

-- ② CUENTAS POR COBRAR POR CLIENTE (M5): saldo y ventas vencidas (más de 7 días)
SELECT cl.nombre,
       COUNT(v.id)                                   AS ventasConSaldo,
       ROUND(SUM(v.saldo), 2)                        AS saldoBs,
       SUM(CASE WHEN v.fecha < (CAST(strftime('%s','now') AS INTEGER) - 7 * 86400) * 1000 THEN 1 ELSE 0 END) AS vencidas
FROM Venta v
JOIN Cliente cl ON cl.id = v.clienteId
WHERE cl.fincaId = ? AND v.saldo > 0
GROUP BY cl.id
ORDER BY saldoBs DESC;

-- ③ LOTES EN CARENCIA HOY (M1): aplicación + días de carencia aún no cumplidos
SELECT l.codigo, ap.producto,
       datetime((lab.fecha + ap.periodoCarenciaDias * 86400000) / 1000, 'unixepoch') AS finCarencia
FROM Aplicacion ap
JOIN Labor lab ON lab.id = ap.laborId
JOIN Lote l    ON l.id = lab.loteId
WHERE l.fincaId = ?
  AND ap.periodoCarenciaDias > 0
  AND lab.fecha + ap.periodoCarenciaDias * 86400000 > CAST(strftime('%s','now') AS INTEGER) * 1000
ORDER BY finCarencia DESC;
