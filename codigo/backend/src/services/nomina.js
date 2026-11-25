// Cálculo de jornales. Funciones puras: fáciles de probar y de explicar.
export const HORAS_JORNADA = 8;

const redondear = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

/** Días trabajados equivalentes a partir de horas (8 h = 1 jornal). */
export function diasEquivalentes(asistencias, horasJornada = HORAS_JORNADA) {
  if (!Array.isArray(asistencias)) throw new TypeError('asistencias debe ser un arreglo');
  const horas = asistencias.reduce((s, a) => {
    const h = Number(a.horas);
    if (!Number.isFinite(h) || h < 0 || h > 24) throw new RangeError(`Horas inválidas: ${a.horas}`);
    return s + h;
  }, 0);
  return redondear(horas / horasJornada);
}

export function calcularPago(asistencias, jornalBs, horasJornada = HORAS_JORNADA) {
  if (!(Number(jornalBs) >= 0)) throw new RangeError('El jornal debe ser un número positivo');
  const dias = diasEquivalentes(asistencias, horasJornada);
  return { dias, montoBs: redondear(dias * Number(jornalBs)) };
}

/** Resumen de planilla para varios trabajadores en un periodo. */
export function planilla(trabajadores, asistencias) {
  return trabajadores
    .map((t) => {
      const propias = asistencias.filter((a) => a.trabajadorId === t.id);
      const { dias, montoBs } = calcularPago(propias, t.jornalBs);
      return { trabajadorId: t.id, nombre: t.nombre, jornalBs: t.jornalBs, registros: propias.length, dias, montoBs };
    })
    .filter((f) => f.registros > 0)
    .sort((a, b) => b.montoBs - a.montoBs);
}
