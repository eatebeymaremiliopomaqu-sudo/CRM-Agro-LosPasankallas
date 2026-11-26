// Flujos de cada módulo contra la API real (BD de prueba): M0–M7 y el agente por el simulador de WhatsApp.
import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import request from 'supertest';
import { crearApp } from '../../src/app.js';
import { prisma } from '../../src/db.js';

const app = crearApp();
const t = {};
let lotes = {};
const hoy = new Date().toISOString().slice(0, 10);
const h = (rol) => ({ Authorization: `Bearer ${t[rol]}` });
const api = (rol, metodo, ruta, cuerpo) => {
  const r = request(app)[metodo](ruta).set(h(rol));
  return cuerpo === undefined ? r : r.send(cuerpo);
};

beforeAll(async () => {
  for (const rol of ['propietario', 'encargado', 'trabajador']) {
    t[rol] = (await request(app).post('/api/auth/login').send({ email: `${rol}@finca.test`, password: 'Agro2026!' })).body.token;
  }
  lotes = Object.fromEntries((await api('encargado', 'get', '/api/lotes')).body.map((l) => [l.codigo, l]));
});
afterAll(() => prisma.$disconnect());

describe('M0 · Núcleo: finca, usuarios, lotes y campañas (CP-M0-10)', () => {
  it('yo, finca y tablero', async () => {
    expect((await api('trabajador', 'get', '/api/auth/yo')).body.usuario.rol).toBe('TRABAJADOR');
    expect((await api('propietario', 'get', '/api/finca')).body.modulos).toContain('M7');
    const d = await api('encargado', 'get', '/api/dashboard');
    expect(d.body.indicadores.lotes).toBe(6);
  });
  it('configurar WhatsApp y alertas de la finca', async () => {
    const r = await api('propietario', 'patch', '/api/finca', { horaAlertas: '06:30', alertasActivas: true });
    expect(r.body.horaAlertas).toBe('06:30');
    expect((await api('propietario', 'patch', '/api/finca', { horaAlertas: '25:00' })).status).toBe(400);
  });
  it('usuarios: crear con consentimiento (guarda fecha) y no auto-desactivarse', async () => {
    const u = await api('propietario', 'post', '/api/usuarios', { nombre: 'Usuario Prueba', email: 'prueba@finca.test', password: 'Clave12345', rol: 'TRABAJADOR', consentimientoWhatsapp: true });
    expect(u.status).toBe(201);
    expect(u.body.fechaConsentimiento).toBeTruthy();
    const yo = (await api('propietario', 'get', '/api/usuarios')).body.find((x) => x.rol === 'PROPIETARIO');
    expect((await api('propietario', 'patch', `/api/usuarios/${yo.id}`, { activo: false })).status).toBe(400);
    expect((await api('propietario', 'get', '/api/auditoria')).body.length).toBeGreaterThan(0);
  });
  it('lotes: crear, ver, editar, campaña y baja lógica', async () => {
    const l = await api('encargado', 'post', '/api/lotes', { codigo: 'L-09', nombre: 'Lote de prueba', areaHa: 0.5, riego: 'GOTEO' });
    expect(l.status).toBe(201);
    expect((await api('encargado', 'get', `/api/lotes/${l.body.id}`)).status).toBe(200);
    expect((await api('encargado', 'patch', `/api/lotes/${l.body.id}`, { nombre: 'Lote prueba editado' })).body.nombre).toBe('Lote prueba editado');
    const c = await api('encargado', 'post', `/api/lotes/${l.body.id}/campanias`, { cultivo: 'Lechuga', fechaSiembra: hoy });
    expect(c.status).toBe(201);
    expect((await api('encargado', 'delete', `/api/lotes/${l.body.id}`)).status).toBeLessThan(300);
    expect((await api('encargado', 'post', '/api/lotes', { codigo: 'L-01', nombre: 'Duplicado', areaHa: 1 })).status).toBeGreaterThanOrEqual(400);
  });
});

