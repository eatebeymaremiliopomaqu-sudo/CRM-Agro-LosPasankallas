import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import {
  normalizarNumeroWhatsApp, aDireccionTwilio, firmaTwilio, verificarFirmaTwilio, extraerMensajeTwilio, twiml, crearProveedor, extraerMensajes,
} from '../../src/services/whatsapp.js';
import { comandoConsentimiento } from '../../src/services/atencionWhatsApp.js';
import { armarAlertas, mensajeAlertas, inicioDiaLocal, horaLocal } from '../../src/services/alertas.js';

describe('WhatsApp · números (CP-WA-01)', () => {
  it('normaliza el formato de Twilio y de Meta', () => {
    assert.equal(normalizarNumeroWhatsApp('whatsapp:+59170000001'), '59170000001');
    assert.equal(normalizarNumeroWhatsApp('+591 700-00001'), '59170000001');
    assert.equal(normalizarNumeroWhatsApp('70000001'), '59170000001');
    assert.equal(normalizarNumeroWhatsApp(''), '');
    assert.equal(aDireccionTwilio('59170000001'), 'whatsapp:+59170000001');
  });
});

describe('WhatsApp · firma X-Twilio-Signature (CP-WA-02)', () => {
  // Ejemplo oficial de la documentación de Twilio (Webhooks security)
  const token = '12345';
  const url = 'https://mycompany.com/myapp.php?foo=1&bar=2';
  const params = { CallSid: 'CA1234567890ABCDE', Caller: '+12349013030', Digits: '1234', From: '+12349013030', To: '+18005551212' };

  it('coincide con el vector de la documentación de Twilio', () => {
    assert.equal(firmaTwilio(token, url, params), '0/KCTR6DLpKmkAf8muzZqo1nDgQ=');
  });
  it('acepta la firma válida y rechaza las alteradas', () => {
    const firma = firmaTwilio(token, url, params);
    assert.equal(verificarFirmaTwilio(token, url, params, firma), true);
    assert.equal(verificarFirmaTwilio(token, url, { ...params, Digits: '9999' }, firma), false);
    assert.equal(verificarFirmaTwilio('otro', url, params, firma), false);
    assert.equal(verificarFirmaTwilio(token, url, params, undefined), false);
    assert.equal(verificarFirmaTwilio('', url, params, firma), false);
  });
});

describe('WhatsApp · mensajes entrantes y TwiML', () => {
  it('extrae el mensaje de Twilio', () => {
    const m = extraerMensajeTwilio({ From: 'whatsapp:+59170000002', Body: 'regué el lote 2', MessageSid: 'SM1', ProfileName: 'Bruno' });
    assert.deepEqual(m, { id: 'SM1', de: '59170000002', nombre: 'Bruno', texto: 'regué el lote 2' });
    assert.equal(extraerMensajeTwilio({}), null);
  });
  it('el número de Meta también se normaliza', () => {
    const body = { entry: [{ changes: [{ value: { messages: [{ from: '+591 70000002', type: 'text', text: { body: 'hola' } }] } }] }] };
    assert.equal(extraerMensajes(body)[0].de, '59170000002');
  });
  it('TwiML escapa XML y vacía cuando no hay texto', () => {
    assert.equal(twiml('a < b & "c"'), '<?xml version="1.0" encoding="UTF-8"?><Response><Message>a &lt; b &amp; &quot;c&quot;</Message></Response>');
    assert.match(twiml(''), /<Response><\/Response>/);
  });
});

describe('WhatsApp · proveedores (ADR-009)', () => {
  it('sin credenciales cae en simulado', async () => {
    assert.equal(crearProveedor({ proveedor: 'twilio' }).simulado, true);
    assert.equal(crearProveedor({ proveedor: 'meta' }).simulado, true);
    assert.equal(crearProveedor({ proveedor: 'simulado' }).nombre, 'simulado');
    assert.deepEqual(await crearProveedor({ proveedor: 'x' }).enviarTexto('591', 'hola'), { simulado: true });
  });
  it('Twilio envía From/To/Body con autenticación básica', async () => {
    let llamada;
    const fetchFalso = async (url, op) => { llamada = { url, op }; return { ok: true, json: async () => ({ sid: 'SM1' }) }; };
    const p = crearProveedor({ proveedor: 'twilio', twilioAccountSid: 'AC1', twilioAuthToken: 'tok', twilioFrom: 'whatsapp:+14155238886' }, fetchFalso);
    assert.equal(p.nombre, 'twilio');
    await p.enviarTexto('59170000001', 'Hola');
    assert.match(llamada.url, /Accounts\/AC1\/Messages\.json$/);
    assert.equal(llamada.op.headers.authorization, `Basic ${Buffer.from('AC1:tok').toString('base64')}`);
    const cuerpo = new URLSearchParams(llamada.op.body.toString());
    assert.equal(cuerpo.get('To'), 'whatsapp:+59170000001');
    assert.equal(cuerpo.get('From'), 'whatsapp:+14155238886');
    assert.equal(cuerpo.get('Body'), 'Hola');
  });
  it('Meta envía por la Graph API y propaga errores', async () => {
    const p = crearProveedor({ proveedor: 'meta', token: 't', phoneNumberId: '123' }, async () => ({ ok: false, status: 401, text: async () => 'no' }));
    await assert.rejects(() => p.enviarTexto('591', 'x'), /Meta respondió 401/);
  });
});

