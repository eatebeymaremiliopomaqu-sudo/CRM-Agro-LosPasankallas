// Copia de la matriz RBAC del backend, sólo para mostrar u ocultar botones.
// La seguridad real la aplica la API.
const A = 'ADMIN', T = 'TECNICO', S = 'SUPERVISOR', C = 'CONSULTA';
export const PERMISOS = {
  'finca:configurar': [A],
  'usuarios:gestionar': [A],
  'parcelas:escribir': [A, T],
  'labores:escribir': [A, T, S],
  'aplicaciones:escribir': [A, T],
  'trazabilidad:escribir': [A, T, S],
  'trabajadores:leer': [A, S, T],
  'trabajadores:escribir': [A, S],
  'pagos:gestionar': [A],
  'agente:usar': [A, T, S],
  'insumos:escribir': [A, T],
};
export const puede = (rol, permiso) => (PERMISOS[permiso] || []).includes(rol);

export const ETIQUETAS_ROL = { ADMIN: 'Administrador', TECNICO: 'Técnico de campo', SUPERVISOR: 'Capataz / supervisor', CONSULTA: 'Sólo consulta' };
