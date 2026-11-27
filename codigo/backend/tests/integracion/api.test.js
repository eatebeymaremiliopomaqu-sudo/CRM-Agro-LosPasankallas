// Pruebas de API con supertest sobre la BD de prueba (prisma/test.db), creada y cargada por tests/setup/bd-prueba.js.
import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import crypto from 'node:crypto';
import request from 'supertest';
import { crearApp } from '../../src/app.js';
import { prisma } from '../../src/db.js';
import { firmaTwilio } from '../../src/services/whatsapp.js';
import { config } from '../../src/config.js';

const app = crearApp();
const tokens = {};
let lotes = {};
const hoy = new Date().toISOString().slice(0, 10);

const como = (rol) => ({ Authorization: `Bearer ${tokens[rol]}` });
const get = (rol, ruta) => request(app).get(ruta).set(como(rol));
const post = (rol, ruta, cuerpo) => request(app).post(ruta).set(como(rol)).send(cuerpo);
const put = (rol, ruta, cuerpo) => request(app).put(ruta).set(como(rol)).send(cuerpo);

beforeAll(async () => {
  for (const rol of ['propietario', 'encargado', 'trabajador']) {
    const r = await request(app).post('/api/auth/login').send({ email: `${rol}@finca.test`, password: 'Agro2026!' });
    expect(r.status).toBe(200);
    tokens[rol] = r.body.token;
  }
  const r = await get('encargado', '/api/lotes');
  lotes = Object.fromEntries(r.body.map((l) => [l.codigo, l]));
});
afterAll(() => prisma.$disconnect());

describe('Autenticación y validación (CP-SEG-02)', () => {
  it('credenciales incorrectas → 401 con mensaje genérico', async () => {
    const r = await request(app).post('/api/auth/login').send({ email: 'propietario@finca.test', password: 'incorrecta' });
    expect(r.status).toBe(401);
    expect(r.body.error).toBe('Credenciales incorrectas');
  });
  it('sin token o con token falso → 401', async () => {
    expect((await request(app).get('/api/lotes')).status).toBe(401);
    expect((await request(app).get('/api/lotes').set('Authorization', 'Bearer x.y.z')).status).toBe(401);
  });
  it('cuerpo inválido → 400 con detalles', async () => {
    const r = await post('encargado', '/api/campo/labores', { loteId: 'uno', tipo: 'NADA' });
    expect(r.status).toBe(400);
    expect(r.body.detalles.length).toBeGreaterThan(0);
  });
  it('salud y Swagger', async () => {
    expect((await request(app).get('/api/salud')).body.ok).toBe(true);
    const o = await request(app).get('/api/openapi.json');
    expect(Object.keys(o.body.paths).length).toBeGreaterThan(50);
  });
});

describe('Roles en la API (CP-SEG-01)', () => {
  it('trabajador: no ve ventas, finanzas ni trabajadores', async () => {
    expect((await get('trabajador', '/api/ventas')).status).toBe(403);
    expect((await get('trabajador', '/api/reportes/costos')).status).toBe(403);
    expect((await get('trabajador', '/api/trabajadores')).status).toBe(403);
  });
  it('trabajador no registra aplicaciones fitosanitarias', async () => {
    const r = await post('trabajador', '/api/campo/labores', { loteId: lotes['L-01'].id, tipo: 'FUMIGACION', aplicacion: { producto: 'FitoVerde SC (ficticio)', responsableTecnico: 'Juan Pérez' } });
    expect(r.status).toBe(403);
  });
  it('encargado no configura módulos ni ve finanzas', async () => {
    expect((await put('encargado', '/api/finca/modulos', { modulos: ['M1'] })).status).toBe(403);
    expect((await get('encargado', '/api/reportes/costos')).status).toBe(403);
  });
});