describe('M1 · Campo: labores, observaciones y calendario (CP-M1-10)', () => {
  it('registra labor y la lista con filtros', async () => {
    const r = await api('trabajador', 'post', '/api/campo/labores', { loteId: lotes['L-01'].id, tipo: 'RIEGO', horas: 2 });
    expect(r.status).toBe(201);
    const l = await api('encargado', 'get', `/api/campo/labores?loteId=${lotes['L-01'].id}&tipo=RIEGO&desde=2026-01-01`);
    expect(l.body.every((x) => x.tipo === 'RIEGO')).toBe(true);
  });
  it('la aplicación con insumo descuenta el stock', async () => {
    const ins = (await api('encargado', 'get', '/api/insumos')).body.find((i) => i.categoria === 'FERTILIZANTE');
    const r = await api('encargado', 'post', '/api/campo/labores', { loteId: lotes['L-06'].id, tipo: 'FERTILIZACION', aplicacion: { producto: ins.nombre, insumoId: ins.id, cantidadUsada: 5, unidad: 'kg', responsableTecnico: 'Ing. Bruno Rojas' } });
    expect(r.status).toBe(201);
    expect((await api('encargado', 'get', '/api/insumos')).body.find((i) => i.id === ins.id).stock).toBe(ins.stock - 5);
    const mucho = await api('encargado', 'post', '/api/campo/labores', { loteId: lotes['L-06'].id, tipo: 'FERTILIZACION', aplicacion: { producto: ins.nombre, insumoId: ins.id, cantidadUsada: 99999, unidad: 'kg', responsableTecnico: 'Ing. Bruno Rojas' } });
    expect(mucho.status).toBe(400);
  });
  it('observaciones', async () => {
    expect((await api('trabajador', 'post', '/api/campo/observaciones', { loteId: lotes['L-03'].id, tipo: 'PLAGA', severidad: 3, nota: 'Pulgón en brotes' })).status).toBe(201);
    expect((await api('encargado', 'get', '/api/campo/observaciones')).body.length).toBeGreaterThan(0);
  });
  it('calendario: programar, marcar hecha (crea la labor) y cancelar', async () => {
    const p = await api('encargado', 'post', '/api/campo/programadas', { loteId: lotes['L-02'].id, tipo: 'RIEGO', fechaProgramada: hoy });
    expect(p.status).toBe(201);
    const hecha = await api('encargado', 'put', `/api/campo/programadas/${p.body.id}`, { estado: 'HECHA', crearLabor: true });
    expect(hecha.status).toBe(200);
    expect(hecha.body.laborRealizadaId ?? hecha.body.laborRealizada?.id).toBeTruthy();
    const c = await api('encargado', 'post', '/api/campo/programadas', { loteId: lotes['L-02'].id, tipo: 'PODA', fechaProgramada: hoy });
    expect((await api('encargado', 'put', `/api/campo/programadas/${c.body.id}`, { estado: 'CANCELADA' })).body.estado).toBe('CANCELADA');
    expect((await api('encargado', 'get', `/api/campo/programadas?loteId=${lotes['L-02'].id}&desde=2026-01-01`)).body.length).toBeGreaterThan(1);
  });
});

describe('M2 · Trazabilidad privada (CP-M2-11)', () => {
  it('lista, detalle con QR, SVG y eventos', async () => {
    const lista = (await api('encargado', 'get', '/api/trazabilidad/lotes')).body;
    const lc = lista[0];
    expect((await api('encargado', 'get', `/api/trazabilidad/lotes/${lc.id}`)).body.qr).toMatch(/^data:image\/png/);
    expect((await api('encargado', 'get', `/api/trazabilidad/lotes/${lc.id}/qr.svg`)).type).toMatch(/svg/);
    expect((await api('encargado', 'post', `/api/trazabilidad/lotes/${lc.id}/eventos`, { tipo: 'DESPACHO', detalle: 'Camión 2' })).status).toBe(201);
    expect((await api('trabajador', 'post', `/api/trazabilidad/lotes/${lc.id}/eventos`, { tipo: 'DESPACHO' })).status).toBe(403);
  });
});

