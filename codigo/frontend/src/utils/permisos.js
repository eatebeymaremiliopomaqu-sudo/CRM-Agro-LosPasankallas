// Copia de la matriz RBAC del backend, sólo para mostrar u ocultar botones.
// La seguridad real la aplica la API.
const PROPIETARIO = 'PROPIETARIO', ENCARGADO = 'ENCARGADO', TRABAJADOR = 'TRABAJADOR';

export const PERMISOS = {
  'finca:configurar': [PROPIETARIO],
  'usuarios:gestionar': [PROPIETARIO],
  'modulos:gestionar': [PROPIETARIO],
  'auditoria:ver': [PROPIETARIO],
  'lotes:leer': [PROPIETARIO, ENCARGADO, TRABAJADOR],
  'lotes:escribir': [PROPIETARIO, ENCARGADO],
  'labores:leer': [PROPIETARIO, ENCARGADO, TRABAJADOR],
  'labores:escribir': [PROPIETARIO, ENCARGADO, TRABAJADOR],
  'aplicaciones:escribir': [PROPIETARIO, ENCARGADO],
  'trazabilidad:leer': [PROPIETARIO, ENCARGADO, TRABAJADOR],
  'trazabilidad:escribir': [PROPIETARIO, ENCARGADO],
  'trabajadores:leer': [PROPIETARIO, ENCARGADO],
  'trabajadores:escribir': [PROPIETARIO, ENCARGADO],
  'pagos:gestionar': [PROPIETARIO],
  'finanzas:ver': [PROPIETARIO],
  'agente:usar': [PROPIETARIO, ENCARGADO, TRABAJADOR],
  'insumos:leer': [PROPIETARIO, ENCARGADO, TRABAJADOR],
  'insumos:escribir': [PROPIETARIO, ENCARGADO],
  'ventas:leer': [PROPIETARIO, ENCARGADO],
  'ventas:escribir': [PROPIETARIO, ENCARGADO],
  'tareas:leer': [PROPIETARIO, ENCARGADO, TRABAJADOR],
  'tareas:escribir': [PROPIETARIO, ENCARGADO],
  'alertas:ver': [PROPIETARIO, ENCARGADO],
  'alertas:enviar': [PROPIETARIO, ENCARGADO],
  'vivero:leer': [PROPIETARIO, ENCARGADO, TRABAJADOR],
  'vivero:escribir': [PROPIETARIO, ENCARGADO],
};

export const puede = (rol, permiso) => (PERMISOS[permiso] || []).includes(rol);

export const ETIQUETAS_ROL = {
  PROPIETARIO: 'Propietario',
  ENCARGADO: 'Encargado de campo',
  TRABAJADOR: 'Trabajador',
};
