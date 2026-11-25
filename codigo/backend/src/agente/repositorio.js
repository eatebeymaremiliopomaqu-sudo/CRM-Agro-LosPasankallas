// Adaptadores Prisma para el agente: almacén de acciones pendientes y ejecutor.
import { prisma } from '../db.js';
import { crearLote, urlPublicaLote } from '../services/lotes.js';
import { normalizar } from './guardrails.js';
import { INTENCIONES, normalizarCodigoParcela } from './parser.js';
import { auditar } from '../utils/auditoria.js';

export const almacenPrisma = {
  async obtenerPendiente(fincaId, remitente, ahora) {
    const a = await prisma.accionPendiente.findFirst({
      where: { fincaId, remitente, estado: 'PENDIENTE', expiraEn: { gt: ahora } },
      orderBy: { creadoEn: 'desc' },
    });
    return a ? { ...a, datos: JSON.parse(a.payload) } : null;
  },
  async crearPendiente({ fincaId, canal, remitente, tipo, datos, resumen, expiraEn }) {
    await prisma.accionPendiente.updateMany({ where: { fincaId, remitente, estado: 'PENDIENTE' }, data: { estado: 'CANCELADA' } });
    const a = await prisma.accionPendiente.create({
      data: { fincaId, canal, remitente, tipo, payload: JSON.stringify(datos), resumen, expiraEn },
    });
    return a.id;
  },
  async marcar(id, estado) {
    await prisma.accionPendiente.update({ where: { id }, data: { estado } });
  },
};

async function parcelaDe(fincaId, codigo) {
  const cod = normalizarCodigoParcela(codigo);
  const p = await prisma.parcela.findFirst({ where: { fincaId, codigo: cod } });
  if (!p) throw new Error(`no existe la parcela ${cod} en la finca`);
  return p;
}

async function siembraActiva(parcelaId) {
  return prisma.siembra.findFirst({ where: { parcelaId, estado: 'EN_CURSO' }, orderBy: { fechaSiembra: 'desc' } });
}

async function trabajadorPorNombre(fincaId, nombre) {
  const palabras = normalizar(nombre).split(' ').filter(Boolean);
  const todos = await prisma.trabajador.findMany({ where: { fincaId, activo: true } });
  const coinciden = todos.filter((t) => palabras.every((p) => normalizar(t.nombre).includes(p)));
  if (coinciden.length === 0) throw new Error(`no encontré al trabajador "${nombre}"`);
  if (coinciden.length > 1) throw new Error(`hay ${coinciden.length} trabajadores que coinciden con "${nombre}", escribe el nombre completo`);
  return coinciden[0];
}

const diaUTC = (f) => new Date(`${String(f || new Date().toISOString()).slice(0, 10)}T12:00:00.000Z`);