describe('Módulos activables por finca (CP-M0-01)', () => {
  it('desactivar M6 bloquea /api/vivero (403) y reactivarlo lo habilita', async () => {
    const todos = ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7'];
    expect((await put('propietario', '/api/finca/modulos', { modulos: todos.filter((m) => m !== 'M6') })).status).toBe(200);
    const bloqueado = await get('encargado', '/api/vivero');
    expect(bloqueado.status).toBe(403);
    expect(bloqueado.body.error).toMatch(/M6/);
    expect((await put('propietario', '/api/finca/modulos', { modulos: todos })).status).toBe(200);
    expect((await get('encargado', '/api/vivero')).status).toBe(200);
  });
  it('no se activa un módulo sin su dependencia', async () => {
    const r = await put('propietario', '/api/finca/modulos', { modulos: ['M5'] });
    expect(r.status).toBe(400);
    expect(r.body.detalles.join(' ')).toMatch(/M5 requiere activar M4/);
  });
});

describe('Respeto de la carencia (CP-M2-02)', () => {
  it('cosechar un lote en carencia → 409 con mensaje claro', async () => {
    const r = await post('encargado', '/api/trazabilidad/lotes', { campaniaId: lotes['L-05'].campaniaActual.id, fechaCosecha: hoy, cantidadKg: 10 });
    expect(r.status).toBe(409);
    expect(r.body.mensaje).toMatch(/El lote L-05 está en carencia hasta el/);
    expect(r.body.detalles.puedeForzar).toBe(false);
  });
  it('el propietario puede forzar solo con justificación, y queda en auditoría', async () => {
    const sin = await post('propietario', '/api/trazabilidad/lotes?forzar=true', { campaniaId: lotes['L-05'].campaniaActual.id, fechaCosecha: hoy, cantidadKg: 5 });
    expect(sin.status).toBe(400);
    const con = await post('propietario', '/api/trazabilidad/lotes?forzar=true', { campaniaId: lotes['L-05'].campaniaActual.id, fechaCosecha: hoy, cantidadKg: 5, justificacion: 'Cosecha para análisis de residuos en laboratorio' });
    expect(con.status).toBe(201);
    expect(con.body.advertencia).toMatch(/forzada/);
    const audit = await prisma.auditoria.findFirst({ where: { accion: 'FORZAR_CARENCIA' }, orderBy: { fecha: 'desc' } });
    expect(audit.detalle).toMatch(/Justificación/);
  });
  it('vender el lote cosechado en carencia → 409', async () => {
    const lc = await prisma.loteCosecha.findFirst({ where: { campaniaId: lotes['L-05'].campaniaActual.id } });
    const cli = (await get('encargado', '/api/clientes')).body[0];
    const r = await post('encargado', '/api/ventas', { clienteId: cli.id, detalles: [{ producto: 'Cebolla', cantidad: 1, unidad: 'kg', precioBs: 4, subtotal: 4, loteCosechaId: lc.id }] });
    expect(r.status).toBe(409);
  });
  it('un lote sin carencia se cosecha y entra al inventario', async () => {
    const antes = (await get('encargado', '/api/productos')).body.find((p) => p.cultivo === 'TOMATE').stock;
    const r = await post('encargado', '/api/trazabilidad/lotes', { campaniaId: lotes['L-02'].campaniaActual.id, fechaCosecha: hoy, cantidadKg: 30 });
    expect(r.status).toBe(201);
    expect(r.body.codigo).toMatch(/^FLM-\d{4}-\d{4}$/);
    const despues = (await get('encargado', '/api/productos')).body.find((p) => p.cultivo === 'TOMATE').stock;
    expect(despues).toBe(antes + 30);
  });
});

describe('Trazabilidad pública (CP-M2-10)', () => {
  it('ficha del QR sin datos personales y con la venta anonimizada', async () => {
    const lc = await prisma.loteCosecha.findFirst({ where: { detallesVenta: { some: {} } } });
    const r = await request(app).get(`/api/publico/lotes/${lc.tokenPublico}`);
    expect(r.status).toBe(200);
    expect(r.body.labores.length).toBeGreaterThan(0);
    expect(r.body.ventas.length).toBeGreaterThan(0);
    const texto = JSON.stringify(r.body);
    expect(texto).not.toMatch(/Mercado Abasto|El Frutero|La Quinta|Gonz[aá]lez|Su[aá]rez|591\d{8}|responsableTecnico|Ing\. Bruno/);
  });
  it('la consulta SQL documentada se ejecuta y no admite inyección', async () => {
    const lc = await prisma.loteCosecha.findFirst();
    const r = await request(app).get(`/api/publico/lotes/${lc.tokenPublico}/sql`);
    expect(r.status).toBe(200);
    expect(r.body.consultas.find((c) => c.nombre === 'origen').filas).toHaveLength(1);
    expect((await request(app).get(`/api/publico/lotes/${encodeURIComponent("x' OR '1'='1")}/sql`)).status).toBe(404);
  });
});

