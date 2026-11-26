// Qué puede pedir cada perfil al agente (web o WhatsApp). Funciones puras.
// Perfiles: PROPIETARIO, ENCARGADO, TRABAJADOR (usuarios o trabajadores de la finca) y CLIENTE.
import { INTENCIONES, TEMAS } from './parser.js';

export const PERFILES = Object.freeze({ PROPIETARIO: 'PROPIETARIO', ENCARGADO: 'ENCARGADO', TRABAJADOR: 'TRABAJADOR', CLIENTE: 'CLIENTE' });

const SIEMPRE = [INTENCIONES.CONFIRMAR, INTENCIONES.CANCELAR, INTENCIONES.AYUDA, INTENCIONES.DESCONOCIDA];

const PERMITIDAS = {
  PROPIETARIO: [INTENCIONES.REGISTRAR_LABOR, INTENCIONES.REGISTRAR_ASISTENCIA, INTENCIONES.REGISTRAR_OBSERVACION, INTENCIONES.REGISTRAR_COSECHA, INTENCIONES.MARCAR_TAREA_HECHA, INTENCIONES.CONSULTA],
  ENCARGADO: [INTENCIONES.REGISTRAR_LABOR, INTENCIONES.REGISTRAR_ASISTENCIA, INTENCIONES.REGISTRAR_OBSERVACION, INTENCIONES.REGISTRAR_COSECHA, INTENCIONES.MARCAR_TAREA_HECHA, INTENCIONES.CONSULTA],
  // ADR-015: el trabajador registra labores y observaciones simples, marca sus tareas y ve sus pendientes.
  TRABAJADOR: [INTENCIONES.REGISTRAR_LABOR, INTENCIONES.REGISTRAR_OBSERVACION, INTENCIONES.MARCAR_TAREA_HECHA, INTENCIONES.CONSULTA],
  CLIENTE: [INTENCIONES.PEDIDO_CLIENTE, INTENCIONES.CONSULTA],
};

const TEMAS_POR_PERFIL = {
  TRABAJADOR: [TEMAS.MIS_TAREAS, TEMAS.LABORES_PENDIENTES, TEMAS.CARENCIA_LOTE],
  CLIENTE: [TEMAS.PRECIOS],
};

const MOTIVOS = {
  TRABAJADOR: 'Con tu usuario de trabajador puedo registrar labores y observaciones, marcar tus tareas y mostrarte tus pendientes. Para eso otro, consulta con el encargado.',
  CLIENTE: 'Por este canal puedo tomar tu pedido y mostrarte los precios disponibles. Ejemplo: "quiero 3 cajas de frutilla para el viernes".',
  STAFF: 'Los pedidos de clientes se registran desde el módulo de Ventas o los envía el propio cliente por WhatsApp.',
};

/**
 * Decide si un perfil puede realizar la intención interpretada.
 * Puede ajustar el tema de consulta (p. ej. un cliente que pregunta por stock ve la lista de precios).
 * @returns {{ ok: true, intencion: string, datos: object } | { ok: false, motivo: string }}
 */
export function aplicarPolitica(perfil, intencion, datos = {}) {
  if (SIEMPRE.includes(intencion)) return { ok: true, intencion, datos };
  const permitidas = PERMITIDAS[perfil];
  if (!permitidas || !permitidas.includes(intencion)) {
    return { ok: false, motivo: MOTIVOS[perfil] || MOTIVOS.STAFF };
  }

  if (intencion === INTENCIONES.REGISTRAR_LABOR && perfil === PERFILES.TRABAJADOR) {
    // Nunca aplicaciones fitosanitarias ni fertilizaciones con producto desde el rol trabajador
    if (['FUMIGACION', 'FERTILIZACION'].includes(datos.tipo) || datos.producto) {
      return { ok: false, motivo: 'Las aplicaciones fitosanitarias y fertilizaciones las registra el encargado (por la carencia y la trazabilidad). Avísale para que lo registre.' };
    }
  }

  if (intencion === INTENCIONES.CONSULTA) {
    const temas = TEMAS_POR_PERFIL[perfil];
    if (temas && !temas.includes(datos.tema)) {
      // El cliente ve precios y disponibilidad; el trabajador, sus tareas.
      return { ok: true, intencion, datos: { ...datos, tema: temas[0] } };
    }
  }
  return { ok: true, intencion, datos };
}
