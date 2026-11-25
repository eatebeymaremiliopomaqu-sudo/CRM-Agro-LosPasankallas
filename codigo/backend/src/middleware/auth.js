import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { prisma } from '../db.js';
import { ErrorHttp, prohibido } from '../utils/errores.js';
import { puede, tieneModulo } from '../utils/permisos.js';

export function firmarToken(usuario) {
  return jwt.sign(
    { sub: usuario.id, rol: usuario.rol, fincaId: usuario.fincaId, nombre: usuario.nombre },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
}

/** Verifica el JWT del encabezado Authorization: Bearer <token>. */
export function autenticar(req, _res, next) {
  const cabecera = req.headers.authorization || '';
  const [tipo, token] = cabecera.split(' ');
  if (tipo !== 'Bearer' || !token) return next(new ErrorHttp(401, 'Token requerido'));
  try {
    const datos = jwt.verify(token, config.jwtSecret);
    req.usuario = { id: datos.sub, rol: datos.rol, fincaId: datos.fincaId, nombre: datos.nombre };
    next();
  } catch {
    next(new ErrorHttp(401, 'Token inválido o expirado'));
  }
}

/** Exige un permiso de la matriz RBAC. */
export const autorizar = (permiso) => (req, _res, next) => {
  if (!req.usuario || !puede(req.usuario.rol, permiso)) return next(prohibido());
  next();
};

/** Bloquea rutas de un módulo que la finca no tiene activo (módulos activables). */
export const requiereModulo = (modulo) => async (req, _res, next) => {
  try {
    const finca = await prisma.finca.findUnique({
      where: { id: req.usuario.fincaId },
      include: { modulos: true }
    });
    if (!tieneModulo(finca, modulo)) {
      return next(new ErrorHttp(403, `El módulo ${modulo} no está activo para esta finca`));
    }
    req.finca = finca;
    next();
  } catch (e) {
    next(e);
  }
};
