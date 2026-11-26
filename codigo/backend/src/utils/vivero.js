// M6 · Vivero: reglas puras de los lotes de plantines.

export const ETAPAS_PLANTIN = ['SIEMBRA', 'GERMINACION', 'CRECIMIENTO', 'LISTO', 'AGOTADO'];

/** % de germinación = germinadas / semillas sembradas × 100 (1 decimal). */
export function porcentajeGerminacion({ germinadas = 0, semillasSembradas = 0 }) {
  if (!semillasSembradas) return 0;
  return Math.round((germinadas / semillasSembradas) * 1000) / 10;
}

/** Plantines disponibles para la venta = germinadas − merma − vendidos (nunca negativo). */
export function disponibles({ germinadas = 0, merma = 0, vendidos = 0 }) {
  return Math.max(0, germinadas - merma - vendidos);
}

/** Costo unitario de producción = costo total / plantines útiles (germinadas − merma). */
export function costoUnitario({ costoBs = 0, germinadas = 0, merma = 0 }) {
  const utiles = germinadas - merma;
  return utiles > 0 ? Math.round((costoBs / utiles) * 100) / 100 : null;
}

/** Valida un conteo antes de guardarlo. Devuelve lista de errores (vacía si es válido). */
export function validarConteo(lp) {
  const e = [];
  if (lp.germinadas > lp.semillasSembradas) e.push('Las germinadas no pueden superar a las semillas sembradas');
  if (lp.merma > lp.germinadas) e.push('La merma no puede superar a las germinadas');
  if ((lp.vendidos ?? 0) > lp.germinadas - lp.merma) e.push('No puede haber más vendidos que plantines útiles');
  for (const k of ['germinadas', 'merma', 'semillasSembradas']) if (lp[k] < 0) e.push(`${k} no puede ser negativo`);
  return e;
}

/** Si se agotó el stock, la etapa pasa a AGOTADO; si vuelve a haber stock, a LISTO. */
export function etapaSegunStock(lp) {
  const d = disponibles(lp);
  if (d === 0 && ['LISTO', 'AGOTADO'].includes(lp.etapa) && lp.germinadas > 0) return 'AGOTADO';
  if (d > 0 && lp.etapa === 'AGOTADO') return 'LISTO';
  return lp.etapa;
}

export const conIndicadores = (lp) => ({
  ...lp,
  porcentajeGerminacion: porcentajeGerminacion(lp),
  disponibles: disponibles(lp),
  costoUnitario: costoUnitario(lp),
});
