// Adaptadores Prisma para el agente: almacén de acciones pendientes, preparación,
// ejecución y consultas. Las consultas SOLO leen lo registrado: nunca inventan dosis.
import { prisma } from '../db.js';
import { crearLote, urlPublicaLote } from '../services/lotes.js';
import { enviarWhatsApp } from '../services/whatsapp.js';
import { normalizar } from './guardrails.js';
import { INTENCIONES, TEMAS, normalizarCodigoLote } from './parser.js';
import { RechazoAgente, ESTADOS } from './agente.js';
import { auditar } from '../utils/auditoria.js';
import { verificarCarencia, mensajeCarencia } from '../utils/carencia.js';
import { ordenarTareas, transicionTarea, puedeGestionarTarea } from '../utils/tareas.js';

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

const fmt = (f) => new Date(f).toLocaleDateString('es-BO', { timeZone: 'UTC', day: '2-digit', month: '2-digit' });
const bs = (n) => `Bs ${Number(n || 0).toFixed(2)}`;
const diaUTC = (f) => new Date(`${String(f || new Date().toISOString()).slice(0, 10)}T12:00:00.000Z`);

async function loteDe(fincaId, codigo) {
  const cod = normalizarCodigoLote(codigo);
  const l = await prisma.lote.findFirst({ where: { fincaId, codigo: cod } });
  if (!l) throw new RechazoAgente(`No existe el lote ${cod} en la finca. Revisa el código (ej.: L-02).`, ESTADOS.FALTAN_DATOS);
  return l;
}

async function campaniaActiva(loteId) {
  return prisma.campania.findFirst({ where: { loteId, estado: 'EN_CURSO' }, orderBy: { fechaSiembra: 'desc' } });
}

async function trabajadorPorNombre(fincaId, nombre) {
  const palabras = normalizar(nombre).split(' ').filter(Boolean);
  const todos = await prisma.trabajador.findMany({ where: { fincaId, activo: true } });
  const coinciden = todos.filter((t) => palabras.every((p) => normalizar(t.nombre).includes(p)));
  if (coinciden.length === 0) throw new Error(`no encontré al trabajador "${nombre}"`);
  if (coinciden.length > 1) throw new Error(`hay ${coinciden.length} trabajadores que coinciden con "${nombre}", escribe el nombre completo`);
  return coinciden[0];
}

/** Bloqueo de carencia también por WhatsApp (ADR-010): nunca se fuerza desde el agente. */
async function exigirFueraDeCarencia(lote, ahora = new Date()) {
  const c = await verificarCarencia(lote.id, ahora);
  if (c.enCarencia) {
    throw new RechazoAgente(
      '🚫 ' + mensajeCarencia({ codigoLote: lote.codigo, producto: c.aplicacion.producto, fechaAplicacion: c.aplicacion.fechaAplicacion, dias: c.aplicacion.periodoCarenciaDias, fechaFin: c.fechaFinCarencia }) +
        ' No se puede registrar la cosecha hasta esa fecha.'
    );
  }
}

async function tareasActivasDe(trabajadorId) {
  return ordenarTareas(await prisma.tarea.findMany({ where: { trabajadorId, estado: { in: ['PENDIENTE', 'EN_CURSO'] } }, include: { lote: { select: { codigo: true } } } }));
}

/** Busca el producto del pedido en el inventario por nombre o cultivo. */
async function productoParaPedido(fincaId, nombre) {
  const buscado = normalizar(nombre);
  const productos = await prisma.productoCosechado.findMany({ where: { fincaId } });
  const palabra = buscado.split(' ')[0].replace(/(es|s)$/, '');
  return (
    productos.find((p) => normalizar(p.nombre) === buscado) ||
    productos.find((p) => normalizar(p.nombre).includes(palabra) || normalizar(p.cultivo).includes(palabra)) ||
    null
  );
}

