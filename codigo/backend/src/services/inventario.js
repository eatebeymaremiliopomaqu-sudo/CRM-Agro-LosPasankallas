// M4 · Una aplicación registrada puede descontar el insumo usado del inventario.
import { normalizar } from '../agente/guardrails.js';
import { ErrorHttp } from '../utils/errores.js';

const unidadNormal = (u) => ({ l: 'L', lt: 'L', litro: 'L', litros: 'L', ml: 'ml', g: 'g', kg: 'kg' })[normalizar(u)] || normalizar(u);

/**
 * Decide si se descuenta el insumo. Función pura.
 * @returns {{ descontar: boolean, motivo?: string }}
 */
export function evaluarDescuento(insumo, cantidad, unidad) {
  if (!insumo) return { descontar: false, motivo: 'SIN_INSUMO' };
  if (!cantidad || cantidad <= 0) return { descontar: false, motivo: 'SIN_CANTIDAD' };
  if (unidad && unidadNormal(unidad) !== unidadNormal(insumo.unidad)) return { descontar: false, motivo: 'UNIDAD_DISTINTA' };
  if (insumo.stock < cantidad) return { descontar: false, motivo: 'STOCK_INSUFICIENTE' };
  return { descontar: true };
}

/**
 * Busca el insumo (por id o por nombre del producto), descuenta el stock y registra la SALIDA.
 * Debe llamarse dentro de una transacción. Devuelve el insumoId a guardar en la aplicación.
 */
export async function descontarInsumoAplicacion(tx, fincaId, aplicacion, referencia) {
  let insumo = null;
  if (aplicacion.insumoId) {
    insumo = await tx.insumo.findFirst({ where: { id: aplicacion.insumoId, fincaId } });
    if (!insumo) throw new ErrorHttp(400, 'El insumo indicado no pertenece a la finca');
  } else if (aplicacion.producto) {
    const n = normalizar(aplicacion.producto);
    insumo = (await tx.insumo.findMany({ where: { fincaId } })).find((i) => normalizar(i.nombre) === n) || null;
  }
  const ev = evaluarDescuento(insumo, aplicacion.cantidadUsada, aplicacion.unidad);
  if (!ev.descontar && aplicacion.insumoId && ev.motivo === 'STOCK_INSUFICIENTE') {
    throw new ErrorHttp(400, `Stock insuficiente de ${insumo.nombre}: hay ${insumo.stock} ${insumo.unidad}`);
  }
  if (ev.descontar) {
    await tx.insumo.update({ where: { id: insumo.id }, data: { stock: { decrement: aplicacion.cantidadUsada } } });
    await tx.movimientoInsumo.create({ data: { insumoId: insumo.id, tipo: 'SALIDA', cantidad: aplicacion.cantidadUsada, motivo: `Aplicación ${referencia}` } });
  }
  return { insumoId: insumo?.id ?? null, descontado: ev.descontar, motivo: ev.motivo || null };
}
