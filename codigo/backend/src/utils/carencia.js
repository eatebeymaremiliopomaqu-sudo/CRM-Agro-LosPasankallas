// Validación de período de carencia de aplicaciones fitosanitarias
import { prisma } from '../db.js';
import { auditar } from './auditoria.js';
import { ErrorHttp } from './errores.js';

const ddmmaaaa = (f) => new Date(f).toLocaleDateString('es-BO', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' });

/** Mensaje de la guía: "El lote L-02 está en carencia hasta el 30/11/2026 por FitoVerde". */
export function mensajeCarencia({ codigoLote, producto, fechaAplicacion, dias, fechaFin }) {
  return `El lote ${codigoLote} está en carencia hasta el ${ddmmaaaa(fechaFin)} por ${producto} (aplicado el ${ddmmaaaa(fechaAplicacion)}, carencia de ${dias} días).`;
}

/**
 * Calcula si un lote está en período de carencia por aplicaciones fitosanitarias.
 * @param {number} loteId
 * @param {Date} fechaActual
 * @returns {Promise<{ enCarencia: boolean, aplicacion?: object, fechaFinCarencia?: Date }>}
 */
export async function verificarCarencia(loteId, fechaActual = new Date()) {
  // Buscar la aplicación más reciente en el lote que tenga período de carencia
  const aplicaciones = await prisma.labor.findMany({
    where: {
      loteId,
      tipo: { in: ['FUMIGACION', 'FERTILIZACION'] },
      aplicacion: {
        periodoCarenciaDias: { gt: 0 }
      }
    },
    include: {
      aplicacion: true,
      lote: { select: { codigo: true, nombre: true } }
    },
    orderBy: { fecha: 'desc' },
    take: 10
  });

  // Verificar cada aplicación para ver si está en período de carencia
  for (const labor of aplicaciones) {
    if (!labor.aplicacion || !labor.aplicacion.periodoCarenciaDias) continue;

    const fechaFinCarencia = new Date(labor.fecha);
    fechaFinCarencia.setDate(fechaFinCarencia.getDate() + labor.aplicacion.periodoCarenciaDias);

    if (fechaActual < fechaFinCarencia) {
      return {
        enCarencia: true,
        aplicacion: {
          ...labor.aplicacion,
          fechaAplicacion: labor.fecha,
          lote: labor.lote
        },
        fechaFinCarencia
      };
    }
  }

  return { enCarencia: false };
}

/**
 * Middleware para rutas que necesitan validar carencia antes de procesar.
 * Si el usuario es PROPIETARIO y envía ?forzar=true, permite con advertencia y auditoría.
 * Si no, retorna HTTP 409 (Conflict) con mensaje claro.
 */
export function requiereRespetarCarencia(req, res, next) {
  // Este middleware se usa en rutas específicas, la lógica real está en el handler
  // porque necesitamos acceso al loteId que puede venir del body
  next();
}

/**
 * Verifica carencia y aplica las políticas de negocio.
 * @param {number} loteId
 * @param {object} usuario - Usuario que hace la operación
 * @param {boolean} forzar - Si se fuerza la operación (solo PROPIETARIO)
 * @param {string} justificacion - Justificación para forzar (requerida si forzar=true)
 * @returns {Promise<{permitido: boolean, advertencia?: string}>}
 */
export async function validarCarenciaParaCosecha(loteId, usuario, forzar = false, justificacion = null) {
  const resultado = await verificarCarencia(loteId);

  if (!resultado.enCarencia) {
    return { permitido: true };
  }

  // Lote en carencia
  const mensaje = mensajeCarencia({
    codigoLote: resultado.aplicacion.lote?.codigo ?? `#${loteId}`,
    producto: resultado.aplicacion.producto,
    fechaAplicacion: resultado.aplicacion.fechaAplicacion,
    dias: resultado.aplicacion.periodoCarenciaDias,
    fechaFin: resultado.fechaFinCarencia,
  });

  // Si es PROPIETARIO y quiere forzar
  if (usuario.rol === 'PROPIETARIO' && forzar) {
    if (!justificacion || justificacion.trim().length < 10) {
      throw new ErrorHttp(400, 'Justificación requerida (mínimo 10 caracteres) para forzar cosecha en período de carencia');
    }

    // Auditar la operación forzada
    await auditar({
      usuarioId: usuario.id,
      fincaId: usuario.fincaId,
      accion: 'FORZAR_CARENCIA',
      entidad: 'LoteCosecha',
      entidadId: loteId,
      detalle: `ADVERTENCIA: Cosecha forzada en período de carencia. ${mensaje} Justificación: ${justificacion}`
    });

    return {
      permitido: true,
      advertencia: `Cosecha forzada en período de carencia. ${mensaje}`
    };
  }

  // No permitido
  throw new CarenciaError(mensaje, resultado);
}

/**
 * Error personalizado para período de carencia
 */
export class CarenciaError extends Error {
  constructor(mensaje, detalles) {
    super(mensaje);
    this.name = 'CarenciaError';
    this.statusCode = 409; // Conflict
    this.detalles = detalles;
  }
}

/**
 * ADR-010 · Venta: un lote de cosecha "está en carencia" si se cosechó antes de que terminara
 * la carencia de alguna aplicación de su campaña (solo pasa si el propietario forzó la cosecha).
 * @returns {Promise<{ enCarencia: boolean, mensaje?: string, codigo?: string }>}
 */
export async function loteCosechaEnCarencia(loteCosechaId) {
  const lc = await prisma.loteCosecha.findUnique({
    where: { id: loteCosechaId },
    include: {
      campania: {
        include: {
          lote: { select: { codigo: true } },
          labores: { where: { aplicacion: { periodoCarenciaDias: { gt: 0 } } }, include: { aplicacion: true } },
        },
      },
    },
  });
  if (!lc) return { enCarencia: false };
  const cosecha = new Date(lc.fechaCosecha);
  for (const l of lc.campania.labores) {
    if (new Date(l.fecha) > cosecha) continue; // aplicación posterior: no afecta a esta cosecha
    const fin = new Date(new Date(l.fecha).getTime() + l.aplicacion.periodoCarenciaDias * 86400000);
    if (cosecha < fin) {
      return {
        enCarencia: true,
        codigo: lc.codigo,
        mensaje: `El lote de cosecha ${lc.codigo} se cosechó dentro de la carencia. ` + mensajeCarencia({ codigoLote: lc.campania.lote.codigo, producto: l.aplicacion.producto, fechaAplicacion: l.fecha, dias: l.aplicacion.periodoCarenciaDias, fechaFin: fin }),
      };
    }
  }
  return { enCarencia: false };
}
