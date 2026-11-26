// Etiquetas y reglas de presentación de las tareas (M3).
export const ETIQUETAS_PRIORIDAD = { BAJA: 'Baja', MEDIA: 'Media', ALTA: 'Alta', URGENTE: 'Urgente' };
export const CLASE_PRIORIDAD = { BAJA: 'azul', MEDIA: '', ALTA: 'ambar', URGENTE: 'rojo' };
export const ETIQUETAS_ESTADO_TAREA = { PENDIENTE: 'Pendiente', EN_CURSO: 'En curso', COMPLETADA: 'Completada', CANCELADA: 'Cancelada' };
export const CLASE_ESTADO_TAREA = { PENDIENTE: 'ambar', EN_CURSO: 'azul', COMPLETADA: '', CANCELADA: 'gris' };

export function tareaVencida(t, ahora = new Date()) {
  if (!t?.fechaVencimiento || !['PENDIENTE', 'EN_CURSO'].includes(t.estado)) return false;
  // Vence al terminar el día indicado
  return new Date(t.fechaVencimiento).getTime() + 86400000 <= ahora.getTime();
}
