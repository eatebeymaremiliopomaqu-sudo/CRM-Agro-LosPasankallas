export class ErrorHttp extends Error {
  constructor(status, mensaje, detalles) {
    super(mensaje);
    this.status = status;
    this.detalles = detalles;
  }
}

export const noEncontrado = (entidad = 'Recurso') => new ErrorHttp(404, `${entidad} no encontrado`);
export const prohibido = (mensaje = 'No tiene permisos para esta acción') => new ErrorHttp(403, mensaje);
export const solicitudInvalida = (mensaje, detalles) => new ErrorHttp(400, mensaje, detalles);

// Envuelve controladores async para que los errores lleguen al manejador central.
export const asyncH = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