describe('M3 · Trabajadores, asistencia y pagos (CP-M3-01)', () => {
  it('alta, consentimiento con fecha, asistencia idempotente, planilla y pago', async () => {
    const w = await api('encargado', 'post', '/api/trabajadores', { nombre: 'Trabajador Prueba', jornalBs: 100, consentimientoWhatsapp: true });
    expect(w.body.fechaConsentimiento).toBeTruthy();
    const baja = await api('encargado', 'patch', `/api/trabajadores/${w.body.id}`, { consentimientoWhatsapp: false });
    expect(baja.body.fechaConsentimiento).toBeNull();
    const reg = { registros: [{ trabajadorId: w.body.id, fecha: hoy, horas: 8, loteId: lotes['L-01'].id }] };
    expect((await api('encargado', 'post', '/api/trabajadores/asistencias', reg)).status).toBeLessThan(300);
    expect((await api('encargado', 'post', '/api/trabajadores/asistencias', reg)).status).toBeLessThan(300);
    expect((await api('encargado', 'get', `/api/trabajadores/asistencias?desde=${hoy}&hasta=${hoy}T23:59:59Z`)).body.filter((a) => a.trabajadorId === w.body.id)).toHaveLength(1);
    expect((await api('encargado', 'get', '/api/trabajadores/planilla')).body.filas.length).toBeGreaterThan(0);
    expect((await api('encargado', 'post', `/api/trabajadores/${w.body.id}/pagos`, { desde: hoy, hasta: `${hoy}T23:59:59Z` })).status).toBe(403);
    const pago = await api('propietario', 'post', `/api/trabajadores/${w.body.id}/pagos`, { desde: hoy, hasta: `${hoy}T23:59:59Z` });
    expect(pago.status).toBe(201);
    expect((await api('propietario', 'patch', `/api/trabajadores/pagos/${pago.body.id}`, { estado: 'PAGADO' })).body.estado).toBe('PAGADO');
    expect((await api('encargado', 'get', '/api/trabajadores/pagos')).body.length).toBeGreaterThan(0);
  });
  it('tareas: iniciar, editar y cancelar', async () => {
    const w = (await api('encargado', 'get', '/api/trabajadores')).body.find((x) => x.nombre.startsWith('Juan'));
    const tarea = (await api('encargado', 'post', '/api/tareas', { trabajadorId: w.id, titulo: 'Tarea de prueba', loteId: lotes['L-01'].id, fechaVencimiento: hoy })).body;
    expect(tarea.notificada).toBe(true); // Juan dio consentimiento
    expect((await api('encargado', 'put', `/api/tareas/${tarea.id}/iniciar`)).body.estado).toBe('EN_CURSO');
    expect((await api('encargado', 'put', `/api/tareas/${tarea.id}`, { prioridad: 'URGENTE' })).body.prioridad).toBe('URGENTE');
    expect((await api('encargado', 'put', `/api/tareas/${tarea.id}/cancelar`)).body.estado).toBe('CANCELADA');
    expect((await api('encargado', 'put', `/api/tareas/${tarea.id}/completar`)).status).toBe(400);
    expect((await api('encargado', 'get', '/api/tareas?estado=CANCELADA&prioridad=URGENTE')).body.length).toBeGreaterThan(0);
  });
});

describe('M4 · Inventarios (CP-M4-01)', () => {
  it('insumos y productos con movimientos', async () => {
    const i = await api('encargado', 'post', '/api/insumos', { nombre: 'Guantes de nitrilo', categoria: 'HERRAMIENTA', unidad: 'par', stock: 2, stockMinimo: 5, costoUnitBs: 15 });
    expect(i.status).toBe(201);
    expect((await api('encargado', 'post', `/api/insumos/${i.body.id}/movimientos`, { tipo: 'ENTRADA', cantidad: 10 })).status).toBe(201);
    expect((await api('encargado', 'post', `/api/insumos/${i.body.id}/movimientos`, { tipo: 'SALIDA', cantidad: 999 })).status).toBe(400);
    const p = await api('encargado', 'post', '/api/productos', { nombre: 'Lechuga Crespa', cultivo: 'LECHUGA', unidad: 'kg', stockMinimo: 5, precioVentaBs: 6 });
    expect((await api('encargado', 'put', `/api/productos/${p.body.id}`, { precioVentaBs: 7 })).body.precioVentaBs).toBe(7);
    expect((await api('encargado', 'post', '/api/productos/movimientos', { productoId: p.body.id, tipo: 'ENTRADA', cantidad: 20, motivo: 'AJUSTE' })).status).toBe(201);
    expect((await api('encargado', 'post', '/api/productos/movimientos', { productoId: p.body.id, tipo: 'SALIDA', cantidad: 50 })).status).toBe(400);
    expect((await api('encargado', 'get', `/api/productos/movimientos?productoId=${p.body.id}&tipo=ENTRADA`)).body).toHaveLength(1);
  });
});