describe('Ventas y cuentas por cobrar (CP-M5-01)', () => {
  it('venta → cobro parcial → cobro total cambia el estado', async () => {
    const cli = (await get('encargado', '/api/clientes')).body[0];
    const prod = (await get('encargado', '/api/productos')).body.find((p) => p.cultivo === 'TOMATE');
    const v = await post('encargado', '/api/ventas', { clienteId: cli.id, detalles: [{ producto: prod.nombre, productoId: prod.id, cantidad: 10, unidad: 'kg', precioBs: 7, subtotal: 70 }] });
    expect(v.status).toBe(201);
    expect((await post('encargado', `/api/ventas/${v.body.id}/cobros`, { montoBs: 30 })).status).toBe(201);
    const parcial = (await get('encargado', `/api/ventas/${v.body.id}`)).body;
    expect(parcial.saldo).toBe(40);
    expect(parcial.estado).not.toBe('PAGADO');
    await post('encargado', `/api/ventas/${v.body.id}/cobros`, { montoBs: 40 });
    expect((await get('encargado', `/api/ventas/${v.body.id}`)).body.estado).toBe('PAGADO');
  });
  it('no se vende más de lo que hay en stock', async () => {
    const cli = (await get('encargado', '/api/clientes')).body[0];
    const prod = (await get('encargado', '/api/productos')).body[0];
    const r = await post('encargado', '/api/ventas', { clienteId: cli.id, detalles: [{ producto: prod.nombre, productoId: prod.id, cantidad: 999999, unidad: 'kg', precioBs: 1, subtotal: 1 }] });
    expect(r.status).toBe(400);
  });
  it('cuentas por cobrar', async () => {
    const r = await get('encargado', '/api/ventas/cuentas-por-cobrar');
    expect(r.status).toBe(200);
  });
});

describe('Tareas asignadas (CP-M3-10)', () => {
  it('el trabajador ve y completa solo sus tareas', async () => {
    const mias = (await get('trabajador', '/api/tareas/mis-tareas')).body;
    expect(mias.length).toBeGreaterThan(0);
    const propia = mias.find((t) => t.estado === 'PENDIENTE');
    expect((await put('trabajador', `/api/tareas/${propia.id}/completar`)).status).toBe(200);
    const todas = (await get('encargado', '/api/tareas')).body;
    const ajena = todas.find((t) => t.trabajador.id !== propia.trabajadorId && t.estado === 'PENDIENTE');
    expect((await put('trabajador', `/api/tareas/${ajena.id}/completar`)).status).toBe(403);
  });
  it('asignar a un trabajador sin consentimiento no envía WhatsApp', async () => {
    const t = (await get('encargado', '/api/trabajadores')).body.find((x) => !x.consentimientoWhatsapp);
    const r = await post('encargado', '/api/tareas', { trabajadorId: t.id, titulo: 'Prueba sin aviso', prioridad: 'BAJA' });
    expect(r.status).toBe(201);
    expect(r.body.notificada).toBe(false);
    expect(r.body.aviso.razon).toBe('SIN_CONSENTIMIENTO');
  });
});

