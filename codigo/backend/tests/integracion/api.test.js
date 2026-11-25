// Pruebas de integración de la API (requieren `npm install` y una BD de prueba).
// Ejecutar:  DATABASE_URL="file:./test.db" npx prisma db push --force-reset && npm run db:seed && npm run test:int
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { crearApp } from '../../src/app.js';
import { prisma } from '../../src/db.js';

const app = crearApp();
const tokens = {};

async function login(email) {
  const r = await request(app).post('/api/auth/login').send({ email, password: 'Agro2026!' });
  assert.equal(r.status, 200, r.text);
  return r.body.token;
}

before(async () => {
  for (const rol of ['propietario', 'encargado', 'trabajador', 'consulta']) tokens[rol] = await login(`${rol}@finca.test`);
});
after(async () => {
  await prisma.$disconnect();
});

const como = (rol) => ({ Authorization: `Bearer ${tokens[rol]}` });

describe('Autenticación (CP-SEG-02)', () => {
  it('rechaza credenciales incorrectas con mensaje genérico', async () => {
    const r = await request(app).post('/api/auth/login').send({ email: 'propietario@finca.test', password: 'incorrecta' });
    assert.equal(r.status, 401);
    assert.equal(r.body.error, 'Credenciales incorrectas');
  });
  it('rechaza rutas protegidas sin token o con token falso', async () => {
    assert.equal((await request(app).get('/api/lotes')).status, 401);
    assert.equal((await request(app).get('/api/lotes').set('Authorization', 'Bearer abc.def.ghi')).status, 401);
  });
  it('valida el cuerpo del login', async () => {
    const r = await request(app).post('/api/auth/login').send({ email: 'no-es-email' });
    assert.equal(r.status, 400);
  });
});

describe('Autorización por rol (CP-SEG-03)', () => {
  it('CONSULTA no puede crear lotes', async () => {
    const r = await request(app).post('/api/lotes').set(como('consulta')).send({ codigo: 'L-90', nombre: 'Prueba', areaHa: 1 });
    assert.equal(r.status, 403);
  });
  it('TRABAJADOR no puede registrar aplicaciones de agroquímicos', async () => {
    const lotes = (await request(app).get('/api/lotes').set(como('trabajador'))).body;
    const r = await request(app).post('/api/campo/labores').set(como('trabajador')).send({
      loteId: lotes[0].id, tipo: 'FUMIGACION', aplicacion: { producto: 'X', responsableTecnico: 'Alguien' },
    });
    assert.equal(r.status, 403);
  });
  it('ENCARGADO sí puede', async () => {
    const lotes = (await request(app).get('/api/lotes').set(como('encargado'))).body;
    const r = await request(app).post('/api/campo/labores').set(como('encargado')).send({
      loteId: lotes[0].id, tipo: 'FUMIGACION', horas: 2, aplicacion: { producto: 'Producto ficticio', cantidadUsada: 1, unidad: 'L', responsableTecnico: 'Ing. Rojas' },
    });
    assert.equal(r.status, 201, r.text);
    assert.equal(r.body.aplicacion.producto, 'Producto ficticio');
  });
});

describe('M1–M4 flujo principal', () => {
  it('crea lote, siembra, lote de trazabilidad y la vista pública del QR', async () => {
    const p = await request(app).post('/api/lotes').set(como('propietario')).send({ codigo: `L-${80 + Math.floor(Math.random() * 19)}`, nombre: 'Lote prueba', areaHa: 0.5 });
    assert.equal(p.status, 201, p.text);
    const s = await request(app).post(`/api/lotes/${p.body.id}/siembras`).set(como('propietario')).send({ cultivo: 'Lechuga', fechaSiembra: '2026-09-01' });
    assert.equal(s.status, 201);
    const l = await request(app).post('/api/trazabilidad/lotes').set(como('encargado')).send({ siembraId: s.body.id, fechaCosecha: '2026-11-20', cantidadKg: 120 });
    assert.equal(l.status, 201);
    assert.match(l.body.codigo, /^FLM-2026-\d{4}$/);
    const pub = await request(app).get(`/api/publico/lotes/${l.body.tokenPublico}`);
    assert.equal(pub.status, 200);
    assert.equal(pub.body.producto, 'Lechuga');
    assert.equal(pub.body.trabajadores, undefined, 'no debe exponer datos de trabajadores');
  });
  it('token público inexistente = 404', async () => {
    assert.equal((await request(app).get('/api/publico/lotes/no-existe')).status, 404);
  });
  it('pasar lista es idempotente', async () => {
    const t = (await request(app).get('/api/trabajadores').set(como('trabajador'))).body[0];
    const cuerpo = { registros: [{ trabajadorId: t.id, fecha: '2026-11-21', horas: 8 }] };
    await request(app).post('/api/trabajadores/asistencias').set(como('trabajador')).send(cuerpo);
    const r = await request(app).post('/api/trabajadores/asistencias').set(como('trabajador')).send(cuerpo);
    assert.equal(r.status, 201);
    const n = await prisma.asistencia.count({ where: { trabajadorId: t.id, fecha: new Date('2026-11-21T12:00:00.000Z') } });
    assert.equal(n, 1);
  });
});

describe('Módulos activables (CP-M0-01)', () => {
  it('desactivar M6 bloquea /api/insumos y reactivarlo lo habilita', async () => {
    await request(app).put('/api/finca/modulos').set(como('propietario')).send({ modulos: ['M1', 'M2', 'M3', 'M4', 'M5'] });
    assert.equal((await request(app).get('/api/insumos').set(como('propietario'))).status, 403);
    await request(app).put('/api/finca/modulos').set(como('propietario')).send({ modulos: ['M1', 'M2', 'M3', 'M4', 'M5', 'M6'] });
    assert.equal((await request(app).get('/api/insumos').set(como('propietario'))).status, 200);
  });
  it('rechaza activar M2 sin M1', async () => {
    const r = await request(app).put('/api/finca/modulos').set(como('propietario')).send({ modulos: ['M2'] });
    assert.equal(r.status, 400);
  });
});

describe('M5 Agente por API (CP-M5-02)', () => {
  it('registro con confirmación por WhatsApp simulado', async () => {
    const r1 = await request(app).post('/api/agente/whatsapp/simular').set(como('trabajador')).send({ telefono: '70000003', texto: 'regué el lote 1 por 2 horas' });
    assert.equal(r1.body.estado, 'PENDIENTE');
    const r2 = await request(app).post('/api/agente/whatsapp/simular').set(como('trabajador')).send({ telefono: '70000003', texto: 'SI' });
    assert.equal(r2.body.estado, 'REGISTRADO');
  });
  it('rechaza pedidos de dosis', async () => {
    const r = await request(app).post('/api/agente/mensaje').set(como('encargado')).send({ texto: '¿qué dosis de fungicida uso?' });
    assert.equal(r.body.estado, 'RECHAZADO');
  });
  it('webhook: verificación de Meta', async () => {
    const r = await request(app).get('/api/webhooks/whatsapp').query({ 'hub.mode': 'subscribe', 'hub.verify_token': process.env.WHATSAPP_VERIFY_TOKEN || 'crm-agro-verify', 'hub.challenge': '12345' });
    assert.equal(r.text, '12345');
  });
});
