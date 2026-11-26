// Alertas automáticas por WhatsApp: labores y riegos pendientes, aplicaciones programadas,
// stock bajo el mínimo, lotes que salen de carencia y cobros vencidos.
// Solo se envían a quien dio consentimiento (ADR-011). Cada envío queda en BitacoraAlerta.
import { prisma } from '../db.js';
import { config } from '../config.js';
import { enviarWhatsApp, proveedorWhatsApp } from './whatsapp.js';

const DIA = 86400000;
const DIAS_VENCIMIENTO_COBRO = 7; // ADR-017.3
const fmt = (f) => new Date(f).toLocaleDateString('es-BO', { timeZone: 'UTC', day: '2-digit', month: '2-digit' });
const bs = (n) => `Bs ${Number(n || 0).toFixed(2)}`;

export const TIPOS_ALERTA = {
  LABOR_HOY: 'Labores de hoy',
  LABOR_ATRASADA: 'Labores atrasadas',
  APLICACION_PROGRAMADA: 'Aplicaciones programadas',
  STOCK_MINIMO: 'Stock bajo el mínimo',
  FIN_CARENCIA: 'Lotes que salen de carencia',
  COBRO_VENCIDO: 'Cobros vencidos',
};

/** Inicio del día LOCAL (Bolivia, UTC-4 por defecto) expresado en UTC. */
export function inicioDiaLocal(ahora = new Date(), offsetMin = config.alertas.zonaHorariaMin) {
  const local = new Date(ahora.getTime() + offsetMin * 60000);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() - offsetMin * 60000);
}

/** "HH:MM" local actual. */
export function horaLocal(ahora = new Date(), offsetMin = config.alertas.zonaHorariaMin) {
  return new Date(ahora.getTime() + offsetMin * 60000).toISOString().slice(11, 16);
}

/**
 * Construye la lista de alertas a partir de los datos ya cargados. Función pura (se prueba sin BD).
 * @returns {Array<{ tipo: string, texto: string, trabajadorId?: number }>}
 */
export function armarAlertas({ programadas = [], insumos = [], productos = [], aplicaciones = [], ventas = [] }, ahora = new Date(), offsetMin = config.alertas.zonaHorariaMin) {
  const hoy = inicioDiaLocal(ahora, offsetMin);
  const manana = new Date(hoy.getTime() + DIA);
  const en3 = new Date(hoy.getTime() + 3 * DIA);
  const items = [];

  for (const p of programadas.filter((x) => x.estado === 'PENDIENTE')) {
    const f = new Date(p.fechaProgramada);
    const quien = p.responsable ? ` · ${p.responsable.nombre}` : '';
    const esAplicacion = ['FUMIGACION', 'FERTILIZACION'].includes(p.tipo);
    if (f < hoy) items.push({ tipo: 'LABOR_ATRASADA', texto: `${p.tipo} en ${p.lote.codigo} (era para el ${fmt(f)})${quien}`, trabajadorId: p.responsableId ?? undefined });
    else if (f < manana) items.push({ tipo: esAplicacion ? 'APLICACION_PROGRAMADA' : 'LABOR_HOY', texto: `${p.tipo === 'RIEGO' ? '💧 ' : ''}${p.tipo} en ${p.lote.codigo} hoy${quien}${p.descripcion ? ` — ${p.descripcion}` : ''}`, trabajadorId: p.responsableId ?? undefined });
    else if (esAplicacion && f < en3) items.push({ tipo: 'APLICACION_PROGRAMADA', texto: `${p.tipo} programada en ${p.lote.codigo} el ${fmt(f)}${quien}`, trabajadorId: p.responsableId ?? undefined });
  }

  for (const i of insumos) if (i.stockMinimo > 0 && i.stock <= i.stockMinimo) items.push({ tipo: 'STOCK_MINIMO', texto: `Insumo ${i.nombre}: ${i.stock} ${i.unidad} (mínimo ${i.stockMinimo})` });
  for (const p of productos) if (p.stockMinimo > 0 && p.stock <= p.stockMinimo) items.push({ tipo: 'STOCK_MINIMO', texto: `Producto ${p.nombre}: ${p.stock} ${p.unidad} (mínimo ${p.stockMinimo})` });

  for (const a of aplicaciones) {
    if (!a.periodoCarenciaDias) continue;
    const fin = new Date(new Date(a.fecha).getTime() + a.periodoCarenciaDias * DIA);
    if (fin >= hoy && fin < en3) items.push({ tipo: 'FIN_CARENCIA', texto: `${a.loteCodigo} sale de carencia el ${fmt(fin)} (${a.producto}). Antes de esa fecha no se cosecha.` });
  }

  const limite = new Date(ahora.getTime() - DIAS_VENCIMIENTO_COBRO * DIA);
  for (const v of ventas) if (v.saldo > 0 && new Date(v.fecha) < limite) items.push({ tipo: 'COBRO_VENCIDO', texto: `${v.cliente?.nombre || 'Cliente'} debe ${bs(v.saldo)} (venta #${v.id} del ${fmt(v.fecha)})` });

  return items;
}