export const ejecutorPrisma = {
  async ejecutar(tipo, d, ctx) {
    const { fincaId, usuario } = ctx;
    const origen = ctx.canal === 'WHATSAPP' ? 'WHATSAPP' : 'AGENTE';
    let texto;
    switch (tipo) {
      case INTENCIONES.REGISTRAR_LABOR: {
        const parcela = await parcelaDe(fincaId, d.parcela);
        const siembra = await siembraActiva(parcela.id);
        const labor = await prisma.labor.create({
          data: {
            parcelaId: parcela.id,
            siembraId: siembra?.id ?? null,
            tipo: d.tipo,
            fecha: diaUTC(d.fecha),
            horas: Number(d.horas) || 0,
            descripcion: d.descripcion || null,
            origen,
            registradoPorId: usuario?.id ?? null,
            ...(d.producto
              ? {
                  aplicacion: {
                    create: {
                      producto: d.producto,
                      cantidadUsada: d.cantidadUsada != null ? Number(d.cantidadUsada) : null,
                      unidad: d.unidad || null,
                      responsableTecnico: usuario?.nombre || 'Reportado por WhatsApp',
                    },
                  },
                }
              : {}),
          },
        });
        texto = `Labor #${labor.id} (${d.tipo}) guardada en ${parcela.codigo}.`;
        break;
      }
      case INTENCIONES.REGISTRAR_ASISTENCIA: {
        const t = await trabajadorPorNombre(fincaId, d.trabajador);
        const parcela = d.parcela ? await parcelaDe(fincaId, d.parcela) : null;
        const fecha = diaUTC(d.fecha);
        await prisma.asistencia.upsert({
          where: { trabajadorId_fecha: { trabajadorId: t.id, fecha } },
          update: { horas: Number(d.horas) || 8, tarea: d.tarea || null, parcelaId: parcela?.id ?? null },
          create: { trabajadorId: t.id, fecha, horas: Number(d.horas) || 8, tarea: d.tarea || null, parcelaId: parcela?.id ?? null, origen },
        });
        texto = `Asistencia de ${t.nombre} guardada (${Number(d.horas) || 8} h).`;
        break;
      }
      case INTENCIONES.REGISTRAR_OBSERVACION: {
        const parcela = await parcelaDe(fincaId, d.parcela);
        const o = await prisma.observacion.create({
          data: { parcelaId: parcela.id, tipo: d.tipo || 'OTRO', severidad: Math.min(5, Math.max(1, Number(d.severidad) || 2)), nota: d.nota || '', fecha: diaUTC(d.fecha), origen },
        });
        texto = `Observación #${o.id} guardada en ${parcela.codigo}.`;
        if (o.severidad >= 4) texto += ' ⚠️ Severidad alta: se avisó en el tablero para revisión del técnico.';
        break;
      }
      case INTENCIONES.REGISTRAR_COSECHA: {
        const parcela = await parcelaDe(fincaId, d.parcela);
        const siembra = await siembraActiva(parcela.id);
        if (!siembra) throw new Error(`la parcela ${parcela.codigo} no tiene una siembra en curso`);
        const lote = await crearLote({ fincaId, siembraId: siembra.id, fechaCosecha: diaUTC(d.fecha), cantidadKg: Number(d.cantidadKg), calidad: d.calidad || 'PRIMERA' });
        texto = `Lote ${lote.codigo} creado. Trazabilidad: ${urlPublicaLote(lote.tokenPublico)}`;
        break;
      }
      default:
        throw new Error('acción no soportada');
    }
    await auditar({ usuarioId: usuario?.id ?? null, fincaId, accion: 'AGENTE', entidad: tipo, detalle: `${ctx.canal}: ${texto}` });
    return texto;
  },

  async consultar(tema, { fincaId, ahora }) {
    const inicioDia = new Date(ahora);
    inicioDia.setUTCHours(0, 0, 0, 0);
    const finDia = new Date(inicioDia.getTime() + 86400000);
    const hace7 = new Date(inicioDia.getTime() - 7 * 86400000);
    const inicioMes = new Date(Date.UTC(inicioDia.getUTCFullYear(), inicioDia.getUTCMonth(), 1));
    const [labores, asistencias, alertas, cosecha, trabajadores] = await Promise.all([
      prisma.labor.count({ where: { parcela: { fincaId }, fecha: { gte: inicioDia, lt: finDia } } }),
      prisma.asistencia.count({ where: { trabajador: { fincaId }, fecha: { gte: inicioDia, lt: finDia } } }),
      prisma.observacion.count({ where: { parcela: { fincaId }, severidad: { gte: 4 }, fecha: { gte: hace7 } } }),
      prisma.loteCosecha.aggregate({ _sum: { cantidadKg: true }, where: { siembra: { parcela: { fincaId } }, fechaCosecha: { gte: inicioMes } } }),
      prisma.trabajador.count({ where: { fincaId, activo: true } }),
    ]);
    if (tema === 'TRABAJADORES') return `👷 Trabajadores activos: ${trabajadores}. Asistencias registradas hoy: ${asistencias}.`;
    return (
      `📊 Resumen de hoy:\n• Labores registradas: ${labores}\n• Asistencias: ${asistencias} de ${trabajadores} trabajadores\n` +
      `• Alertas fitosanitarias (severidad ≥4, 7 días): ${alertas}\n• Cosechado este mes: ${Math.round(cosecha._sum.cantidadKg || 0)} kg`
    );
  },
};
