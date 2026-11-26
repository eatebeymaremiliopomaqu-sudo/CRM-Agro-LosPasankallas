// Datos 100 % FICTICIOS para demostración. Ningún nombre, documento ni teléfono es real.
// Historia de la demo (fechas relativas a "hoy"):
//   L-02 Tomate  → sin carencia: se puede cosechar por WhatsApp ("hoy cosechamos 40 kg de tomate del lote 2")
//   L-05 Cebolla → en carencia (fumigación hace 3 días, 14 d): el sistema bloquea la cosecha (409)
//   L-04 Papa    → sale de carencia mañana (alerta FIN_CARENCIA); su cosecha anterior fue antes de la aplicación
//   Cosechas pasadas respetaron siempre la carencia → fichas QR con "✔ carencia respetada"
//   Ventas con cobros completos, parciales y vencidos; stock bajo en frutilla y en un agroquímico
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

const prisma = new PrismaClient();

// Pseudoaleatorio determinista (siempre los mismos datos)
let semilla = 42;
const azar = () => ((semilla = (semilla * 16807) % 2147483647) - 1) / 2147483646;
/** Fecha relativa al día de HOY en Bolivia (UTC-4), a las 12:00 UTC (08:00 locales). */
const hoyLocal = new Date(Date.now() - 4 * 3600000);
const dia = (offset, hora = 12) => new Date(Date.UTC(hoyLocal.getUTCFullYear(), hoyLocal.getUTCMonth(), hoyLocal.getUTCDate() + offset, hora));
const iniciales = 'FLM'; // Finca Los Molles

async function limpiar() {
  // Orden inverso a las dependencias
  const modelos = [
    'cobro', 'detalleVenta', 'venta', 'lotePlantin', 'detallePedido', 'pedido', 'movimientoProducto', 'movimientoInsumo',
    'bitacoraAlerta', 'mensajeWhatsApp', 'accionPendiente', 'eventoTrazabilidad', 'loteCosecha', 'productoCosechado',
    'aplicacion', 'laborProgramada', 'labor', 'insumo', 'cliente', 'observacion', 'pago', 'asistencia', 'tarea',
    'campania', 'lote', 'auditoria', 'usuario', 'trabajador', 'moduloFinca', 'finca',
  ];
  for (const m of modelos) if (prisma[m]) await prisma[m].deleteMany();
}

