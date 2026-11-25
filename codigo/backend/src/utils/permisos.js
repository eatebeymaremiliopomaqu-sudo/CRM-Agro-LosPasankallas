// Matriz de permisos por rol (RBAC). Fuente única de verdad del backend;
// el frontend tiene una copia sólo para ocultar botones (la seguridad real está aquí).
import { ROLES } from '../constantes.js';

const { PROPIETARIO, ENCARGADO, TRABAJADOR } = ROLES;

export const PERMISOS = Object.freeze({
  'finca:configurar': [PROPIETARIO],
  'usuarios:gestionar': [PROPIETARIO],
  'modulos:gestionar': [PROPIETARIO],
  'auditoria:ver': [PROPIETARIO],
  'lotes:leer': [PROPIETARIO, ENCARGADO, TRABAJADOR],
  'lotes:escribir': [PROPIETARIO, ENCARGADO],
  'labores:leer': [PROPIETARIO, ENCARGADO, TRABAJADOR],
  'labores:escribir': [PROPIETARIO, ENCARGADO, TRABAJADOR], // trabajador solo sus tareas
  'aplicaciones:escribir': [PROPIETARIO, ENCARGADO], // solo encargado/propietario registra agroquímicos
  'trazabilidad:leer': [PROPIETARIO, ENCARGADO, TRABAJADOR],
  'trazabilidad:escribir': [PROPIETARIO, ENCARGADO],
  'trabajadores:leer': [PROPIETARIO, ENCARGADO],
  'trabajadores:escribir': [PROPIETARIO, ENCARGADO],
  'pagos:gestionar': [PROPIETARIO],
  'finanzas:ver': [PROPIETARIO],
  'agente:usar': [PROPIETARIO, ENCARGADO, TRABAJADOR], // trabajador con permisos limitados
  'insumos:leer': [PROPIETARIO, ENCARGADO, TRABAJADOR],
  'insumos:escribir': [PROPIETARIO, ENCARGADO],
  'ventas:leer': [PROPIETARIO, ENCARGADO],
  'ventas:escribir': [PROPIETARIO, ENCARGADO],
});

export function puede(rol, permiso) {
  const roles = PERMISOS[permiso];
  if (!roles) return false;
  return roles.includes(rol);
}

export const MODULOS_VALIDOS = ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7'];

/**
 * Lee de forma segura la lista de módulos activos de la finca. M0 siempre está activo.
 * @param {Object} finca - Objeto finca con propiedad `modulos` (array de {codigo, activo})
 * @returns {string[]} - Array de códigos de módulos activos, ej: ['M0', 'M1', 'M2']
 */
export function modulosDe(finca) {
  if (!finca || !finca.modulos) return ['M0'];
  const activos = finca.modulos
    .filter((m) => m.activo && MODULOS_VALIDOS.includes(m.codigo))
    .map((m) => m.codigo);
  return ['M0', ...activos];
}

export function tieneModulo(finca, modulo) {
  if (modulo === 'M0') return true;
  return modulosDe(finca).includes(modulo);
}

/** Dependencias entre módulos: no se puede activar uno sin su base. */
export const DEPENDENCIAS = Object.freeze({
  M2: ['M1'], // trazabilidad requiere campo
  M5: ['M4'], // ventas requiere inventarios
  M7: ['M1', 'M4'], // reportes requiere campo e inventarios
});

export function validarActivacion(lista) {
  const set = new Set(lista);
  const errores = [];
  for (const m of set) {
    if (!MODULOS_VALIDOS.includes(m)) errores.push(`Módulo desconocido: ${m}`);
    for (const dep of DEPENDENCIAS[m] || []) {
      if (!set.has(dep)) errores.push(`${m} requiere activar ${dep}`);
    }
  }
  return errores;
}
