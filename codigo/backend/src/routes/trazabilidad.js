// M2 · Trazabilidad: lotes de cosecha, eventos de la cadena y código QR público.
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { autorizar } from '../middleware/auth.js';
import { validar } from '../middleware/validar.js';
import { asyncH, noEncontrado } from '../utils/errores.js';
import { auditar } from '../utils/auditoria.js';
import { crearLote, qrDeLote, urlPublicaLote } from '../services/lotes.js';
import { TIPOS_EVENTO } from '../constantes.js';
import { validarCarenciaParaCosecha, CarenciaError } from '../utils/carencia.js';
import { obtenerFichaPublica, ejecutarConsultasTrazabilidad, CONSULTAS_TRAZABILIDAD } from '../services/trazabilidad.js';

export const privado = Router();
export const publico = Router();

const incluirLoteCosecha = {
  campania: { include: { lote: { select: { id: true, codigo: true, nombre: true } } } },
  eventos: { orderBy: { fecha: 'asc' } },
};

async function loteCosechaPropio(req) {
  const lc = await prisma.loteCosecha.findFirst({ where: { id: Number(req.params.id), campania: { lote: { fincaId: req.usuario.fincaId } } }, include: incluirLoteCosecha });
  if (!lc) throw noEncontrado('Lote de cosecha');
  return lc;
}

privado.get('/lotes', autorizar('trazabilidad:leer'), asyncH(async (req, res) => {
  const lotesCosecha = await prisma.loteCosecha.findMany({
    where: { campania: { lote: { fincaId: req.usuario.fincaId } } },
    include: incluirLoteCosecha,
    orderBy: { fechaCosecha: 'desc' },
  });
  res.json(lotesCosecha.map((lc) => ({ ...lc, urlPublica: urlPublicaLote(lc.tokenPublico) })));
}));

const esquemaLoteCosecha = z.object({
  campaniaId: z.number().int().positive(),
  fechaCosecha: z.coerce.date(),
  cantidadKg: z.number().positive().max(1000000),
  calidad: z.enum(['PRIMERA', 'SEGUNDA', 'DESCARTE']).optional(),
  destino: z.string().max(120).nullable().optional(),
  justificacion: z.string().max(500).optional(), // solo para forzar carencia (PROPIETARIO)
});

privado.post('/lotes', autorizar('trazabilidad:escribir'), validar(esquemaLoteCosecha), asyncH(async (req, res) => {
  // Verificar que la campaña existe y obtener el loteId
  const campania = await prisma.campania.findFirst({
    where: { id: req.body.campaniaId, lote: { fincaId: req.usuario.fincaId } },
    include: { lote: true }
  });
  if (!campania) throw noEncontrado('Campaña');

  // Verificar período de carencia
  try {
    const forzar = req.query.forzar === 'true';
    const justificacion = req.body.justificacion;
    const validacion = await validarCarenciaParaCosecha(campania.loteId, req.usuario, forzar, justificacion);

    // Crear el lote de cosecha
    const { justificacion: _j, ...datos } = req.body;
    const loteCosecha = await crearLote({ fincaId: req.usuario.fincaId, ...datos });
    await auditar({ usuarioId: req.usuario.id, fincaId: req.usuario.fincaId, accion: 'CREAR', entidad: 'LoteCosecha', entidadId: loteCosecha.id, detalle: loteCosecha.codigo });

    const respuesta = { ...loteCosecha, urlPublica: urlPublicaLote(loteCosecha.tokenPublico) };
    if (validacion.advertencia) {
      respuesta.advertencia = validacion.advertencia;
    }

    res.status(201).json(respuesta);
  } catch (error) {
    if (error instanceof CarenciaError) {
      return res.status(409).json({
        error: 'CARENCIA_VIGENTE',
        mensaje: error.message,
        detalles: {
          lote: campania.lote,
          aplicacion: error.detalles.aplicacion,
          fechaFinCarencia: error.detalles.fechaFinCarencia,
          puedeForzar: req.usuario.rol === 'PROPIETARIO'
        }
      });
    }
    throw error;
  }
}));

privado.get('/lotes/:id', autorizar('trazabilidad:leer'), asyncH(async (req, res) => {
  const lc = await loteCosechaPropio(req);
  res.json({ ...lc, urlPublica: urlPublicaLote(lc.tokenPublico), qr: await qrDeLote(lc) });
}));

privado.get('/lotes/:id/qr.svg', autorizar('trazabilidad:leer'), asyncH(async (req, res) => {
  const lc = await loteCosechaPropio(req);
  res.type('image/svg+xml').send(await qrDeLote(lc, 'svg'));
}));

privado.post('/lotes/:id/eventos', autorizar('trazabilidad:escribir'),
  validar(z.object({ tipo: z.enum(TIPOS_EVENTO), fecha: z.coerce.date().optional(), detalle: z.string().max(300).nullable().optional() })),
  asyncH(async (req, res) => {
    const lc = await loteCosechaPropio(req);
    const e = await prisma.eventoTrazabilidad.create({ data: { ...req.body, loteId: lc.id } });
    await auditar({ usuarioId: req.usuario.id, fincaId: req.usuario.fincaId, accion: 'CREAR', entidad: 'EventoTrazabilidad', entidadId: e.id });
    res.status(201).json(e);
  }));

/**
 * Vista pública del QR: trazabilidad completa para el consumidor
 * (lote → labores con aplicaciones y carencia → cosecha → eventos → ventas anonimizadas).
 */
publico.get('/:token', asyncH(async (req, res) => {
  const ficha = await obtenerFichaPublica(req.params.token);
  if (!ficha) throw noEncontrado('Lote de cosecha');
  res.set('Cache-Control', 'public, max-age=120');
  res.json(ficha);
}));

/**
 * Misma trazabilidad, pero mostrando las consultas SQL documentadas y su resultado real
 * (propósito educativo: es la consulta clave que se explica en el informe).
 */
publico.get('/:token/sql', asyncH(async (req, res) => {
  const ficha = await obtenerFichaPublica(req.params.token);
  if (!ficha) throw noEncontrado('Lote de cosecha');
  const resultados = await ejecutarConsultasTrazabilidad(req.params.token);
  res.json({
    codigo: ficha.codigo,
    motor: 'SQLite (Prisma guarda las fechas como enteros en milisegundos)',
    consultas: CONSULTAS_TRAZABILIDAD.map((c) => ({ nombre: c.nombre, descripcion: c.descripcion, sql: c.sql, filas: resultados[c.nombre] })),
  });
}));