async function main() {
  console.log('🌱 Limpiando datos…');
  await limpiar();

  // ───────────── M0 · Finca, módulos, trabajadores y usuarios ─────────────
  const finca = await prisma.finca.create({
    data: {
      nombre: 'Finca Los Molles', municipio: 'Comarapa', departamento: 'Santa Cruz', lat: -17.9135, lng: -64.5312, hectareas: 6.5,
      whatsappActivo: true, telefonoWa: '59170000000', alertasActivas: true, horaAlertas: '07:00',
    },
  });
  for (const codigo of ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7']) await prisma.moduloFinca.create({ data: { fincaId: finca.id, codigo, activo: true } });

  const hash = await bcrypt.hash('Agro2026!', 10);
  const defTrab = [
    ['Juan Pérez Choque', 'CAPATAZ', 150, true],
    ['María Flores Condori', 'JORNALERO', 110, true],
    ['Pedro Gutiérrez Mamani', 'TRACTORISTA', 140, true],
    ['Rosa Copa Huanca', 'JORNALERO', 110, true],
    ['Luis Ticona Apaza', 'REGADOR', 110, false],
    ['Elena Cruz Saavedra', 'JORNALERO', 110, false],
    ['Marcos Limachi Ríos', 'JORNALERO', 110, true],
    ['Sofía Arce Velasco', 'JORNALERO', 110, false],
  ];
  const trabajadores = [];
  for (const [i, [nombre, cargo, jornalBs, consiente]] of defTrab.entries()) {
    trabajadores.push(await prisma.trabajador.create({
      data: {
        fincaId: finca.id, nombre, cargo, jornalBs, documento: `FICT-${1000 + i}`, telefono: `5917100${String(i).padStart(4, '0')}`,
        consentimientoWhatsapp: consiente, fechaConsentimiento: consiente ? dia(-40) : null,
      },
    }));
  }
  const [juan, maria, pedro, rosa, luis] = trabajadores;

  const usuarios = {};
  for (const [clave, nombre, rol, tel, trabajadorId] of [
    ['propietario', 'Ana Quispe (Propietaria)', 'PROPIETARIO', '59170000001', null],
    ['encargado', 'Ing. Bruno Rojas (Encargado)', 'ENCARGADO', '59170000002', null],
    ['trabajador', 'Juan Pérez (Capataz)', 'TRABAJADOR', '59170000003', juan.id],
  ]) {
    usuarios[clave] = await prisma.usuario.create({
      data: { nombre, email: `${clave}@finca.test`, passwordHash: hash, rol, telefono: tel, fincaId: finca.id, trabajadorId, consentimientoWhatsapp: true, fechaConsentimiento: dia(-40) },
    });
  }

  // ───────────── M0 · Lotes de campo y campañas ─────────────
  const defLotes = [
    ['L-01', 'Bajío del río', 1.2, 'Franco arenoso', 'GOTEO', 'Frutilla', 'Albión', -150],
    ['L-02', 'Ladera norte', 0.9, 'Franco', 'ASPERSION', 'Tomate', 'Santa Cruz Kada', -100],
    ['L-03', 'Media luna', 1.0, 'Franco arcilloso', 'GOTEO', 'Pimentón', 'California Wonder', -95],
    ['L-04', 'El molle grande', 1.5, 'Franco', 'GRAVEDAD', 'Papa', 'Desirée', -120],
    ['L-05', 'Potrero chico', 0.8, 'Arenoso', 'ASPERSION', 'Cebolla', 'Roja arequipeña', -85],
    ['L-06', 'La esquina', 1.1, 'Franco limoso', 'SECANO', 'Maíz choclo', 'Blanco Comarapa', -30],
  ];
  const lotes = {};
  for (const [i, [codigo, nombre, areaHa, tipoSuelo, riego, cultivo, variedad, siembra]] of defLotes.entries()) {
    const l = await prisma.lote.create({
      data: {
        fincaId: finca.id, codigo, nombre, areaHa, tipoSuelo, riego,
        lat: -17.9135 + (Math.floor(i / 3) - 0.5) * 0.0024, lng: -64.5312 + ((i % 3) - 1) * 0.0028,
      },
    });
    const c = await prisma.campania.create({ data: { loteId: l.id, cultivo, variedad, fechaSiembra: dia(siembra), fechaCosechaEst: dia(siembra + 120) } });
    lotes[codigo] = { ...l, campania: c, siembra };
  }

  // ───────────── M4 · Insumos (con costo para valorizar en M7) ─────────────
  const insumos = {};
  for (const [clave, nombre, categoria, unidad, stock, stockMinimo, costoUnitBs] of [
    ['semTomate', 'Semilla de tomate (sobre 1000 u)', 'SEMILLA', 'sobre', 6, 2, 180],
    ['npk', 'NutriSuelo 15-15-15 (ficticio)', 'FERTILIZANTE', 'kg', 120, 50, 9.5],
    ['agroProtect', 'AgroProtect 50 (ficticio)', 'AGROQUIMICO', 'L', 3, 5, 145],
    ['fitoVerde', 'FitoVerde SC (ficticio)', 'AGROQUIMICO', 'L', 8, 2, 210],
    ['cinta', 'Cinta de goteo 16 mm', 'OTRO', 'rollo', 4, 1, 650],
    ['cajas', 'Cajas plásticas 20 kg', 'OTRO', 'u', 90, 40, 35],
    ['mochila', 'Mochila fumigadora 20 L', 'HERRAMIENTA', 'u', 3, 2, 420],
  ]) {
    insumos[clave] = await prisma.insumo.create({ data: { fincaId: finca.id, nombre, categoria, unidad, stock, stockMinimo, costoUnitBs } });
  }
  for (const [ins, tipo, cantidad, motivo, d] of [
    ['npk', 'ENTRADA', 150, 'Compra a proveedor (ficticio)', -60],
    ['agroProtect', 'ENTRADA', 10, 'Compra a proveedor (ficticio)', -40],
    ['fitoVerde', 'ENTRADA', 12, 'Compra a proveedor (ficticio)', -40],
    ['cajas', 'ENTRADA', 100, 'Compra de cajas', -20],
  ]) await prisma.movimientoInsumo.create({ data: { insumoId: insumos[ins].id, tipo, cantidad, motivo, fecha: dia(d) } });

  // ───────────── M1 · Labores realizadas ─────────────
  const crearLabor = async (cod, tipo, d, { horas = 3, costoBs = 0, trabajador = null, descripcion, origen = 'WEB', aplicacion = null } = {}) => {
    const l = lotes[cod];
    return prisma.labor.create({
      data: {
        loteId: l.id, campaniaId: l.campania.id, tipo, fecha: dia(d), horas, costoBs, trabajadorId: trabajador?.id ?? null,
        descripcion: descripcion || `${tipo.toLowerCase()} en ${l.nombre}`, origen, registradoPorId: usuarios.encargado.id,
        ...(aplicacion ? { aplicacion: { create: { responsableTecnico: usuarios.encargado.nombre, ...aplicacion } } } : {}),
      },
    });
  };
  const responsables = [juan, maria, pedro, rosa, luis];
  for (const [n, cod] of Object.keys(lotes).entries()) {
    const l = lotes[cod];
    await crearLabor(cod, 'SIEMBRA', l.siembra, { horas: 8, costoBs: 120, trabajador: pedro, descripcion: `Siembra/trasplante de ${l.campania.cultivo}` });
    // Riegos cada 6 días en los últimos 60 días (secano no se riega)
    if (l.riego !== 'SECANO') {
      for (let d = Math.max(l.siembra + 3, -60) + n; d <= -1; d += 6) await crearLabor(cod, 'RIEGO', d, { horas: 2, trabajador: luis, origen: d % 4 === 0 ? 'WHATSAPP' : 'WEB' });
    }
    await crearLabor(cod, 'FERTILIZACION', Math.max(l.siembra + 20, -50), { horas: 3, trabajador: maria, aplicacion: { producto: insumos.npk.nombre, insumoId: insumos.npk.id, cantidadUsada: Math.round(l.areaHa * 25), unidad: 'kg' } });
    await crearLabor(cod, 'DESHIERBE', Math.max(l.siembra + 30, -20), { horas: 6, trabajador: rosa });
    await crearLabor(cod, 'MONITOREO', -7 - n, { horas: 1, trabajador: juan, descripcion: 'Recorrido de monitoreo fitosanitario' });
  }
  // Aplicaciones fitosanitarias (fechas pensadas para que las cosechas respeten la carencia)
  const fum = (insumo, motivo, dias, cantidadUsada, dosisEtiqueta, ingredienteActivo) => ({ producto: insumo.nombre, insumoId: insumo.id, motivo, periodoCarenciaDias: dias, cantidadUsada, unidad: 'L', dosisEtiqueta, ingredienteActivo });
  for (const [cod, d, ap, desc] of [
    ['L-01', -22, fum(insumos.fitoVerde, 'Ácaros', 7, 0.8, '0.5 L por 200 L de agua (según etiqueta)', 'Ingrediente B'), 'Control de ácaros en frutilla'],
    ['L-02', -25, fum(insumos.agroProtect, 'Polilla del tomate', 14, 1.2, '2.5 L/ha (según etiqueta)', 'Ingrediente A'), 'Control de polilla'],
    ['L-02', -16, fum(insumos.fitoVerde, 'Mosca blanca', 7, 0.9, '0.5 L por 200 L de agua (según etiqueta)', 'Ingrediente B'), 'Control de mosca blanca'],
    ['L-03', -14, fum(insumos.fitoVerde, 'Pulgón', 7, 0.7, null, 'Ingrediente B'), 'Control de pulgón'],
    ['L-04', -30, fum(insumos.agroProtect, 'Gusano blanco', 14, 2.0, '2.5 L/ha (según etiqueta)', 'Ingrediente A'), 'Control de gusano blanco'],
    ['L-04', -13, fum(insumos.agroProtect, 'Tizón tardío', 14, 2.2, '2.5 L/ha (según etiqueta)', 'Ingrediente A'), 'Aplicación preventiva de tizón (después de la cosecha)'],
    ['L-05', -12, fum(insumos.fitoVerde, 'Trips', 7, 0.6, null, 'Ingrediente B'), 'Control de trips'],
    ['L-05', -3, fum(insumos.agroProtect, 'Gusano cogollero', 14, 1.4, '2.5 L/ha (según etiqueta)', 'Ingrediente A'), 'Control de gusano cogollero'],
  ]) await crearLabor(cod, 'FUMIGACION', d, { horas: 3, costoBs: 30, trabajador: juan, descripcion: desc, aplicacion: ap });

  // ───────────── M1 · Calendario de labores (programadas) ─────────────
  for (const [cod, tipo, d, resp, desc] of [
    ['L-02', 'RIEGO', 0, juan, 'Riego por aspersión 2 h'],
    ['L-01', 'RIEGO', 0, maria, 'Revisar goteros antes de regar'],
    ['L-05', 'MONITOREO', 0, juan, 'Revisar daño de cogollero tras la aplicación'],
    ['L-03', 'DESHIERBE', -2, pedro, 'Deshierbe entre surcos (atrasado por lluvia)'],
    ['L-04', 'RIEGO', 1, luis, 'Riego por gravedad'],
    ['L-02', 'FUMIGACION', 2, null, 'Aplicación programada por el encargado (ver etiqueta)'],
    ['L-06', 'FERTILIZACION', 3, maria, 'Primera fertilización del maíz'],
    ['L-03', 'PODA', 5, rosa, 'Poda de brotes laterales'],
    ['L-01', 'MONITOREO', 7, juan, 'Monitoreo semanal'],
  ]) await prisma.laborProgramada.create({ data: { loteId: lotes[cod].id, tipo, fechaProgramada: dia(d), responsableId: resp?.id ?? null, estado: 'PENDIENTE', descripcion: desc } });
  for (const [cod, tipo, d] of [['L-02', 'RIEGO', -7], ['L-01', 'RIEGO', -6], ['L-03', 'MONITOREO', -9]]) {
    const labor = await crearLabor(cod, tipo, d, { horas: 2, trabajador: luis, descripcion: 'Realizada desde el calendario' });
    await prisma.laborProgramada.create({ data: { loteId: lotes[cod].id, tipo, fechaProgramada: dia(d), responsableId: luis.id, estado: 'HECHA', descripcion: 'Programada', laborRealizadaId: labor.id } });
  }
  for (const [cod, tipo, d] of [['L-04', 'PODA', -4], ['L-06', 'DESHIERBE', -1]]) {
    await prisma.laborProgramada.create({ data: { loteId: lotes[cod].id, tipo, fechaProgramada: dia(d), estado: 'CANCELADA', descripcion: 'Cancelada por lluvia' } });
  }

  // ───────────── M1 · Observaciones ─────────────
  for (const [cod, tipo, severidad, nota, d, origen] of [
    ['L-05', 'PLAGA', 4, 'Daño de gusano cogollero en 30 % de plantas', -4, 'WHATSAPP'],
    ['L-02', 'PLAGA', 2, 'Pocas moscas blancas en el envés', -10, 'WEB'],
    ['L-01', 'ENFERMEDAD', 3, 'Síntomas iniciales de oídio en frutilla', -6, 'WEB'],
    ['L-04', 'ENFERMEDAD', 3, 'Manchas de tizón en hojas bajeras', -14, 'WHATSAPP'],
    ['L-03', 'CLIMA', 2, 'Granizada leve, hojas perforadas', -9, 'WEB'],
    ['L-06', 'SUELO', 2, 'Encharcamiento en la cabecera', -2, 'WEB'],
  ]) await prisma.observacion.create({ data: { loteId: lotes[cod].id, tipo, severidad, nota, fecha: dia(d), origen } });

  // ───────────── M3 · Asistencias (últimos 30 días, lunes a sábado) ─────────────
  const codigos = Object.keys(lotes);
  for (let d = -30; d <= -1; d++) {
    const fecha = dia(d);
    if (fecha.getUTCDay() === 0) continue;
    for (const [i, t] of trabajadores.entries()) {
      if (azar() < 0.35) continue;
      const cod = codigos[(i + d + 60) % codigos.length];
      await prisma.asistencia.create({ data: { trabajadorId: t.id, fecha, horas: azar() < 0.2 ? 4 : 8, tarea: ['RIEGO', 'DESHIERBE', 'COSECHA', 'PODA', 'MONITOREO'][(i + d + 60) % 5], loteId: azar() < 0.4 ? null : lotes[cod].id } }); // sin lote = tareas generales (galpón, vivero)
    }
  }
  await prisma.pago.create({ data: { trabajadorId: juan.id, desde: dia(-30), hasta: dia(-16), dias: 12, montoBs: 1800, estado: 'PAGADO' } });
  await prisma.pago.create({ data: { trabajadorId: maria.id, desde: dia(-30), hasta: dia(-16), dias: 11, montoBs: 1210, estado: 'PAGADO' } });

  // ───────────── M2 · Lotes de cosecha (QR) + M4 · entradas al inventario ─────────────
  const productos = {};
  for (const [clave, nombre, cultivo, unidad, stockMinimo, precioVentaBs] of [
    ['FRUTILLA', 'Frutilla Primera', 'FRUTILLA', 'kg', 30, 22],
    ['TOMATE', 'Tomate Santa Cruz', 'TOMATE', 'kg', 50, 7],
    ['PIMENTON', 'Pimentón Rojo', 'PIMENTON', 'kg', 20, 9],
    ['PAPA', 'Papa Desirée', 'PAPA', 'kg', 80, 3.5],
  ]) productos[clave] = await prisma.productoCosechado.create({ data: { fincaId: finca.id, nombre, cultivo, unidad, stock: 0, stockMinimo, precioVentaBs } });

  const cosechas = {};
  let correlativo = 0;
  for (const [clave, cod, producto, kg, d, destino, calidad] of [
    ['papa1', 'L-04', 'PAPA', 900, -15, 'Mercado Abasto Santa Cruz', 'PRIMERA'],
    ['frut1', 'L-01', 'FRUTILLA', 180, -12, 'Supermercado El Frutero', 'PRIMERA'],
    ['tom1', 'L-02', 'TOMATE', 420, -8, 'Mercado Abasto Santa Cruz', 'PRIMERA'],
    ['pim1', 'L-03', 'PIMENTON', 160, -6, 'Restaurante La Quinta', 'PRIMERA'],
    ['frut2', 'L-01', 'FRUTILLA', 60, -5, 'Venta directa', 'PRIMERA'],
    ['tom2', 'L-02', 'TOMATE', 300, -2, 'Por despachar', 'SEGUNDA'],
  ]) {
    const f = dia(d);
    const l = lotes[cod];
    const lc = await prisma.loteCosecha.create({
      data: {
        codigo: `${iniciales}-${f.getUTCFullYear()}-${String(++correlativo).padStart(4, '0')}`,
        campaniaId: l.campania.id, fechaCosecha: f, cantidadKg: kg, calidad, destino, tokenPublico: crypto.randomBytes(12).toString('base64url'),
        eventos: {
          create: [
            { tipo: 'COSECHA', fecha: f, detalle: `Cosecha de ${kg} kg en ${cod}` },
            { tipo: 'ACOPIO', fecha: dia(d, 15), detalle: 'Acopio en el galpón de la finca' },
            { tipo: 'EMPAQUE', fecha: dia(d, 18), detalle: 'Cajas de 20 kg con etiqueta QR' },
            ...(d <= -3 ? [{ tipo: 'DESPACHO', fecha: dia(d + 1, 11), detalle: `Despachado a ${destino}` }] : []),
          ],
        },
      },
    });
    cosechas[clave] = lc;
    await prisma.movimientoProducto.create({ data: { productoId: productos[producto].id, tipo: 'ENTRADA', cantidad: kg, motivo: 'COSECHA', referencia: lc.codigo, fecha: f } });
    await prisma.productoCosechado.update({ where: { id: productos[producto].id }, data: { stock: { increment: kg } } });
  }
  await prisma.movimientoProducto.create({ data: { productoId: productos.TOMATE.id, tipo: 'SALIDA', cantidad: 12, motivo: 'MERMA', referencia: 'Fruta dañada en transporte', fecha: dia(-7) } });
  await prisma.productoCosechado.update({ where: { id: productos.TOMATE.id }, data: { stock: { decrement: 12 } } });

  // ───────────── M5 · Clientes ─────────────
  const clientes = {};
  for (const [clave, nombre, tipo, telefono, consiente, direccion, nit] of [
    ['abasto', 'Mercado Abasto Santa Cruz (ficticio)', 'MAYORISTA', '59133445566', true, 'Av. Irala #245, Santa Cruz', 'FICT-10345678'],
    ['frutero', 'Supermercado El Frutero (ficticio)', 'MAYORISTA', '59144556677', true, 'Calle Libertad #890, Comarapa', 'FICT-20456789'],
    ['quinta', 'Restaurante La Quinta (ficticio)', 'RESTAURANTE', '59155667788', true, 'Plaza Principal s/n, Comarapa', 'FICT-30567890'],
    ['feria', 'Feria de Comarapa', 'MERCADO', null, false, 'Plaza de la Feria, Comarapa', null],
    ['gonzalez', 'María González (minorista)', 'MINORISTA', '59166778899', false, null, null],
    ['suarez', 'Pedro Suárez (intermediario)', 'MINORISTA', '59177889900', true, null, null],
  ]) {
    clientes[clave] = await prisma.cliente.create({ data: { fincaId: finca.id, nombre, tipo, telefono, consentimientoWhatsapp: consiente, fechaConsentimiento: consiente ? dia(-25) : null, direccion, nit } });
  }

  // ───────────── M5 · Pedidos ─────────────
  const pedido = (cli, d, entrega, estado, origen, notas, detalles) =>
    prisma.pedido.create({
      data: { clienteId: clientes[cli].id, fecha: dia(d), fechaEntrega: entrega == null ? null : dia(entrega), estado, origen, notas, total: detalles.reduce((s, x) => s + x.cantidad * x.precioBs, 0), detalles: { create: detalles.map((x) => ({ ...x, subtotal: Math.round(x.cantidad * x.precioBs * 100) / 100 })) } },
    });
  await pedido('abasto', -16, -15, 'ENTREGADO', 'WEB', 'Entrega 6:00 AM', [{ producto: 'Papa Desirée', cantidad: 600, unidad: 'kg', precioBs: 3.5 }]);
  await pedido('frutero', -2, 2, 'CONFIRMADO', 'WEB', 'Entrega entre 10 y 12', [{ producto: 'Tomate Santa Cruz', cantidad: 80, unidad: 'kg', precioBs: 7 }, { producto: 'Frutilla Primera', cantidad: 10, unidad: 'kg', precioBs: 22 }]);
  await pedido('quinta', -1, 1, 'PENDIENTE', 'WEB', 'Productos frescos para el fin de semana', [{ producto: 'Pimentón Rojo', cantidad: 15, unidad: 'kg', precioBs: 9 }]);
  await pedido('suarez', 0, 2, 'PENDIENTE', 'WHATSAPP', 'Pedido recibido por WhatsApp: 3 caja de Frutilla Primera', [{ producto: 'Frutilla Primera', cantidad: 3, unidad: 'caja', precioBs: 0 }]);

  // ───────────── M5 · Ventas (vinculadas a lotes de cosecha), cobros y salidas de inventario ─────────────
  const LIMITE_VENCIMIENTO = 7;
  const venta = async (cli, d, items, pagos, notas) => {
    const total = items.reduce((s, x) => s + x.cantidad * x.precioBs, 0);
    const pagado = pagos.reduce((s, p) => s + p.montoBs, 0);
    const estado = pagado >= total ? 'PAGADO' : d < -LIMITE_VENCIMIENTO ? 'VENCIDO' : 'PENDIENTE';
    const v = await prisma.venta.create({
      data: {
        clienteId: clientes[cli].id, fecha: dia(d), total, pagado, saldo: total - pagado, estado, notas,
        detalles: { create: items.map((x) => ({ producto: productos[x.p].nombre, cantidad: x.cantidad, unidad: 'kg', precioBs: x.precioBs, subtotal: x.cantidad * x.precioBs, loteCosechaId: cosechas[x.lc]?.id ?? null })) },
        cobros: { create: pagos.map((p) => ({ ...p, fecha: dia(p.d), d: undefined })) },
      },
    });
    for (const x of items) {
      await prisma.movimientoProducto.create({ data: { productoId: productos[x.p].id, tipo: 'SALIDA', cantidad: x.cantidad, motivo: 'VENTA', referencia: `Venta #${v.id}`, fecha: dia(d) } });
      await prisma.productoCosechado.update({ where: { id: productos[x.p].id }, data: { stock: { decrement: x.cantidad } } });
    }
    await prisma.eventoTrazabilidad.createMany({ data: [...new Set(items.map((x) => x.lc).filter(Boolean))].map((lc) => ({ loteId: cosechas[lc].id, tipo: 'VENTA', fecha: dia(d, 16), detalle: `Venta a cliente ${clientes[cli].tipo.toLowerCase()}` })) });
    return v;
  };
  await venta('abasto', -15, [{ p: 'PAPA', cantidad: 600, precioBs: 3.5, lc: 'papa1' }], [{ d: -15, montoBs: 2100, metodo: 'TRANSFERENCIA', recibo: 'TRF-0101' }], 'Pago al contado');
  await venta('frutero', -11, [{ p: 'FRUTILLA', cantidad: 150, precioBs: 22, lc: 'frut1' }], [{ d: -11, montoBs: 2000, metodo: 'EFECTIVO', recibo: 'REC-0201' }], 'Crédito a 7 días: saldo pendiente');
  await venta('suarez', -9, [{ p: 'PAPA', cantidad: 200, precioBs: 3.5, lc: 'papa1' }], [{ d: -9, montoBs: 300, metodo: 'QR', recibo: 'QR-0301' }], 'Intermediario: pago parcial');
  await venta('quinta', -5, [{ p: 'TOMATE', cantidad: 120, precioBs: 7, lc: 'tom1' }, { p: 'PIMENTON', cantidad: 40, precioBs: 9, lc: 'pim1' }], [{ d: -5, montoBs: 1200, metodo: 'EFECTIVO', recibo: 'REC-0202' }], 'Pago en efectivo');
  await venta('abasto', -4, [{ p: 'TOMATE', cantidad: 250, precioBs: 6.5, lc: 'tom1' }], [], 'Crédito a 7 días');
  await venta('quinta', -2, [{ p: 'FRUTILLA', cantidad: 45, precioBs: 24, lc: 'frut2' }], [{ d: -1, montoBs: 500, metodo: 'TRANSFERENCIA', recibo: 'TRF-0102' }], 'Pago parcial');
  await venta('gonzalez', -1, [{ p: 'FRUTILLA', cantidad: 30, precioBs: 25, lc: 'frut1' }], [{ d: -1, montoBs: 750, metodo: 'EFECTIVO', recibo: null }], 'Venta directa en la finca');

  // ───────────── M6 · Vivero (lotes de plantines) y venta por M5 ─────────────
  const plantines = {};
  for (const [clave, codigo, especie, variedad, d, bandejas, sembradas, germinadas, merma, etapa, precioBs, costoBs] of [
    ['tom', 'VIV-2026-01', 'Tomate', 'Santa Cruz Kada', -40, 10, 2000, 1840, 60, 'LISTO', 0.8, 620],
    ['lec', 'VIV-2026-02', 'Lechuga', 'Crespa', -28, 6, 1200, 1050, 30, 'LISTO', 0.5, 310],
    ['pim', 'VIV-2026-03', 'Pimentón', 'California Wonder', -15, 5, 1000, 640, 0, 'CRECIMIENTO', 0.9, 280],
    ['frut', 'VIV-2026-04', 'Frutilla', 'Albión (estolones)', -5, 4, 800, 0, 0, 'GERMINACION', 1.5, 900],
  ]) {
    plantines[clave] = await prisma.lotePlantin.create({
      data: { fincaId: finca.id, codigo, especie, variedad, fechaSiembra: dia(d), bandejas, semillasSembradas: sembradas, germinadas, merma, etapa, precioBs, costoBs, fechaListo: etapa === 'LISTO' ? dia(d + 30) : null },
    });
  }
  for (const [cli, d, lp, cantidad, precio] of [['suarez', -6, 'tom', 600, 0.8], ['gonzalez', -3, 'lec', 200, 0.5]]) {
    const total = cantidad * precio;
    const l = plantines[lp];
    await prisma.venta.create({
      data: {
        clienteId: clientes[cli].id, fecha: dia(d), total, pagado: total, saldo: 0, estado: 'PAGADO', notas: 'Venta de plantines del vivero',
        detalles: { create: [{ producto: `Plantín de ${l.especie.toLowerCase()} ${l.variedad}`, cantidad, unidad: 'plantin', precioBs: precio, subtotal: total, lotePlantinId: l.id }] },
        cobros: { create: [{ fecha: dia(d), montoBs: total, metodo: 'EFECTIVO' }] },
      },
    });
    await prisma.lotePlantin.update({ where: { id: l.id }, data: { vendidos: { increment: cantidad } } });
  }

  // ───────────── M3 · Tareas asignadas ─────────────
  for (const [t, por, titulo, descripcion, cod, prioridad, estado, venc, notificada] of [
    [juan, 'encargado', 'Revisar sistema de riego en L-01', 'Verificar goteros y fugas antes del riego', 'L-01', 'ALTA', 'PENDIENTE', 1, true],
    [juan, 'encargado', 'Monitoreo fitosanitario semanal', 'Recorrer todos los lotes y anotar plagas', null, 'ALTA', 'EN_CURSO', 0, true],
    [juan, 'propietario', 'Preparar cajas para el pedido del supermercado', '80 kg de tomate y 10 kg de frutilla', 'L-02', 'URGENTE', 'PENDIENTE', 2, true],
    [juan, 'encargado', 'Señalizar L-05 en carencia', 'Poner cartel "No cosechar" hasta fin de carencia', 'L-05', 'URGENTE', 'PENDIENTE', 0, true],
    [juan, 'encargado', 'Recolectar muestras de suelo', 'Para análisis de fertilidad', 'L-06', 'BAJA', 'PENDIENTE', 10, true],
    [juan, 'encargado', 'Limpieza del galpón de acopio', null, null, 'MEDIA', 'COMPLETADA', -2, true],
    [maria, 'encargado', 'Deshierbe en L-03', 'Eliminar malezas entre surcos', 'L-03', 'MEDIA', 'PENDIENTE', 1, true],
    [maria, 'propietario', 'Cosecha de frutilla en L-01', 'Solo fruta madura, primera calidad', 'L-01', 'ALTA', 'COMPLETADA', -5, true],
    [pedro, 'encargado', 'Preparar terreno de L-06', 'Arado y nivelación', 'L-06', 'BAJA', 'EN_CURSO', 4, true],
    [rosa, 'encargado', 'Poda de brotes en L-03', null, 'L-03', 'MEDIA', 'PENDIENTE', 5, true],
    [luis, 'encargado', 'Riego por gravedad en L-04', 'Luis no dio consentimiento: aviso solo en persona', 'L-04', 'MEDIA', 'PENDIENTE', 1, false],
    [rosa, 'encargado', 'Revisión de mochilas fumigadoras', null, null, 'BAJA', 'CANCELADA', -3, true],
  ]) {
    await prisma.tarea.create({
      data: {
        trabajadorId: t.id, asignadoPorId: usuarios[por].id, titulo, descripcion, loteId: cod ? lotes[cod].id : null, prioridad, estado,
        fechaAsignacion: dia(Math.min(venc, 0) - 2), fechaVencimiento: dia(venc), fechaCompletada: estado === 'COMPLETADA' ? dia(venc) : null, notificada,
      },
    });
  }

  // ───────────── WhatsApp: conversación de ejemplo y bitácora de alertas ─────────────
  for (const [h, direccion, texto] of [
    [9, 'ENTRANTE', 'regué el lote 2 por 2 horas'],
    [9, 'SALIENTE', '📝 Voy a registrar:\nLabor *RIEGO* en L-02, 2 h.\n¿Confirmas? Responde *SI* para guardar o *NO* para cancelar.'],
    [9, 'ENTRANTE', 'si'],
    [9, 'SALIENTE', '✅ Registrado. Labor guardada en L-02.'],
    [10, 'ENTRANTE', 'cuánto AgroProtect le echo a la mochila?'],
    [10, 'SALIENTE', '⚠️ No puedo recomendar productos, dosis ni mezclas de agroquímicos. Esa decisión corresponde al ingeniero agrónomo responsable.'],
  ]) await prisma.mensajeWhatsApp.create({ data: { fincaId: finca.id, telefono: '59170000002', direccion, texto, fecha: dia(-1, h + 4) } });
  for (const u of [usuarios.propietario, usuarios.encargado]) {
    await prisma.bitacoraAlerta.create({ data: { fincaId: finca.id, tipo: 'RESUMEN_DIARIO', disparo: 'PROGRAMADO', destinatario: `${u.nombre} (${u.rol})`, telefono: u.telefono, mensaje: '🔔 Alertas Finca Los Molles (ejemplo del día anterior)', cantidad: 4, estado: 'SIMULADO', fecha: dia(-1, 11) } });
  }

  const totales = {
    plantines: await prisma.lotePlantin.count(), labores: await prisma.labor.count(), cosechas: await prisma.loteCosecha.count(), ventas: await prisma.venta.count(), tareas: await prisma.tarea.count(),
  };
  console.log('✅ Datos ficticios cargados.');
  console.log('   Usuarios: propietario|encargado|trabajador @finca.test · clave: Agro2026!');
  console.log(`   ${totales.plantines} lotes de plantines · ${totales.labores} labores · ${totales.cosechas} lotes de cosecha · ${totales.ventas} ventas · ${totales.tareas} tareas`);
  console.log('   Demo: L-02 (tomate) libre para cosechar · L-05 (cebolla) en carencia · L-04 sale de carencia mañana');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
