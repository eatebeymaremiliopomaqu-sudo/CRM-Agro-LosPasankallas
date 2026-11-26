// M3 · Reglas puras de tareas asignadas (sin BD, se prueban en tests/unit).

export const PRIORIDADES_TAREA = ['BAJA', 'MEDIA', 'ALTA', 'URGENTE'];
export const ESTADOS_TAREA = ['PENDIENTE', 'EN_CURSO', 'COMPLETADA', 'CANCELADA'];

// Transiciones permitidas por acción.
const TRANSICIONES = Object.freeze({
  iniciar: { desde: ['PENDIENTE'], hacia: 'EN_CURSO' },
  completar: { desde: ['PENDIENTE', 'EN_CURSO'], hacia: 'COMPLETADA' },
  cancelar: { desde: ['PENDIENTE', 'EN_CURSO'], hacia: 'CANCELADA' },
});

const MENSAJES = {
  iniciar: 'Solo se pueden iniciar tareas pendientes',
  completar: 'Solo se pueden completar tareas pendientes o en curso',
  cancelar: 'Solo se pueden cancelar tareas pendientes o en curso',
};

/**
 * Valida una transición de estado.
 * @returns {{ ok: true, estado: string } | { ok: false, error: string }}
 */
export function transicionTarea(estadoActual, accion) {
  const t = TRANSICIONES[accion];
  if (!t) return { ok: false, error: `Acción desconocida: ${accion}` };
  if (!t.desde.includes(estadoActual)) return { ok: false, error: MENSAJES[accion] };
  return { ok: true, estado: t.hacia };
}

/**
 * Un trabajador solo gestiona sus propias tareas; PROPIETARIO y ENCARGADO gestionan todas.
 */
export function puedeGestionarTarea(usuario, tarea) {
  if (!usuario || !tarea) return false;
  if (usuario.rol === 'PROPIETARIO' || usuario.rol === 'ENCARGADO') return true;
  return usuario.trabajadorId != null && usuario.trabajadorId === tarea.trabajadorId;
}

const ORDEN_ESTADO = { EN_CURSO: 0, PENDIENTE: 1, COMPLETADA: 2, CANCELADA: 3 };
const ORDEN_PRIORIDAD = { URGENTE: 0, ALTA: 1, MEDIA: 2, BAJA: 3 };

/** Ordena: activas primero, luego por prioridad (urgente primero) y por vencimiento más próximo. */
export function ordenarTareas(tareas) {
  const venc = (t) => (t.fechaVencimiento ? new Date(t.fechaVencimiento).getTime() : Number.POSITIVE_INFINITY);
  return [...tareas].sort(
    (a, b) =>
      (ORDEN_ESTADO[a.estado] ?? 9) - (ORDEN_ESTADO[b.estado] ?? 9) ||
      (ORDEN_PRIORIDAD[a.prioridad] ?? 9) - (ORDEN_PRIORIDAD[b.prioridad] ?? 9) ||
      venc(a) - venc(b)
  );
}

/** Una tarea está vencida si sigue activa y ya terminó el día de su fecha límite. */
export function tareaVencida(tarea, ahora = new Date()) {
  if (!tarea.fechaVencimiento) return false;
  if (!['PENDIENTE', 'EN_CURSO'].includes(tarea.estado)) return false;
  return new Date(tarea.fechaVencimiento).getTime() + 86400000 <= ahora.getTime();
}

/** Texto del aviso de WhatsApp al asignar una tarea (sin emojis de prioridad que confundan). */
export function mensajeTareaAsignada(tarea) {
  const partes = [`📋 Nueva tarea asignada: *${tarea.titulo}*`];
  if (tarea.descripcion) partes.push(tarea.descripcion);
  if (tarea.lote) partes.push(`Lote: ${tarea.lote.codigo} (${tarea.lote.nombre})`);
  partes.push(`Prioridad: ${tarea.prioridad}`);
  if (tarea.fechaVencimiento) partes.push(`Para: ${new Date(tarea.fechaVencimiento).toLocaleDateString('es-BO', { timeZone: 'UTC' })}`);
  partes.push('Cuando termines, responde: "tarea hecha" o márcala en la app. Escribe BAJA para no recibir más avisos.');
  return partes.join('\n');
}
