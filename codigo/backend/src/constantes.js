// Constantes de dominio sin dependencias externas (se pueden probar sin instalar nada).
export const ROLES = Object.freeze({
  ADMIN: 'ADMIN',
  TECNICO: 'TECNICO',
  SUPERVISOR: 'SUPERVISOR',
  CONSULTA: 'CONSULTA',
});

export const MODULOS = Object.freeze({
  M0: 'Núcleo (usuarios, roles, fincas, auditoría)',
  M1: 'Parcelas y cultivos',
  M2: 'Control técnico de campo',
  M3: 'Trazabilidad con QR',
  M4: 'Trabajadores, asistencia y jornales',
  M5: 'WhatsApp y agente de IA',
  M6: 'Inventario de insumos (opcional)',
});

export const TIPOS_LABOR = ['SIEMBRA', 'RIEGO', 'FERTILIZACION', 'FUMIGACION', 'DESHIERBE', 'PODA', 'COSECHA', 'MONITOREO', 'OTRA'];
export const TIPOS_OBSERVACION = ['PLAGA', 'ENFERMEDAD', 'CLIMA', 'SUELO', 'OTRO'];
export const TIPOS_EVENTO = ['COSECHA', 'ACOPIO', 'LAVADO', 'EMPAQUE', 'DESPACHO', 'VENTA'];