describe('Consentimiento por WhatsApp (CP-WA-03)', () => {
  it('reconoce ALTA y BAJA', () => {
    assert.equal(comandoConsentimiento('ALTA'), 'ALTA');
    assert.equal(comandoConsentimiento('baja.'), 'BAJA');
    assert.equal(comandoConsentimiento('Acepto'), 'ALTA');
    assert.equal(comandoConsentimiento('stop'), 'BAJA');
    assert.equal(comandoConsentimiento('hay baja presión en el riego'), null);
  });
});

describe('Alertas automáticas (CP-WA-04)', () => {
  const ahora = new Date('2026-11-25T12:00:00Z'); // 08:00 en Bolivia
  const hoyLocal = new Date('2026-11-25T16:00:00Z');
  const datos = {
    programadas: [
      { estado: 'PENDIENTE', tipo: 'RIEGO', fechaProgramada: hoyLocal, lote: { codigo: 'L-01' }, responsableId: 3, responsable: { nombre: 'Juan' } },
      { estado: 'PENDIENTE', tipo: 'DESHIERBE', fechaProgramada: new Date('2026-11-22T12:00:00Z'), lote: { codigo: 'L-02' } },
      { estado: 'PENDIENTE', tipo: 'FUMIGACION', fechaProgramada: new Date('2026-11-27T12:00:00Z'), lote: { codigo: 'L-03' } },
      { estado: 'HECHA', tipo: 'RIEGO', fechaProgramada: hoyLocal, lote: { codigo: 'L-04' } },
    ],
    insumos: [{ nombre: 'Urea', stock: 2, stockMinimo: 5, unidad: 'kg' }, { nombre: 'Guantes', stock: 9, stockMinimo: 2, unidad: 'par' }],
    productos: [{ nombre: 'Frutilla', stock: 3, stockMinimo: 5, unidad: 'kg' }],
    aplicaciones: [
      { fecha: new Date('2026-11-12T12:00:00Z'), periodoCarenciaDias: 14, producto: 'FitoVerde', loteCodigo: 'L-05' },
      { fecha: new Date('2026-10-01T12:00:00Z'), periodoCarenciaDias: 7, producto: 'Viejo', loteCodigo: 'L-06' },
    ],
    ventas: [{ id: 9, saldo: 120, fecha: new Date('2026-11-10T12:00:00Z'), cliente: { nombre: 'Mercado X' } }, { id: 10, saldo: 50, fecha: new Date('2026-11-24T12:00:00Z') }],
  };

  it('arma cada tipo de alerta', () => {
    const items = armarAlertas(datos, ahora, -240);
    const tipos = items.map((i) => i.tipo).sort();
    assert.deepEqual(tipos, ['APLICACION_PROGRAMADA', 'COBRO_VENCIDO', 'FIN_CARENCIA', 'LABOR_ATRASADA', 'LABOR_HOY', 'STOCK_MINIMO', 'STOCK_MINIMO']);
    assert.equal(items.find((i) => i.tipo === 'LABOR_HOY').trabajadorId, 3);
    assert.match(items.find((i) => i.tipo === 'FIN_CARENCIA').texto, /L-05 sale de carencia el 26\/11/);
  });
  it('el mensaje agrupa por tipo e indica cómo darse de baja', () => {
    const m = mensajeAlertas(armarAlertas(datos, ahora, -240), 'Finca Los Molles', ahora);
    assert.match(m, /Stock bajo el mínimo/);
    assert.match(m, /BAJA/);
    assert.match(mensajeAlertas([], 'Finca', ahora), /sin alertas/);
  });
  it('día y hora local de Bolivia (UTC-4)', () => {
    assert.equal(inicioDiaLocal(new Date('2026-11-25T02:00:00Z'), -240).toISOString(), '2026-11-24T04:00:00.000Z');
    assert.equal(horaLocal(new Date('2026-11-25T11:00:00Z'), -240), '07:00');
  });
});
