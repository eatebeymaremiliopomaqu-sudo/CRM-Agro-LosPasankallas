import { solicitudInvalida } from '../utils/errores.js';

/** Valida req.body (o req.query) con un esquema Zod y reemplaza por los datos limpios. */
export const validar = (esquema, origen = 'body') => (req, _res, next) => {
  const r = esquema.safeParse(req[origen]);
  if (!r.success) {
    const detalles = r.error.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message }));
    return next(solicitudInvalida('Datos inválidos', detalles));
  }
  req[origen] = r.data;
  next();
};
