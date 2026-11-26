import { describe, it, beforeEach } from 'vitest';
import assert from 'node:assert/strict';
import { crearAgente, crearAlmacenMemoria, ESTADOS, RechazoAgente, TEXTO_AYUDA_CLIENTE, describirAccion } from '../../src/agente/agente.js';
import { interpretarPorReglas, INTENCIONES, TEMAS, extraerFechaEntrega, extraerPedido } from '../../src/agente/parser.js';
import { aplicarPolitica } from '../../src/agente/politicas.js';
import { esConsultaDeRegistro, esPreguntaAgronomica, pideRecomendacionDosis, MENSAJE_SIN_DOSIS, MENSAJE_AGRONOMO } from '../../src/agente/guardrails.js';
import { validarRespuestaLLM } from '../../src/agente/validacionLLM.js';

const AHORA = new Date('2026-11-25T15:00:00Z'); // miércoles

describe('Parser · nuevas intenciones (CP-AG-10)', () => {
  it('cosecha de la guía: "hoy cosechamos 40 kg de tomate del lote 2"', () => {
    const r = interpretarPorReglas('hoy cosechamos 40 kg de tomate del lote 2', AHORA);
    assert.equal(r.intencion, INTENCIONES.REGISTRAR_COSECHA);
    assert.deepEqual({ lote: r.datos.lote, kg: r.datos.cantidadKg, cultivo: r.datos.cultivo }, { lote: 'L-02', kg: 40, cultivo: 'Tomate' });
  });
  it('pedido de la guía: "quiero 3 cajas de frutilla para el viernes"', () => {
    const r = interpretarPorReglas('quiero 3 cajas de frutilla para el viernes', AHORA);
    assert.equal(r.intencion, INTENCIONES.PEDIDO_CLIENTE);
    assert.deepEqual(r.datos, { cantidad: 3, unidad: 'caja', producto: 'Frutilla', fechaEntrega: '2026-11-27' });
  });
  it('pedido con "mañana" no ensucia el producto', () => {
    assert.deepEqual(extraerPedido('necesito 10 kilos de papa manana', AHORA), { cantidad: 10, unidad: 'kg', producto: 'Papa', fechaEntrega: '2026-11-26' });
    assert.equal(extraerPedido('quiero tomate', AHORA), null);
  });
  it('fechas de entrega', () => {
    assert.equal(extraerFechaEntrega('para el miercoles', AHORA), '2026-12-02');
    assert.equal(extraerFechaEntrega('pasado manana', AHORA), '2026-11-27');
    assert.equal(extraerFechaEntrega('para el 30/11', AHORA), '2026-11-30');
    assert.equal(extraerFechaEntrega('para el 2/1', AHORA), '2027-01-02');
    assert.equal(extraerFechaEntrega('cuando puedan', AHORA), null);
  });
  it('tarea hecha con y sin número', () => {
    assert.deepEqual(interpretarPorReglas('tarea hecha', AHORA).datos, { tareaId: null });
    assert.deepEqual(interpretarPorReglas('terminé la tarea 12', AHORA).datos, { tareaId: 12 });
    assert.equal(interpretarPorReglas('ya completé la tarea #7', AHORA).datos.tareaId, 7);
  });
  const consultas = [
    ['¿qué se aplicó en el lote 2 y hasta cuándo es la carencia?', TEMAS.CARENCIA_LOTE],
    ['labores pendientes', TEMAS.LABORES_PENDIENTES],
    ['mis tareas', TEMAS.MIS_TAREAS],
    ['stock de urea', TEMAS.STOCK],
    ['¿cuánto queda de tomate?', TEMAS.STOCK],
    ['ventas de la semana', TEMAS.VENTAS],
    ['cuentas por cobrar', TEMAS.CUENTAS_POR_COBRAR],
    ['precios', TEMAS.PRECIOS],
  ];
  for (const [t, tema] of consultas) it(`"${t}" → ${tema}`, () => assert.equal(interpretarPorReglas(t, AHORA).datos.tema, tema));
  it('una pregunta con verbo de aplicación NO se registra como labor', () => {
    assert.equal(interpretarPorReglas('¿qué se aplicó en el lote 5?', AHORA).intencion, INTENCIONES.CONSULTA);
  });
  it('"hay pulgón en el lote 4" sigue siendo observación', () => {
    assert.equal(interpretarPorReglas('hay pulgón en el lote 4, severidad 3', AHORA).intencion, INTENCIONES.REGISTRAR_OBSERVACION);
  });
});