export const ejecutorPrisma = {
  /** Valida y completa los datos ANTES de pedir confirmación. Lanza RechazoAgente con el mensaje al usuario. */
  async preparar(tipo, d, ctx) {
    const { fincaId } = ctx;
    switch (tipo) {
      case INTENCIONES.REGISTRAR_COSECHA: {
        const lote = await loteDe(fincaId, d.lote);
        const campania = await campaniaActiva(lote.id);
        if (!campania) throw new RechazoAgente(`El lote ${lote.codigo} no tiene una campaña en curso.`);
        await exigirFueraDeCarencia(lote, ctx.ahora);
        return { ...d, lote: lote.codigo, cultivo: d.cultivo || campania.cultivo };
      }
      case INTENCIONES.REGISTRAR_LABOR:
      case INTENCIONES.REGISTRAR_OBSERVACION: {
        const lote = await loteDe(fincaId, d.lote);
        return { ...d, lote: lote.codigo };
      }
      case INTENCIONES.MARCAR_TAREA_HECHA: {
        if (d.tareaId) {
          const t = await prisma.tarea.findFirst({ where: { id: Number(d.tareaId), trabajador: { fincaId } } });
          if (!t) throw new RechazoAgente(`No encontré la tarea #${d.tareaId}.`, ESTADOS.FALTAN_DATOS);
          if (!puedeGestionarTarea({ rol: ctx.perfil, trabajadorId: ctx.trabajadorId }, t)) throw new RechazoAgente('Esa tarea no es tuya: solo puedes marcar tus propias tareas.');
          const tr = transicionTarea(t.estado, 'completar');
          if (!tr.ok) throw new RechazoAgente(`La tarea #${t.id} ya está ${t.estado.toLowerCase()}.`);
          return { tareaId: t.id, titulo: t.titulo };
        }
        if (!ctx.trabajadorId) throw new RechazoAgente('Indica el número de la tarea, por ejemplo: "tarea hecha 12".', ESTADOS.FALTAN_DATOS);
        const activas = await tareasActivasDe(ctx.trabajadorId);
        if (!activas.length) throw new RechazoAgente('No tienes tareas pendientes. 🎉', ESTADOS.INFO);
        if (activas.length > 1) {
          const lista = activas.slice(0, 6).map((t) => `#${t.id} ${t.titulo}`).join('\n');
          throw new RechazoAgente(`Tienes ${activas.length} tareas activas. ¿Cuál terminaste? Responde por ejemplo "tarea hecha ${activas[0].id}":\n${lista}`, ESTADOS.FALTAN_DATOS);
        }
        return { tareaId: activas[0].id, titulo: activas[0].titulo };
      }
      case INTENCIONES.PEDIDO_CLIENTE: {
        if (!ctx.cliente) throw new RechazoAgente('Los pedidos por WhatsApp son para clientes registrados de la finca.');
        const p = await productoParaPedido(fincaId, d.producto);
        if (!p) {
          const disponibles = await prisma.productoCosechado.findMany({ where: { fincaId, stock: { gt: 0 } }, select: { nombre: true }, take: 8 });
          throw new RechazoAgente(`No tenemos "${d.producto}" en la lista. Disponibles: ${disponibles.map((x) => x.nombre).join(', ') || 'ninguno por ahora'}.`, ESTADOS.FALTAN_DATOS);
        }
        const mismaUnidad = normalizar(d.unidad) === normalizar(p.unidad);
        return { ...d, producto: p.nombre, productoId: p.id, precioBs: mismaUnidad ? p.precioVentaBs : 0, subtotal: mismaUnidad ? Math.round(p.precioVentaBs * d.cantidad * 100) / 100 : 0 };
      }
      default:
        return d;
    }
  },

  async ejecutar(tipo, d, ctx) {
    const { fincaId, usuario } = ctx;
    const origen = ctx.canal === 'WHATSAPP' ? 'WHATSAPP' : 'AGENTE';
    let texto;
    switch (tipo) {
      case INTENCIONES.REGISTRAR_LABOR: {
        const lote = await loteDe(fincaId, d.lote);
        const campania = await campaniaActiva(lote.id);
        const labor = await prisma.labor.create({
          data: {
            loteId: lote.id,
            campaniaId: campania?.id ?? null,
            tipo: d.tipo,
            fecha: diaUTC(d.fecha),
            horas: Number(d.horas) || 0,
            descripcion: d.descripcion || null,
            origen,
            trabajadorId: ctx.trabajadorId ?? null,
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
        texto = `Labor #${labor.id} (${d.tipo}) guardada en ${lote.codigo}.`;
        break;
      }
      case INTENCIONES.REGISTRAR_ASISTENCIA: {
        const t = await trabajadorPorNombre(fincaId, d.trabajador);
        const lote = d.lote ? await loteDe(fincaId, d.lote) : null;
        const fecha = diaUTC(d.fecha);
        await prisma.asistencia.upsert({
          where: { trabajadorId_fecha: { trabajadorId: t.id, fecha } },
          update: { horas: Number(d.horas) || 8, tarea: d.tarea || null, loteId: lote?.id ?? null },
          create: { trabajadorId: t.id, fecha, horas: Number(d.horas) || 8, tarea: d.tarea || null, loteId: lote?.id ?? null, origen },
        });
        texto = `Asistencia de ${t.nombre} guardada (${Number(d.horas) || 8} h).`;
        break;
      }
      case INTENCIONES.REGISTRAR_OBSERVACION: {
        const lote = await loteDe(fincaId, d.lote);
        const o = await prisma.observacion.create({
          data: { loteId: lote.id, tipo: d.tipo || 'OTRO', severidad: Math.min(5, Math.max(1, Number(d.severidad) || 2)), nota: d.nota || '', fecha: diaUTC(d.fecha), origen },
        });
        texto = `Observación #${o.id} guardada en ${lote.codigo}.`;
        if (o.severidad >= 4) texto += ' ⚠️ Severidad alta: se avisó en el tablero para revisión del encargado.';
        break;
      }
      case INTENCIONES.REGISTRAR_COSECHA: {
        const lote = await loteDe(fincaId, d.lote);
        const campania = await campaniaActiva(lote.id);
        if (!campania) throw new Error(`el lote ${lote.codigo} no tiene una campaña en curso`);
        await exigirFueraDeCarencia(lote); // se revalida al confirmar
        const loteCosecha = await crearLote({ fincaId, campaniaId: campania.id, fechaCosecha: diaUTC(d.fecha), cantidadKg: Number(d.cantidadKg), calidad: d.calidad || 'PRIMERA' });
        texto = `Lote de cosecha ${loteCosecha.codigo} creado y sumado al inventario. Trazabilidad (QR): ${urlPublicaLote(loteCosecha.tokenPublico)}`;
        break;
      }
      case INTENCIONES.MARCAR_TAREA_HECHA: {
        const t = await prisma.tarea.findFirst({ where: { id: Number(d.tareaId), trabajador: { fincaId } } });
        if (!t) throw new Error(`no existe la tarea #${d.tareaId}`);
        if (!puedeGestionarTarea({ rol: ctx.perfil, trabajadorId: ctx.trabajadorId }, t)) throw new Error('solo puedes marcar tus propias tareas');
        const tr = transicionTarea(t.estado, 'completar');
        if (!tr.ok) throw new Error(tr.error);
        await prisma.tarea.update({ where: { id: t.id }, data: { estado: 'COMPLETADA', fechaCompletada: new Date() } });
        texto = `Tarea #${t.id} "${t.titulo}" marcada como hecha. ¡Gracias!`;
        break;
      }
      case INTENCIONES.PEDIDO_CLIENTE: {
        const cliente = ctx.cliente;
        if (!cliente) throw new Error('solo clientes registrados pueden hacer pedidos');
        const pedido = await prisma.pedido.create({
          data: {
            clienteId: cliente.id,
            origen: 'WHATSAPP',
            estado: 'PENDIENTE',
            fechaEntrega: d.fechaEntrega ? diaUTC(d.fechaEntrega) : null,
            total: d.subtotal || 0,
            notas: `Pedido recibido por WhatsApp: ${d.cantidad} ${d.unidad} de ${d.producto}`,
            detalles: { create: [{ producto: d.producto, cantidad: Number(d.cantidad), unidad: d.unidad, precioBs: d.precioBs || 0, subtotal: d.subtotal || 0 }] },
          },
        });
        texto = `Pedido #${pedido.id} recibido. La finca te confirmará la entrega${d.fechaEntrega ? ` para el ${fmt(d.fechaEntrega)}` : ''}.`;
        // Aviso a encargados/propietario con consentimiento (mejor esfuerzo)
        const staff = await prisma.usuario.findMany({ where: { fincaId, activo: true, rol: { in: ['PROPIETARIO', 'ENCARGADO'] }, consentimientoWhatsapp: true, telefono: { not: null } } });
        for (const u of staff) {
          await enviarWhatsApp({ fincaId, telefono: u.telefono, texto: `🛒 Nuevo pedido #${pedido.id} por WhatsApp de ${cliente.nombre}: ${d.cantidad} ${d.unidad} de ${d.producto}${d.fechaEntrega ? ` para el ${fmt(d.fechaEntrega)}` : ''}.` });
        }
        break;
      }
      default:
        throw new Error('acción no soportada');
    }
    await auditar({ usuarioId: usuario?.id ?? null, fincaId, accion: 'AGENTE', entidad: tipo, detalle: `${ctx.canal}: ${texto}` });
    return texto;
  },

  /** Consultas. Solo datos registrados; la "dosis" se muestra únicamente como texto de etiqueta cargado. */
  async consultar(tema, ctx, datos = {}) {
    const { fincaId, ahora } = ctx;
    const inicioDia = new Date(ahora);
    inicioDia.setUTCHours(0, 0, 0, 0);
    const finDia = new Date(inicioDia.getTime() + 86400000);

    switch (tema) {
      case TEMAS.MIS_TAREAS: {
        if (!ctx.trabajadorId) return 'Tu usuario no está vinculado a un trabajador, así que no tienes tareas asignadas.';
        const tareas = await tareasActivasDe(ctx.trabajadorId);
        if (!tareas.length) return '✅ No tienes tareas pendientes.';
        return `📋 Tus tareas (${tareas.length}):\n` + tareas.slice(0, 8).map((t) => `• #${t.id} ${t.titulo}${t.lote ? ` (${t.lote.codigo})` : ''} · ${t.prioridad}${t.fechaVencimiento ? ` · para el ${fmt(t.fechaVencimiento)}` : ''}`).join('\n') + '\nCuando termines, responde "tarea hecha <número>".';
      }

      case TEMAS.LABORES_PENDIENTES: {
        const hasta = new Date(finDia.getTime() + 3 * 86400000);
        const where = { lote: { fincaId }, estado: 'PENDIENTE', fechaProgramada: { lt: hasta } };
        if (ctx.perfil === 'TRABAJADOR' && ctx.trabajadorId) where.responsableId = ctx.trabajadorId;
        const labores = await prisma.laborProgramada.findMany({ where, include: { lote: { select: { codigo: true } }, responsable: { select: { nombre: true } } }, orderBy: { fechaProgramada: 'asc' }, take: 10 });
        if (!labores.length) return '✅ No hay labores pendientes para los próximos 3 días.';
        return `🗓️ Labores pendientes (hoy y próximos 3 días):\n` + labores.map((l) => `• ${fmt(l.fechaProgramada)} ${l.tipo} en ${l.lote.codigo}${l.responsable ? ` · ${l.responsable.nombre}` : ''}${l.fechaProgramada < inicioDia ? ' ⚠️ atrasada' : ''}`).join('\n');
      }

      case TEMAS.CARENCIA_LOTE: {
        if (!datos.lote) return 'Indica el lote, por ejemplo: "¿qué se aplicó en el lote 2?".';
        const lote = await prisma.lote.findFirst({ where: { fincaId, codigo: normalizarCodigoLote(datos.lote) } });
        if (!lote) return `No existe el lote ${normalizarCodigoLote(datos.lote)} en la finca.`;
        const desde = new Date(ahora.getTime() - 90 * 86400000);
        const labores = await prisma.labor.findMany({ where: { loteId: lote.id, fecha: { gte: desde }, aplicacion: { isNot: null } }, include: { aplicacion: true }, orderBy: { fecha: 'desc' }, take: 6 });
        if (!labores.length) return `En el lote ${lote.codigo} no hay aplicaciones registradas en los últimos 90 días. ✅ Sin carencia vigente.`;
        const lineas = labores.map((l) => {
          const a = l.aplicacion;
          const fin = a.periodoCarenciaDias ? new Date(new Date(l.fecha).getTime() + a.periodoCarenciaDias * 86400000) : null;
          let s = `• ${fmt(l.fecha)} ${a.producto}${a.motivo ? ` (contra ${a.motivo})` : ''}`;
          if (fin) s += ` · carencia ${a.periodoCarenciaDias} d hasta el ${fmt(fin)}${fin > ahora ? ' ⛔ VIGENTE' : ' ✅ terminó'}`;
          if (a.dosisEtiqueta) s += `\n   Dosis de etiqueta registrada: "${a.dosisEtiqueta}" (texto tal como se cargó; no es una recomendación)`;
          return s;
        });
        const c = await verificarCarencia(lote.id, ahora);
        const estado = c.enCarencia ? `⛔ El lote ${lote.codigo} está en carencia hasta el ${fmt(c.fechaFinCarencia)}: no se puede cosechar.` : `✅ El lote ${lote.codigo} no tiene carencia vigente.`;
        return `🧪 Aplicaciones registradas en ${lote.codigo} (últimos 90 días):\n${lineas.join('\n')}\n${estado}\nSolo muestro lo registrado; las decisiones técnicas son del ingeniero agrónomo.`;
      }

      case TEMAS.STOCK: {
        const [insumos, productos] = await Promise.all([prisma.insumo.findMany({ where: { fincaId } }), prisma.productoCosechado.findMany({ where: { fincaId } })]);
        const items = [
          ...insumos.map((i) => ({ nombre: i.nombre, stock: i.stock, min: i.stockMinimo, unidad: i.unidad, tipo: 'insumo' })),
          ...productos.map((p) => ({ nombre: p.nombre, stock: p.stock, min: p.stockMinimo, unidad: p.unidad, tipo: 'producto' })),
        ];
        const linea = (x) => `• ${x.nombre}: ${Math.round(x.stock * 100) / 100} ${x.unidad}${x.min > 0 && x.stock <= x.min ? ` ⚠️ bajo el mínimo (${x.min})` : ''}`;
        if (datos.producto) {
          const b = normalizar(datos.producto);
          const hallados = items.filter((x) => normalizar(x.nombre).includes(b) || b.includes(normalizar(x.nombre).split(' ')[0]));
          if (!hallados.length) return `No encontré "${datos.producto}" en el inventario.`;
          return `📦 Stock:\n${hallados.slice(0, 6).map(linea).join('\n')}`;
        }
        const bajos = items.filter((x) => x.min > 0 && x.stock <= x.min);
        return `📦 Inventario: ${insumos.length} insumos y ${productos.length} productos.\n` + (bajos.length ? `Bajo el mínimo:\n${bajos.map(linea).join('\n')}` : '✅ Nada bajo el stock mínimo.') + '\nPregunta "stock de <nombre>" para ver uno.';
      }

      case TEMAS.VENTAS: {
        const dias = datos.periodo === 'MES' ? 30 : datos.periodo === 'SEMANA' ? 7 : 1;
        const desde = dias === 1 ? inicioDia : new Date(finDia.getTime() - dias * 86400000);
        const ventas = await prisma.venta.findMany({ where: { cliente: { fincaId }, fecha: { gte: desde, lt: finDia } }, include: { detalles: true } });
        const total = ventas.reduce((s, v) => s + v.total, 0);
        const cobrado = ventas.reduce((s, v) => s + v.pagado, 0);
        const etiqueta = dias === 1 ? 'de hoy' : dias === 7 ? 'de los últimos 7 días' : 'de los últimos 30 días';
        if (!ventas.length) return `💰 No hay ventas ${etiqueta}.`;
        return `💰 Ventas ${etiqueta}: ${ventas.length} por ${bs(total)} (cobrado ${bs(cobrado)}, por cobrar ${bs(total - cobrado)}).`;
      }

      case TEMAS.CUENTAS_POR_COBRAR: {
        const ventas = await prisma.venta.findMany({ where: { cliente: { fincaId }, saldo: { gt: 0 } }, include: { cliente: { select: { nombre: true } } } });
        if (!ventas.length) return '✅ No hay cuentas por cobrar.';
        const limite = new Date(ahora.getTime() - 7 * 86400000);
        const total = ventas.reduce((s, v) => s + v.saldo, 0);
        const vencidas = ventas.filter((v) => v.fecha < limite);
        const porCliente = {};
        for (const v of ventas) porCliente[v.cliente.nombre] = (porCliente[v.cliente.nombre] || 0) + v.saldo;
        const top = Object.entries(porCliente).sort((a, b) => b[1] - a[1]).slice(0, 4);
        return `🧾 Cuentas por cobrar: ${bs(total)} en ${ventas.length} venta(s); ${vencidas.length} vencida(s) (más de 7 días).\n` + top.map(([n, s]) => `• ${n}: ${bs(s)}`).join('\n');
      }

      case TEMAS.PRECIOS: {
        const productos = await prisma.productoCosechado.findMany({ where: { fincaId, stock: { gt: 0 } }, orderBy: { nombre: 'asc' } });
        if (!productos.length) return 'Por ahora no tenemos productos disponibles. ¡Escríbenos pronto!';
        return `🍅 Productos disponibles:\n` + productos.map((p) => `• ${p.nombre}: ${bs(p.precioVentaBs)} por ${p.unidad}`).join('\n') + '\nPara pedir escribe, por ejemplo: "quiero 5 kg de tomate para el viernes".';
      }

      case TEMAS.TRABAJADORES: {
        const [asistencias, trabajadores] = await Promise.all([
          prisma.asistencia.count({ where: { trabajador: { fincaId }, fecha: { gte: inicioDia, lt: finDia } } }),
          prisma.trabajador.count({ where: { fincaId, activo: true } }),
        ]);
        return `👷 Trabajadores activos: ${trabajadores}. Asistencias registradas hoy: ${asistencias}.`;
      }

      default: {
        const hace7 = new Date(inicioDia.getTime() - 7 * 86400000);
        const inicioMes = new Date(Date.UTC(inicioDia.getUTCFullYear(), inicioDia.getUTCMonth(), 1));
        const [labores, asistencias, alertas, cosecha, trabajadores, pendientes] = await Promise.all([
          prisma.labor.count({ where: { lote: { fincaId }, fecha: { gte: inicioDia, lt: finDia } } }),
          prisma.asistencia.count({ where: { trabajador: { fincaId }, fecha: { gte: inicioDia, lt: finDia } } }),
          prisma.observacion.count({ where: { lote: { fincaId }, severidad: { gte: 4 }, fecha: { gte: hace7 } } }),
          prisma.loteCosecha.aggregate({ _sum: { cantidadKg: true }, where: { campania: { lote: { fincaId } }, fechaCosecha: { gte: inicioMes } } }),
          prisma.trabajador.count({ where: { fincaId, activo: true } }),
          prisma.laborProgramada.count({ where: { lote: { fincaId }, estado: 'PENDIENTE', fechaProgramada: { lt: finDia } } }),
        ]);
        return (
          `📊 Resumen de hoy:\n• Labores registradas: ${labores}\n• Labores programadas pendientes: ${pendientes}\n• Asistencias: ${asistencias} de ${trabajadores} trabajadores\n` +
          `• Alertas fitosanitarias (severidad ≥4, 7 días): ${alertas}\n• Cosechado este mes: ${Math.round(cosecha._sum.cantidadKg || 0)} kg`
        );
      }
    }
  },
};