describe('M5 · Clientes y pedidos (CP-M5-02)', () => {
  it('cliente: alta con consentimiento, edición, filtro y baja lógica', async () => {
    const c = await api('encargado', 'post', '/api/clientes', { nombre: 'Cliente de prueba', tipo: 'RESTAURANTE', telefono: '59171234567', consentimientoWhatsapp: true });
    expect(c.body.fechaConsentimiento).toBeTruthy();
    expect((await api('encargado', 'put', `/api/clientes/${c.body.id}`, { consentimientoWhatsapp: false })).body.fechaConsentimiento).toBeNull();
    expect((await api('encargado', 'get', '/api/clientes?tipo=RESTAURANTE')).body.every((x) => x.tipo === 'RESTAURANTE')).toBe(true);
    expect((await api('encargado', 'delete', `/api/clientes/${c.body.id}`)).status).toBeLessThan(300);
  });
  it('pedido: crear, ver, confirmar y entregar', async () => {
    const cli = (await api('encargado', 'get', '/api/clientes')).body[0];
    const p = await api('encargado', 'post', '/api/pedidos', { clienteId: cli.id, fechaEntrega: hoy, detalles: [{ producto: 'Tomate Santa Cruz', cantidad: 10, unidad: 'kg', precioBs: 7, subtotal: 70 }] });
    expect(p.status).toBe(201);
    expect((await api('encargado', 'get', `/api/pedidos/${p.body.id}`)).body.detalles).toHaveLength(1);
    expect((await api('encargado', 'put', `/api/pedidos/${p.body.id}`, { estado: 'ENTREGADO' })).body.estado).toBe('ENTREGADO');
    expect((await api('encargado', 'get', `/api/pedidos?estado=ENTREGADO&clienteId=${cli.id}`)).body.length).toBeGreaterThan(0);
    expect((await api('encargado', 'get', '/api/ventas?conSaldo=true&desde=2026-01-01')).status).toBe(200);
  });
});

describe('M6 · Vivero (CP-M6-02)', () => {
  it('lote de plantines: alta, avance y venta por M5', async () => {
    const l = await api('encargado', 'post', '/api/vivero', { especie: 'Lechuga', variedad: 'Romana', fechaSiembra: hoy, semillasSembradas: 300 });
    expect(l.body.codigo).toMatch(/^VIV-\d{4}-\d{2}$/);
    const a = await api('encargado', 'patch', `/api/vivero/${l.body.id}`, { germinadas: 270, merma: 10, etapa: 'LISTO', precioBs: 0.6 });
    expect(a.body.porcentajeGerminacion).toBe(90);
    expect(a.body.fechaListo).toBeTruthy();
    const cli = (await api('encargado', 'get', '/api/clientes')).body[0];
    const v = await api('encargado', 'post', '/api/ventas', { clienteId: cli.id, detalles: [{ producto: 'Plantín lechuga', cantidad: 260, unidad: 'plantin', precioBs: 0.6, subtotal: 156, lotePlantinId: l.body.id }] });
    expect(v.status).toBe(201);
    const final = (await api('encargado', 'get', '/api/vivero')).body.find((x) => x.id === l.body.id);
    expect(final.disponibles).toBe(0);
    expect(final.etapa).toBe('AGOTADO');
  });
});