describe('Guardrails · registro vs consejo (CP-AG-11)', () => {
  it('ver la dosis REGISTRADA no es pedir una recomendación', () => {
    assert.equal(esConsultaDeRegistro('¿qué dosis se aplicó en el lote 5?'), true);
    assert.equal(pideRecomendacionDosis('¿qué dosis se aplicó en el lote 5?'), false);
    assert.equal(pideRecomendacionDosis('dosis de etiqueta registrada de AgroProtect'), false);
  });
  it('pedir consejo sigue bloqueado aunque mencione lo registrado', () => {
    assert.equal(pideRecomendacionDosis('qué dosis le echo al lote 5?'), true);
    assert.equal(pideRecomendacionDosis('qué dosis debo aplicar de lo registrado?'), true);
    assert.equal(pideRecomendacionDosis('qué producto uso para la polilla?'), true);
  });
  it('preguntas agronómicas se derivan al ingeniero agrónomo', () => {
    assert.equal(esPreguntaAgronomica('¿por qué se amarillan las hojas del tomate?'), true);
    assert.equal(esPreguntaAgronomica('cómo controlo el pulgón'), true);
    assert.equal(esPreguntaAgronomica('qué enfermedad tiene la papa?'), true);
    assert.equal(esPreguntaAgronomica('regué el lote 2'), false);
  });
});

describe('Políticas por perfil (CP-AG-12)', () => {
  it('el trabajador no registra aplicaciones ni cosechas', () => {
    assert.equal(aplicarPolitica('TRABAJADOR', INTENCIONES.REGISTRAR_LABOR, { tipo: 'FUMIGACION', producto: 'X' }).ok, false);
    assert.equal(aplicarPolitica('TRABAJADOR', INTENCIONES.REGISTRAR_LABOR, { tipo: 'RIEGO' }).ok, true);
    assert.equal(aplicarPolitica('TRABAJADOR', INTENCIONES.REGISTRAR_COSECHA, {}).ok, false);
    assert.equal(aplicarPolitica('TRABAJADOR', INTENCIONES.REGISTRAR_ASISTENCIA, {}).ok, false);
  });
  it('el trabajador no consulta ventas ni cuentas: se le muestran sus tareas', () => {
    const r = aplicarPolitica('TRABAJADOR', INTENCIONES.CONSULTA, { tema: TEMAS.CUENTAS_POR_COBRAR });
    assert.equal(r.datos.tema, TEMAS.MIS_TAREAS);
    assert.equal(aplicarPolitica('TRABAJADOR', INTENCIONES.CONSULTA, { tema: TEMAS.CARENCIA_LOTE }).datos.tema, TEMAS.CARENCIA_LOTE);
  });
  it('el cliente solo pide y ve precios', () => {
    assert.equal(aplicarPolitica('CLIENTE', INTENCIONES.PEDIDO_CLIENTE, {}).ok, true);
    assert.equal(aplicarPolitica('CLIENTE', INTENCIONES.REGISTRAR_LABOR, {}).ok, false);
    assert.equal(aplicarPolitica('CLIENTE', INTENCIONES.CONSULTA, { tema: TEMAS.VENTAS }).datos.tema, TEMAS.PRECIOS);
  });
  it('el personal no registra pedidos como cliente', () => {
    assert.equal(aplicarPolitica('ENCARGADO', INTENCIONES.PEDIDO_CLIENTE, {}).ok, false);
    assert.equal(aplicarPolitica('PROPIETARIO', INTENCIONES.REGISTRAR_COSECHA, {}).ok, true);
  });
});

