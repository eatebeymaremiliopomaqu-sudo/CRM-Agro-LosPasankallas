import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { calcularPago, diasEquivalentes, planilla } from '../../src/services/nomina.js';
import { puede, modulosDe, tieneModulo, validarActivacion, PERMISOS } from '../../src/utils/permisos.js';
import { codigoLote, inicialesFinca, tokenPublico, normalizarTelefono } from '../../src/utils/codigos.js';
import { extraerMensajes, verificarFirma, crearClienteWhatsApp } from '../../src/services/whatsapp.js';

describe('Nómina de jornales (CP-M4-01)', () => {
  it('8 horas = 1 jornal', () => {
    assert.deepEqual(calcularPago([{ horas: 8 }, { horas: 8 }, { horas: 4 }], 110), { dias: 2.5, montoBs: 275 });
  });
  it('sin asistencias paga 0', () => assert.deepEqual(calcularPago([], 120), { dias: 0, montoBs: 0 }));
  it('rechaza horas inválidas y jornales negativos', () => {
    assert.throws(() => diasEquivalentes([{ horas: 30 }]), RangeError);
    assert.throws(() => diasEquivalentes([{ horas: 'x' }]), RangeError);
    assert.throws(() => diasEquivalentes('nada'), TypeError);
    assert.throws(() => calcularPago([], -5), RangeError);
  });
  it('planilla agrupa, omite sin registros y ordena por monto', () => {
    const t = [{ id: 1, nombre: 'A', jornalBs: 100 }, { id: 2, nombre: 'B', jornalBs: 150 }, { id: 3, nombre: 'C', jornalBs: 100 }];
    const a = [{ trabajadorId: 1, horas: 8 }, { trabajadorId: 2, horas: 8 }, { trabajadorId: 2, horas: 8 }];
    const p = planilla(t, a);
    assert.equal(p.length, 2);
    assert.equal(p[0].nombre, 'B');
    assert.equal(p[0].montoBs, 300);
  });
});

describe('Roles y permisos RBAC (CP-SEG-01)', () => {
  it('sólo ADMIN configura la finca y gestiona usuarios', () => {
    assert.equal(puede('ADMIN', 'finca:configurar'), true);
    for (const rol of ['TECNICO', 'SUPERVISOR', 'CONSULTA']) assert.equal(puede(rol, 'usuarios:gestionar'), false);
  });
  it('sólo técnico/admin registran aplicaciones de agroquímicos', () => {
    assert.equal(puede('TECNICO', 'aplicaciones:escribir'), true);
    assert.equal(puede('SUPERVISOR', 'aplicaciones:escribir'), false);
  });
  it('CONSULTA no escribe en ningún módulo', () => {
    const escrituras = Object.keys(PERMISOS).filter((p) => /escribir|gestionar|configurar|usar/.test(p));
    for (const p of escrituras) assert.equal(puede('CONSULTA', p), false, p);
  });
  it('permiso desconocido o rol inválido = denegado', () => {
    assert.equal(puede('ADMIN', 'no:existe'), false);
    assert.equal(puede('HACKER', 'parcelas:leer'), false);
  });
});

describe('Módulos activables por finca (CP-M0-02)', () => {
  it('M0 siempre activo y filtra módulos desconocidos', () => {
    assert.deepEqual(modulosDe({ modulosActivos: '["M1","M9","M3"]' }), ['M0', 'M1', 'M3']);
    assert.deepEqual(modulosDe({ modulosActivos: 'json roto' }), ['M0']);
    assert.deepEqual(modulosDe(null), ['M0']);
  });
  it('tieneModulo', () => {
    const f = { modulosActivos: '["M1","M4"]' };
    assert.equal(tieneModulo(f, 'M0'), true);
    assert.equal(tieneModulo(f, 'M4'), true);
    assert.equal(tieneModulo(f, 'M5'), false);
  });
  it('valida dependencias entre módulos', () => {
    assert.deepEqual(validarActivacion(['M1', 'M2', 'M3']), []);
    assert.deepEqual(validarActivacion(['M2']), ['M2 requiere activar M1']);
    assert.deepEqual(validarActivacion(['M1', 'M8']), ['Módulo desconocido: M8']);
  });
});

describe('Códigos de trazabilidad (CP-M3-01)', () => {
  it('iniciales sin tildes ni símbolos', () => {
    assert.equal(inicialesFinca('Finca Los Molles'), 'FLM');
    assert.equal(inicialesFinca('Agropecuaria Ñandú & Hijos Unidos SRL'), 'ANHU');
    assert.equal(inicialesFinca(''), 'LOT');
  });
  it('código correlativo con ceros', () => {
    assert.equal(codigoLote('Finca Los Molles', 2026, 7), 'FLM-2026-0007');
    assert.throws(() => codigoLote('X', 2026, 0));
  });
  it('token público aleatorio y seguro para URL', () => {
    const a = tokenPublico();
    assert.match(a, /^[A-Za-z0-9_-]{16}$/);
    assert.notEqual(a, tokenPublico());
  });
  it('teléfono boliviano', () => {
    assert.equal(normalizarTelefono('7000-0001'), '59170000001');
    assert.equal(normalizarTelefono('+591 70000001'), '59170000001');
    assert.equal(normalizarTelefono(''), '');
  });
});

describe('WhatsApp Cloud API (CP-M5-01)', () => {
  const payload = {
    entry: [{ changes: [{ value: {
      metadata: { phone_number_id: '123' },
      contacts: [{ wa_id: '59170000003', profile: { name: 'Carla' } }],
      messages: [
        { id: 'w1', from: '59170000003', type: 'text', text: { body: 'regué la parcela 1' } },
        { id: 'w2', from: '59170000003', type: 'image', image: {} },
      ],
    } }] }],
  };
  it('extrae sólo mensajes de texto', () => {
    const m = extraerMensajes(payload);
    assert.equal(m.length, 1);
    assert.equal(m[0].nombre, 'Carla');
    assert.equal(m[0].texto, 'regué la parcela 1');
    assert.deepEqual(extraerMensajes({}), []);
  });
  it('verifica la firma HMAC del webhook', () => {
    const cuerpo = Buffer.from(JSON.stringify(payload));
    const firma = 'sha256=' + crypto.createHmac('sha256', 'secreto').update(cuerpo).digest('hex');
    assert.equal(verificarFirma(cuerpo, firma, 'secreto'), true);
    assert.equal(verificarFirma(cuerpo, firma, 'otro'), false);
    assert.equal(verificarFirma(cuerpo, undefined, 'secreto'), false);
    assert.equal(verificarFirma(cuerpo, 'sha256=abc', 'secreto'), false);
    assert.equal(verificarFirma(cuerpo, undefined, ''), true);
  });
  it('sin credenciales el envío es simulado', async () => {
    const c = crearClienteWhatsApp({ token: '', phoneNumberId: '' });
    assert.equal(c.simulado, true);
    assert.deepEqual(await c.enviarTexto('591', 'hola'), { simulado: true });
  });
});
