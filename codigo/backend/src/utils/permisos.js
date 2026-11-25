// Matriz de permisos por rol (RBAC). Fuente única de verdad del backend;
// el frontend tiene una copia sólo para ocultar botones (la seguridad real está aquí).
import { ROLES } from '../constantes.js';

const { ADMIN, TECNICO, SUPERVISOR, CONSULTA } = ROLES;

export const PERMISOS = Object.freeze({
  'finca:configurar': [ADMIN],
  'usuarios:gestionar': [ADMIN],
  'auditoria:ver': [ADMIN],
  'parcelas:leer': [ADMIN, TECNICO, SUPERVISOR, CONSULTA],
  'parcelas:escribir': [ADMIN, TECNICO],
  'labores:leer': [ADMIN, TECNICO, SUPERVISOR, CONSULTA],
  'labores:escribir': [ADMIN, TECNICO, SUPERVISOR],
  'aplicaciones:escribir': [ADMIN, TECNICO], // sólo el técnico registra agroquímicos
  'trazabilidad:leer': [ADMIN, TECNICO, SUPERVISOR, CONSULTA],
  'trazabilidad:escribir': [ADMIN, TECNICO, SUPERVISOR],
  'trabajadores:leer': [ADMIN, SUPERVISOR, TECNICO],
  'trabajadores:escribir': [ADMIN, SUPERVISOR],
  'pagos:gestionar': [ADMIN],
  'agente:usar': [ADMIN, TECNICO, SUPERVISOR],
  'insumos:leer': [ADMIN, TECNICO, SUPERVISOR, CONSULTA],
  'insumos:escribir': [ADMIN, TECNICO],
});

export function puede(rol, permiso) {
  const roles = PERMISOS[permiso];
  if (!roles) return false;
  return roles.includes(rol);
}

export const MODULOS_VALIDOS = ['M1', 'M2', 'M3', 'M4', 'M5', 'M6'];

/** Lee de forma segura la lista JSON de módulos de la finca. M0 siempre está activo. */
export function modulosDe(finca) {
  try {
    const lista = JSON.parse(finca?.modulosActivos ?? '[]');
    return ['M0', ...lista.filter((m) => MODULOS_VALIDOS.includes(m))];
  } catch {
    return ['M0'];
  }
}

export function tieneModulo(finca, modulo) {
  if (modulo === 'M0') return true;
  return modulosDe(finca).includes(modulo);
}

/** Dependencias entre módulos: no se puede activar uno sin su base. */
export const DEPENDENCIAS = Object.freeze({
  M2: ['M1'],
  M3: ['M1'],
  M5: ['M1'],
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