describe('Agente con perfiles y preparación (CP-AG-13)', () => {
  let almacen, ejecutados, preparados, agente, rechazo;
  beforeEach(() => {
    almacen = crearAlmacenMemoria();
    ejecutados = [];
    preparados = [];
    rechazo = null;
    agente = crearAgente({
      interpretar: async (t, a) => interpretarPorReglas(t, a),
      almacen,
      ejecutor: {
        async preparar(tipo, datos) {
          preparados.push(tipo);
          if (rechazo) throw rechazo;
          return tipo === INTENCIONES.MARCAR_TAREA_HECHA ? { tareaId: 5, titulo: 'Regar L-01' } : datos;
        },
        async ejecutar(tipo, datos) { ejecutados.push({ tipo, datos }); return 'OK'; },
        async consultar(tema, ctx, datos) { return `consulta ${tema} ${datos.lote || ''}`.trim(); },
      },
      reloj: () => AHORA,
    });
  });
  const cliente = { fincaId: 1, canal: 'WHATSAPP', remitente: '59171000001', perfil: 'CLIENTE', cliente: { id: 1, nombre: 'Doña Rosa' } };
  const trabajador = { fincaId: 1, canal: 'WHATSAPP', remitente: '59170000003', perfil: 'TRABAJADOR', trabajadorId: 3 };

  it('pedido de cliente: pide confirmación y guarda solo con SI', async () => {
    const r = await agente({ ...cliente, texto: 'quiero 3 cajas de frutilla para el viernes' });
    assert.equal(r.estado, ESTADOS.PENDIENTE);
    assert.match(r.respuesta, /3 caja de Frutilla/);
    assert.equal(ejecutados.length, 0);
    const ok = await agente({ ...cliente, texto: 'SI' });
    assert.equal(ok.estado, ESTADOS.REGISTRADO);
    assert.equal(ejecutados[0].tipo, INTENCIONES.PEDIDO_CLIENTE);
  });
  it('el cliente recibe su propia ayuda', async () => {
    assert.equal((await agente({ ...cliente, texto: 'hola' })).respuesta, TEXTO_AYUDA_CLIENTE);
  });
  it('trabajador marca tarea hecha con confirmación', async () => {
    const r = await agente({ ...trabajador, texto: 'tarea hecha' });
    assert.equal(r.estado, ESTADOS.PENDIENTE);
    assert.match(r.respuesta, /tarea #5/);
    await agente({ ...trabajador, texto: 'si' });
    assert.deepEqual(ejecutados[0].datos, { tareaId: 5, titulo: 'Regar L-01' });
  });
  it('trabajador no puede registrar fumigaciones (rechazo sin crear acción)', async () => {
    const r = await agente({ ...trabajador, texto: 'fumigué el lote 3 con FitoVerde' });
    assert.equal(r.estado, ESTADOS.RECHAZADO);
    assert.equal(almacen.items.length, 0);
  });
  it('si preparar rechaza (p. ej. carencia), no se crea la acción', async () => {
    rechazo = new RechazoAgente('🚫 El lote L-02 está en carencia hasta el 30/11/2026 por FitoVerde');
    const r = await agente({ fincaId: 1, remitente: 'x', usuario: { id: 1, rol: 'ENCARGADO' }, texto: 'cosechamos 40 kg de tomate del lote 2' });
    assert.equal(r.estado, ESTADOS.RECHAZADO);
    assert.match(r.respuesta, /carencia/);
    assert.equal(almacen.items.length, 0);
  });
  it('la consulta de carencia pasa el lote y no se bloquea como "dosis"', async () => {
    const r = await agente({ fincaId: 1, remitente: 'x', usuario: { id: 1, rol: 'ENCARGADO' }, texto: '¿qué dosis se aplicó en el lote 5?' });
    assert.equal(r.respuesta, 'consulta CARENCIA_LOTE L-05');
  });
  it('pedir consejo de dosis sigue rechazado y la pregunta agronómica se deriva', async () => {
    const e = { fincaId: 1, remitente: 'x', usuario: { id: 1, rol: 'ENCARGADO' } };
    assert.equal((await agente({ ...e, texto: '¿qué dosis le echo al lote 5?' })).respuesta, MENSAJE_SIN_DOSIS);
    assert.equal((await agente({ ...e, texto: '¿por qué se secan las hojas?' })).respuesta, MENSAJE_AGRONOMO);
  });
  it('describe los pedidos y tareas', () => {
    assert.match(describirAccion(INTENCIONES.PEDIDO_CLIENTE, { cantidad: 2, unidad: 'kg', producto: 'Tomate', subtotal: 56, fechaEntrega: '2026-11-27' }), /2 kg de Tomate.*Bs 56\.00.*27\/11\/2026/);
  });
});

describe('Validación de la respuesta del LLM · intenciones nuevas', () => {
  it('acepta lote (no "parcela") y limpia el tema', () => {
    const v = validarRespuestaLLM('{"intencion":"CONSULTA","datos":{"tema":"INVENTADO","lote":"L-02"}}');
    assert.deepEqual(v.datos, { tema: 'GENERAL', lote: 'L-02' });
    const c = validarRespuestaLLM('{"intencion":"REGISTRAR_COSECHA","datos":{"parcela":"P-02","cantidadKg":40}}');
    assert.deepEqual(c.faltantes, ['lote']);
  });
  it('pedido sin producto queda en faltantes', () => {
    assert.deepEqual(validarRespuestaLLM('{"intencion":"PEDIDO_CLIENTE","datos":{"cantidad":3}}').faltantes, ['producto']);
  });
});

describe('Guardrails · nombres comerciales desconocidos (DEF-17)', () => {
  it('"¿cuánto AgroProtect le echo a la mochila?" se bloquea', () => {
    assert.equal(pideRecomendacionDosis('¿cuánto AgroProtect le echo a la mochila?'), true);
    assert.equal(pideRecomendacionDosis('cuantos ml de Xyz por mochila'), true);
    assert.equal(pideRecomendacionDosis('cuántos trabajadores vinieron hoy'), false);
    assert.equal(pideRecomendacionDosis('cuánto queda de tomate'), false);
  });
});

describe('Parser · defectos encontrados por las pruebas de API (DEF-18, DEF-19)', () => {
  it('"tarea hecha 12" (formato que sugiere el propio agente) toma el número', () => {
    assert.equal(interpretarPorReglas('tarea hecha 12', AHORA).datos.tareaId, 12);
    assert.equal(interpretarPorReglas('tarea lista nro 3', AHORA).datos.tareaId, 3);
  });
  it('producto con paréntesis, como en los nombres comerciales cargados', () => {
    assert.equal(interpretarPorReglas('fumigué el lote 3 con FitoVerde SC (ficticio), 1 litro', AHORA).datos.producto, 'Fitoverde Sc (Ficticio)');
  });
});
