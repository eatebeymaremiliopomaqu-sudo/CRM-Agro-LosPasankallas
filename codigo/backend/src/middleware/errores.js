import { config } from '../config.js';

export function noEncontradoRuta(req, res) {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
}

// Manejador central: nunca filtra trazas internas en producción.
// eslint-disable-next-line no-unused-vars
export function manejadorErrores(err, req, res, _next) {
  // Errores conocidos de Prisma
  if (err.code === 'P2002') {
    return res.status(409).json({ error: 'Ya existe un registro con ese valor único', campos: err.meta?.target });
  }
  if (err.code === 'P2025') {
    return res.status(404).json({ error: 'Registro no encontrado' });
  }
  if (err.code === 'P2003') {
    return res.status(409).json({ error: 'El registro está relacionado con otros datos' });
  }
  const status = err.status || 500;
  if (status >= 500) console.error('[ERROR]', err);
  res.status(status).json({
    error: status >= 500 && config.esProduccion ? 'Error interno del servidor' : err.message,
    ...(err.detalles ? { detalles: err.detalles } : {}),
  });
}
