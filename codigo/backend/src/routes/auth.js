import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../db.js';
import { autenticar, firmarToken } from '../middleware/auth.js';
import { validar } from '../middleware/validar.js';
import { asyncH, ErrorHttp } from '../utils/errores.js';
import { auditar } from '../utils/auditoria.js';
import { modulosDe } from '../utils/permisos.js';

const r = Router();

// Máximo 10 intentos de login cada 15 minutos por IP (anti fuerza bruta).
const limiteLogin = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false, message: { error: 'Demasiados intentos. Espere 15 minutos.' } });

const esquemaLogin = z.object({ email: z.string().email().toLowerCase(), password: z.string().min(6).max(100) });

r.post('/login', limiteLogin, validar(esquemaLogin), asyncH(async (req, res) => {
  const { email, password } = req.body;
  const usuario = await prisma.usuario.findUnique({
    where: { email },
    include: { finca: { include: { modulos: true } } }
  });
  // Mismo mensaje para usuario inexistente o contraseña incorrecta (no revela cuentas)
  const ok = usuario && usuario.activo && (await bcrypt.compare(password, usuario.passwordHash));
  if (!ok) throw new ErrorHttp(401, 'Credenciales incorrectas');
  await auditar({ usuarioId: usuario.id, fincaId: usuario.fincaId, accion: 'LOGIN', entidad: 'Usuario', entidadId: usuario.id });
  res.json({
    token: firmarToken(usuario),
    usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol },
    finca: { id: usuario.finca.id, nombre: usuario.finca.nombre, modulos: modulosDe(usuario.finca) },
  });
}));

r.get('/yo', autenticar, asyncH(async (req, res) => {
  const u = await prisma.usuario.findUnique({
    where: { id: req.usuario.id },
    include: { finca: { include: { modulos: true } } }
  });
  if (!u || !u.activo) throw new ErrorHttp(401, 'Usuario inactivo');
  res.json({
    usuario: { id: u.id, nombre: u.nombre, email: u.email, rol: u.rol, telefono: u.telefono },
    finca: { id: u.finca.id, nombre: u.finca.nombre, modulos: modulosDe(u.finca), lat: u.finca.lat, lng: u.finca.lng },
  });
}));

const esquemaClave = z.object({ actual: z.string().min(6), nueva: z.string().min(8).max(100).regex(/\d/, 'Debe incluir al menos un número') });

r.post('/cambiar-clave', autenticar, validar(esquemaClave), asyncH(async (req, res) => {
  const u = await prisma.usuario.findUnique({ where: { id: req.usuario.id } });
  if (!(await bcrypt.compare(req.body.actual, u.passwordHash))) throw new ErrorHttp(400, 'La contraseña actual no coincide');
  await prisma.usuario.update({ where: { id: u.id }, data: { passwordHash: await bcrypt.hash(req.body.nueva, 10) } });
  res.json({ ok: true });
}));

export default r;