/** Texto del mensaje (agrupado por tipo). */
export function mensajeAlertas(items, nombreFinca, ahora = new Date()) {
  if (!items.length) return `🌱 ${nombreFinca} · ${fmt(ahora)}: sin alertas para hoy. ¡Buen trabajo!`;
  const grupos = {};
  for (const i of items) (grupos[i.tipo] ||= []).push(i.texto);
  const partes = [`🔔 *Alertas ${nombreFinca}* · ${fmt(ahora)}`];
  for (const [tipo, textos] of Object.entries(grupos)) {
    partes.push(`\n*${TIPOS_ALERTA[tipo] || tipo}*`);
    for (const t of textos.slice(0, 8)) partes.push(`• ${t}`);
    if (textos.length > 8) partes.push(`• … y ${textos.length - 8} más`);
  }
  partes.push('\nResponde "labores pendientes" o "cuentas por cobrar" para más detalle. Escribe BAJA para no recibir alertas.');
  return partes.join('\n');
}

export async function datosAlertas(fincaId, ahora = new Date()) {
  const hoy = inicioDiaLocal(ahora);
  const [programadas, insumos, productos, labores, ventas] = await Promise.all([
    prisma.laborProgramada.findMany({ where: { lote: { fincaId }, estado: 'PENDIENTE', fechaProgramada: { lt: new Date(hoy.getTime() + 3 * DIA) } }, include: { lote: { select: { codigo: true } }, responsable: { select: { nombre: true } } } }),
    prisma.insumo.findMany({ where: { fincaId } }),
    prisma.productoCosechado.findMany({ where: { fincaId } }),
    prisma.labor.findMany({ where: { lote: { fincaId }, fecha: { gte: new Date(hoy.getTime() - 120 * DIA) }, aplicacion: { periodoCarenciaDias: { gt: 0 } } }, include: { aplicacion: true, lote: { select: { codigo: true } } } }),
    prisma.venta.findMany({ where: { cliente: { fincaId }, saldo: { gt: 0 } }, include: { cliente: { select: { nombre: true } } } }),
  ]);
  const aplicaciones = labores.map((l) => ({ fecha: l.fecha, periodoCarenciaDias: l.aplicacion.periodoCarenciaDias, producto: l.aplicacion.producto, loteCodigo: l.lote.codigo }));
  return { programadas, insumos, productos, aplicaciones, ventas };
}

export async function calcularAlertas(fincaId, ahora = new Date()) {
  return armarAlertas(await datosAlertas(fincaId, ahora), ahora);
}

/**
 * Envía las alertas del día:
 * - PROPIETARIO/ENCARGADO con teléfono y consentimiento: resumen completo.
 * - Trabajadores con consentimiento: solo las labores que tienen asignadas.
 */
export async function enviarAlertas(fincaId, { disparo = 'MANUAL', ahora = new Date() } = {}) {
  const finca = await prisma.finca.findUnique({ where: { id: fincaId } });
  const items = await calcularAlertas(fincaId, ahora);
  const [staff, trabajadores] = await Promise.all([
    prisma.usuario.findMany({ where: { fincaId, activo: true, rol: { in: ['PROPIETARIO', 'ENCARGADO'] }, telefono: { not: null } } }),
    prisma.trabajador.findMany({ where: { fincaId, activo: true, telefono: { not: null } } }),
  ]);

  const envios = [];
  let omitidos = 0;
  for (const u of staff) {
    if (!u.consentimientoWhatsapp) { omitidos++; continue; }
    envios.push({ destinatario: `${u.nombre} (${u.rol})`, telefono: u.telefono, items });
  }
  for (const t of trabajadores) {
    const propias = items.filter((i) => i.trabajadorId === t.id);
    if (!propias.length) continue;
    if (!t.consentimientoWhatsapp) { omitidos++; continue; }
    envios.push({ destinatario: `${t.nombre} (TRABAJADOR)`, telefono: t.telefono, items: propias });
  }

  const resultados = [];
  for (const e of envios) {
    const mensaje = mensajeAlertas(e.items, finca.nombre, ahora);
    const r = await enviarWhatsApp({ fincaId, telefono: e.telefono, texto: mensaje });
    const estado = !r.enviado ? 'FALLIDO' : r.simulado ? 'SIMULADO' : 'ENVIADO';
    await prisma.bitacoraAlerta.create({ data: { fincaId, tipo: 'RESUMEN_DIARIO', disparo, destinatario: e.destinatario, telefono: e.telefono, mensaje, cantidad: e.items.length, estado, error: r.error || null } });
    resultados.push({ destinatario: e.destinatario, estado, cantidad: e.items.length });
  }
  return { items, enviados: resultados, omitidosSinConsentimiento: omitidos, proveedor: proveedorWhatsApp().nombre };
}

/** Programador: cada minuto revisa si llegó la hora de alertas de cada finca y envía una vez al día. */
export function iniciarProgramadorAlertas({ intervaloMs = 60000 } = {}) {
  if (!config.alertas.activas) return null;
  const revisar = async () => {
    try {
      const ahora = new Date();
      const hora = horaLocal(ahora);
      const fincas = await prisma.finca.findMany({ where: { alertasActivas: true, whatsappActivo: true, horaAlertas: hora } });
      for (const f of fincas) {
        const yaEnviado = await prisma.bitacoraAlerta.count({ where: { fincaId: f.id, disparo: 'PROGRAMADO', fecha: { gte: inicioDiaLocal(ahora) } } });
        if (!yaEnviado) await enviarAlertas(f.id, { disparo: 'PROGRAMADO', ahora });
      }
    } catch (e) {
      console.error('[alertas] error en el programador:', e.message);
    }
  };
  const id = setInterval(revisar, intervaloMs);
  id.unref?.();
  return id;
}
