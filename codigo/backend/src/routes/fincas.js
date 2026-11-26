// M0 · Núcleo: configuración de la finca, módulos activables, usuarios y auditoría.
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../db.js';
import { autorizar } from '../middleware/auth.js';
import { validar } from '../middleware/validar.js';
import { asyncH, ErrorHttp, solicitudInvalida } from '../utils/errores.js';
import { auditar } from '../utils/auditoria.js';
import { MODULOS } from '../config.js';
import { modulosDe, validarActivacion } from '../utils/permisos.js';

const r = Router();

r.get('/finca', asyncH(async (req, res) => {
  const f = await prisma.finca.findUnique({
    where: { id: req.usuario.fincaId },
    include: { modulos: true }
  });
  res.json({ ...f, modulos: modulosDe(f), catalogoModulos: MODULOS });
}));

const esquemaFinca = z.object({
  nombre: z.string().min(3).max(80).optional(),
  municipio: z.string().max(80).optional().nullable(),
  departamento: z.string().max(80).optional().nullable(),
  lat: z.number().min(-90).max(90).optional().nullable(),
  lng: z.number().min(-180).max(180).optional().nullable(),
  hectareas: z.number().min(0).max(10000).optional(),
  telefonoWa: z.string().max(20).optional().nullable(),
  whatsappActivo: z.boolean().optional(),
  alertasActivas: z.boolean().optional(),
  horaAlertas: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Formato HH:MM').optional(),
});

r.patch('/finca', autorizar('finca:configurar'), validar(esquemaFinca), asyncH(async (req, res) => {
  const f = await prisma.finca.update({ where: { id: req.usuario.fincaId }, data: req.body });
  await auditar({ usuarioId: req.usuario.id, fincaId: f.id, accion: 'ACTUALIZAR', entidad: 'Finca', entidadId: f.id });
  res.json(f);
}));

r.put('/finca/modulos', autorizar('modulos:gestionar'), validar(z.object({ modulos: z.array(z.string()).max(10) })), asyncH(async (req, res) => {
  const lista = [...new Set(req.body.modulos.filter((m) => m !== 'M0'))];
  const errores = validarActivacion(lista);
  if (errores.length) throw solicitudInvalida('Configuración de módulos inválida', errores);

  const fincaId = req.usuario.fincaId;

  // Actualizar tabla ModuloFinca
  await prisma.$transaction(async (tx) => {
    // Desactivar todos los módulos actuales
    await tx.moduloFinca.updateMany({
      where: { fincaId },
      data: { activo: false }
    });

    // Activar o crear los módulos de la nueva lista
    for (const codigo of lista) {
      await tx.moduloFinca.upsert({
        where: { fincaId_codigo: { fincaId, codigo } },
        update: { activo: true },
        create: { fincaId, codigo, activo: true }
      });
    }
  });

  await auditar({ usuarioId: req.usuario.id, fincaId, accion: 'ACTUALIZAR', entidad: 'Modulos', detalle: lista.join(',') });

  const f = await prisma.finca.findUnique({
    where: { id: fincaId },
    include: { modulos: true }
  });
  res.json({ modulos: modulosDe(f) });
}));

// Usuarios de la finca
const seleccionUsuario = { id: true, nombre: true, email: true, rol: true, telefono: true, activo: true, consentimientoWhatsapp: true, fechaConsentimiento: true, trabajadorId: true, creadoEn: true };

r.get('/usuarios', autorizar('usuarios:gestionar'), asyncH(async (req, res) => {
  res.json(await prisma.usuario.findMany({ where: { fincaId: req.usuario.fincaId }, select: seleccionUsuario, orderBy: { nombre: 'asc' } }));
}));

const esquemaUsuario = z.object({
  nombre: z.string().min(3).max(80),
  email: z.string().email().toLowerCase(),
  password: z.string().min(8).max(100),
  rol: z.enum(['PROPIETARIO', 'ENCARGADO', 'TRABAJADOR']),
  telefono: z.string().max(20).optional().nullable(),
  consentimientoWhatsapp: z.boolean().optional(),
  trabajadorId: z.number().int().positive().nullable().optional(),
});

const conFechaConsentimiento = (datos, previo = null) => {
  if (datos.consentimientoWhatsapp === undefined || datos.consentimientoWhatsapp === previo?.consentimientoWhatsapp) return datos;
  return { ...datos, fechaConsentimiento: datos.consentimientoWhatsapp ? new Date() : null };
};

r.post('/usuarios', autorizar('usuarios:gestionar'), validar(esquemaUsuario), asyncH(async (req, res) => {
  const { password, ...resto } = req.body;
  const u = await prisma.usuario.create({
    data: { ...conFechaConsentimiento(resto), passwordHash: await bcrypt.hash(password, 10), fincaId: req.usuario.fincaId },
    select: seleccionUsuario,
  });
  await auditar({ usuarioId: req.usuario.id, fincaId: req.usuario.fincaId, accion: 'CREAR', entidad: 'Usuario', entidadId: u.id });
  res.status(201).json(u);
}));

r.patch('/usuarios/:id', autorizar('usuarios:gestionar'), validar(esquemaUsuario.partial().extend({ activo: z.boolean().optional() })), asyncH(async (req, res) => {
  const id = Number(req.params.id);
  const existe = await prisma.usuario.findFirst({ where: { id, fincaId: req.usuario.fincaId } });
  if (!existe) throw new ErrorHttp(404, 'Usuario no encontrado');
  if (id === req.usuario.id && (req.body.activo === false || (req.body.rol && req.body.rol !== 'PROPIETARIO'))) {
    throw new ErrorHttp(400, 'No puede desactivarse ni quitarse el rol de propietario a sí mismo');
  }
  const { password, ...resto } = req.body;
  const data = { ...conFechaConsentimiento(resto, existe), ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}) };
  const u = await prisma.usuario.update({ where: { id }, data, select: seleccionUsuario });
  await auditar({ usuarioId: req.usuario.id, fincaId: req.usuario.fincaId, accion: 'ACTUALIZAR', entidad: 'Usuario', entidadId: id });
  res.json(u);
}));

r.get('/auditoria', autorizar('auditoria:ver'), asyncH(async (req, res) => {
  const lista = await prisma.auditoria.findMany({
    where: { fincaId: req.usuario.fincaId },
    include: { usuario: { select: { nombre: true } } },
    orderBy: { fecha: 'desc' },
    take: Math.min(Number(req.query.limite) || 100, 500),
  });
  res.json(lista);
}));

export default r;