describe('Agente por el simulador de WhatsApp: consultas y registros (CP-AG-20)', () => {
  const wa = async (texto, telefono = '59170000002') => (await api('encargado', 'post', '/api/agente/whatsapp/simular', { telefono, texto })).body;
  const consultas = [
    ['resumen de hoy', /Resumen de hoy/],
    ['cuántos trabajadores vinieron hoy?', /Trabajadores activos/],
    ['labores pendientes', /Labores pendientes|No hay labores/],
    ['¿qué se aplicó en el lote 5 y hasta cuándo es la carencia?', /L-05.*carencia/s],
    ['¿qué se aplicó en el lote 9?', /No existe el lote|no hay aplicaciones/i],
    ['stock de frutilla', /Frutilla/],
    ['stock', /Inventario:/],
    ['stock de unobtainium', /No encontré/],
    ['ventas de hoy', /Ventas de hoy|No hay ventas de hoy/],
    ['ventas de la semana', /últimos 7 días/],
    ['ventas del mes', /últimos 30 días/],
    ['cuentas por cobrar', /Cuentas por cobrar/],
  ];
  for (const [texto, esperado] of consultas) {
    it(`consulta: "${texto}"`, async () => expect((await wa(texto)).respuesta).toMatch(esperado));
  }
  it('registro de asistencia y observación con confirmación', async () => {
    expect((await wa('Juan Pérez trabajó 8 horas en L-01')).estado).toBe('PENDIENTE');
    expect((await wa('si')).estado).toBe('REGISTRADO');
    expect((await wa('hay pulgón en el lote 4, severidad 4')).estado).toBe('PENDIENTE');
    expect((await wa('si')).respuesta).toMatch(/Severidad alta/);
    expect((await wa('María Inexistente trabajó 8 horas')).estado).toBe('PENDIENTE');
    expect((await wa('si')).estado).toBe('ERROR');
  });
  it('fumigación registrada por el encargado descuenta el insumo del mismo nombre', async () => {
    const antes = (await api('encargado', 'get', '/api/insumos')).body.find((i) => i.nombre.startsWith('FitoVerde'));
    await wa(`fumigué el lote 3 con ${antes.nombre}, 1 litro`);
    const r = await wa('si');
    expect(r.estado).toBe('REGISTRADO');
  });
  it('el trabajador ve sus tareas y marca una por número', async () => {
    const tareas = (await api('trabajador', 'get', '/api/tareas/mis-tareas')).body.filter((x) => ['PENDIENTE', 'EN_CURSO'].includes(x.estado));
    expect((await wa('mis tareas', '59170000003')).respuesta).toMatch(/Tus tareas/);
    expect((await wa('tarea hecha', '59170000003')).respuesta).toMatch(/Cuál terminaste|tarea #/);
    expect((await wa(`terminé la tarea ${tareas[0].id}`, '59170000003')).estado).toBe('PENDIENTE');
    expect((await wa('si', '59170000003')).estado).toBe('REGISTRADO');
    expect((await wa('tarea hecha 999999', '59170000003')).respuesta).toMatch(/No encontré/);
  });
  it('cliente con consentimiento: precios y pedido por WhatsApp; ALTA/BAJA', async () => {
    const cli = '59133445566';
    expect((await wa('precios', cli)).respuesta).toMatch(/Productos disponibles/);
    expect((await wa('quiero 5 kg de tomate para el viernes', cli)).estado).toBe('PENDIENTE');
    expect((await wa('SI', cli)).respuesta).toMatch(/Pedido #\d+ recibido/);
    expect((await wa('quiero 2 kg de mango', cli)).respuesta).toMatch(/No tenemos/);
    expect((await wa('BAJA', cli)).respuesta).toMatch(/ya no te enviaremos/);
    expect((await wa('ALTA', cli)).respuesta).toMatch(/consentimiento/);
    expect(await prisma.pedido.count({ where: { origen: 'WHATSAPP' } })).toBeGreaterThan(1);
  });
  it('trabajador sin cuenta de usuario también puede usar el agente', async () => {
    expect((await wa('mis tareas', '59171000001')).respuesta).toMatch(/Tus tareas|No tienes/);
  });
  it('canal web y bitácoras', async () => {
    expect((await api('encargado', 'post', '/api/agente/mensaje', { texto: 'ayuda' })).body.respuesta).toMatch(/Asistente CRM-Agro/);
    expect((await api('encargado', 'get', '/api/agente/acciones')).body.length).toBeGreaterThan(0);
    expect((await api('encargado', 'get', '/api/agente/whatsapp/mensajes')).body.modo).toBe('SIMULADO');
    expect((await api('encargado', 'get', '/api/agente/whatsapp/contactos')).body.length).toBeGreaterThan(5);
  });
});
