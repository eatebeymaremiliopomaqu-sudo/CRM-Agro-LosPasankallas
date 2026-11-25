// Constantes de dominio sin dependencias externas (se pueden probar sin instalar nada).
export const ROLES = Object.freeze({
  PROPIETARIO: 'PROPIETARIO',
  ENCARGADO: 'ENCARGADO',
  TRABAJADOR: 'TRABAJADOR',
});

export const MODULOS = Object.freeze({
  M0: 'Núcleo (finca, usuarios, lotes, cultivos)',
  M1: 'Control técnico de campo',
  M2: 'Trazabilidad',
  M3: 'Trabajadores',
  M4: 'Inventarios',
  M5: 'Ventas y clientes',
  M6: 'Vivero',
  M7: 'Reportes y finanzas',
});

export const TIPOS_LABOR = ['SIEMBRA', 'RIEGO', 'FERTILIZACION', 'FUMIGACION', 'DESHIERBE', 'PODA', 'COSECHA', 'MONITOREO', 'OTRA'];
export const TIPOS_OBSERVACION = ['PLAGA', 'ENFERMEDAD', 'CLIMA', 'SUELO', 'OTRO'];
export const TIPOS_EVENTO = ['COSECHA', 'ACOPIO', 'LAVADO', 'EMPAQUE', 'DESPACHO', 'VENTA'];