describe('Webhooks de WhatsApp (CP-WA-05)', () => {
  const URL = 'http://localhost/api/webhooks/twilio';
  const enviarTwilio = (params, firma) => request(app).post('/api/webhooks/twilio').type('form').set('X-Twilio-Signature', firma).send(params);

  it('Twilio: firma inválida → 403', async () => {
    const r = await enviarTwilio({ From: 'whatsapp:+59170000002', Body: 'ayuda' }, 'firma-falsa');
    expect(r.status).toBe(403);
  });
  it('Twilio: firma válida → TwiML con la respuesta del agente y confirmación SI/NO', async () => {
    const p1 = { From: 'whatsapp:+59170000002', Body: 'regué el lote 2 por 2 horas', MessageSid: 'SM1' };
    const r1 = await enviarTwilio(p1, firmaTwilio('token-de-prueba', URL, p1));
    expect(r1.status).toBe(200);
    expect(r1.type).toMatch(/xml/);
    expect(r1.text).toMatch(/Voy a registrar/);
    const p2 = { From: 'whatsapp:+59170000002', Body: 'SI', MessageSid: 'SM2' };
    const r2 = await enviarTwilio(p2, firmaTwilio('token-de-prueba', URL, p2));
    expect(r2.text).toMatch(/Registrado/);
  });
  it('Twilio: el agente nunca recomienda dosis', async () => {
    const p = { From: 'whatsapp:+59170000002', Body: '¿cuánto AgroProtect le echo a la mochila?' };
    const r = await enviarTwilio(p, firmaTwilio('token-de-prueba', URL, p));
    expect(r.text).toMatch(/No puedo recomendar/);
  });
  it('Twilio: cliente sin consentimiento recibe pedido de ALTA y no puede pedir', async () => {
    const p = { From: 'whatsapp:+59166778899', Body: 'quiero 2 kg de tomate' };
    const r = await enviarTwilio(p, firmaTwilio('token-de-prueba', URL, p));
    expect(r.text).toMatch(/ALTA/);
    expect(await prisma.pedido.count({ where: { origen: 'WHATSAPP', cliente: { telefono: '59166778899' } } })).toBe(0);
  });
  it('Meta: firma HMAC inválida → 401, válida → 200', async () => {
    const cuerpo = { entry: [] };
    const mala = await request(app).post('/api/webhooks/whatsapp').set('X-Hub-Signature-256', 'sha256=00').send(cuerpo);
    expect(mala.status).toBe(401);
    const firma = 'sha256=' + crypto.createHmac('sha256', 'secreto-meta-de-prueba').update(JSON.stringify(cuerpo)).digest('hex');
    const buena = await request(app).post('/api/webhooks/whatsapp').set('Content-Type', 'application/json').set('X-Hub-Signature-256', firma).send(JSON.stringify(cuerpo));
    expect(buena.status).toBe(200);
  });
  it('Meta: verificación del webhook', async () => {
    const r = await request(app).get('/api/webhooks/whatsapp').query({ 'hub.mode': 'subscribe', 'hub.verify_token': config.whatsapp.verifyToken, 'hub.challenge': '123' });
    expect(r.text).toBe('123');
  });
  it('páginas públicas de privacidad y eliminación de datos (requisito de Meta)', async () => {
    const p = await request(app).get('/privacidad');
    expect(p.status).toBe(200);
    expect(p.type).toBe('text/html');
    expect(p.text).toContain('Política de privacidad');
    const e = await request(app).get('/eliminacion-datos');
    expect(e.status).toBe(200);
    expect(e.text).toContain('eliminación');
  });
});

describe('Alertas, vivero y reportes (CP-WA-04, CP-M6-01, CP-M7-01)', () => {
  it('alertas: vista previa y envío solo a quien dio consentimiento', async () => {
    const prev = await get('encargado', '/api/alertas');
    expect(prev.body.items.length).toBeGreaterThan(0);
    const env = await post('encargado', '/api/alertas/enviar');
    expect(env.status).toBe(200);
    expect(env.body.enviados.every((e) => e.estado === 'SIMULADO')).toBe(true);
    expect((await get('encargado', '/api/alertas/bitacora')).body.length).toBeGreaterThan(0);
  });
  it('vivero: % de germinación y disponibles', async () => {
    const r = await get('encargado', '/api/vivero');
    const tomate = r.body.find((l) => l.codigo === 'VIV-2026-01' || l.especie === 'Tomate');
    expect(tomate.porcentajeGerminacion).toBeGreaterThan(0);
    expect(tomate.disponibles).toBe(tomate.germinadas - tomate.merma - tomate.vendidos);
  });
  it('reportes: costos por lote, margen y CSV', async () => {
    const r = await get('propietario', '/api/reportes/costos');
    expect(r.status).toBe(200);
    for (const l of r.body.lotes) expect(l.costoTotal).toBeCloseTo(l.costoLabores + l.costoJornales + l.costoInsumos, 1);
    const csv = await get('propietario', '/api/reportes/costos.csv');
    expect(csv.text).toMatch(/Lote;Cultivo/);
  });
});
