import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  interpretarPorReglas, INTENCIONES, extraerParcela, extraerKg, extraerHoras, extraerCantidadUsada, extraerProducto,
  extraerTrabajador, extraerFecha, extraerSeveridad, tipoObservacion, normalizarCodigoParcela,
} from '../../src/agente/parser.js';

const AHORA = new Date('2026-11-20T15:00:00Z');

describe('Extractores del intérprete por reglas', () => {
  it('parcela en distintos formatos', () => {
    assert.equal(extraerParcela('parcela 2'), 'P-02');
    assert.equal(extraerParcela('en el lote 12'), 'P-12');
    assert.equal(extraerParcela('p-03'), 'P-03');
    assert.equal(extraerParcela('parcela nro. 4'), 'P-04');
    assert.equal(extraerParcela('sin dato'), null);
  });
  it('normaliza códigos de parcela', () => {
    assert.equal(normalizarCodigoParcela('p 7'), 'P-07');
    assert.equal(normalizarCodigoParcela(3), 'P-03');
    assert.equal(normalizarCodigoParcela('P-105'), 'P-105');
    assert.equal(normalizarCodigoParcela(null), null);
    assert.equal(normalizarCodigoParcela('norte'), 'NORTE');
  });
  it('cantidades: kg, quintales (46 kg) y arrobas', () => {
    assert.equal(extraerKg('350 kg'), 350);
    assert.equal(extraerKg('12 qq'), 552);
    assert.equal(extraerKg('2,5 quintales'), 115);
    assert.equal(extraerKg('4 arrobas'), 46);
    assert.equal(extraerKg('nada'), null);
  });
  it('horas y cantidades usadas', () => {
    assert.equal(extraerHoras('por 3 horas'), 3);
    assert.equal(extraerHoras('4,5 h'), 4.5);
    assert.equal(extraerHoras('sin horas'), null);
    assert.deepEqual(extraerCantidadUsada('2 litros'), { cantidad: 2, unidad: 'L' });
    assert.deepEqual(extraerCantidadUsada('250 cc'), { cantidad: 250, unidad: 'ml' });
    assert.deepEqual(extraerCantidadUsada('3 sacos'), { cantidad: 3, unidad: 'saco' });
    assert.deepEqual(extraerCantidadUsada('5 gramos'), { cantidad: 5, unidad: 'g' });
    assert.deepEqual(extraerCantidadUsada('1 kilo'), { cantidad: 1, unidad: 'kg' });
    assert.equal(extraerCantidadUsada('nada'), null);
  });
  it('producto aplicado', () => {
    assert.equal(extraerProducto('fumigue la parcela 2 con fitoverde, 2 litros'), 'Fitoverde');
    assert.equal(extraerProducto('aplique con agro protect en p-01'), 'Agro Protect');
    assert.equal(extraerProducto('fumigue con mochila'), null);
    assert.equal(extraerProducto('fumigue la parcela 3'), null);
  });
  it('trabajador', () => {
    assert.equal(extraerTrabajador('juan perez trabajo 8 horas'), 'Juan Perez');
    assert.equal(extraerTrabajador('asistencia de maria flores hoy'), 'Maria Flores');
    assert.equal(extraerTrabajador('hoy rosa vino 6 horas'), 'Rosa');
    assert.equal(extraerTrabajador('regue la parcela'), null);
  });
  it('fecha relativa', () => {
    assert.equal(extraerFecha('hoy', AHORA), '2026-11-20');
    assert.equal(extraerFecha('ayer', AHORA), '2026-11-19');
    assert.equal(extraerFecha('antier', AHORA), '2026-11-18');
  });
  it('severidad y tipo de observación', () => {
    assert.equal(extraerSeveridad('severidad 4'), 4);
    assert.equal(extraerSeveridad('severidad 9'), 5);
    assert.equal(extraerSeveridad('ataque fuerte'), 4);
    assert.equal(extraerSeveridad('muy grave'), 5);
    assert.equal(extraerSeveridad('moderado'), 3);
    assert.equal(extraerSeveridad('leve'), 2);
    assert.equal(tipoObservacion('hay pulgon'), 'PLAGA');
    assert.equal(tipoObservacion('roya en hojas'), 'ENFERMEDAD');
    assert.equal(tipoObservacion('cayo granizo'), 'CLIMA');
    assert.equal(tipoObservacion('encharcamiento'), 'SUELO');
    assert.equal(tipoObservacion('todo normal'), null);
  });
});

describe('Intenciones (CP-AG-04)', () => {
  const casos = [
    ['si', INTENCIONES.CONFIRMAR],
    ['Sí!', INTENCIONES.CONFIRMAR],
    ['ok', INTENCIONES.CONFIRMAR],
    ['no', INTENCIONES.CANCELAR],
    ['cancelar', INTENCIONES.CANCELAR],
    ['hola', INTENCIONES.AYUDA],
    ['', INTENCIONES.AYUDA],
    ['resumen de hoy', INTENCIONES.CONSULTA],
    ['cuántos trabajadores vinieron hoy?', INTENCIONES.CONSULTA],
    ['¿cómo vamos?', INTENCIONES.CONSULTA],
    ['qwerty asdf', INTENCIONES.DESCONOCIDA],
  ];
  for (const [texto, esperada] of casos) {
    it(`"${texto}" → ${esperada}`, () => assert.equal(interpretarPorReglas(texto, AHORA).intencion, esperada));
  }

  it('labor de riego completa', () => {
    const r = interpretarPorReglas('Regué la parcela 2 por 3 horas', AHORA);
    assert.equal(r.intencion, INTENCIONES.REGISTRAR_LABOR);
    assert.equal(r.datos.tipo, 'RIEGO');
    assert.equal(r.datos.parcela, 'P-02');
    assert.equal(r.datos.horas, 3);
    assert.deepEqual(r.faltantes, []);
  });
  it('fumigación sin producto pide el dato', () => {
    const r = interpretarPorReglas('fumigamos la parcela 3', AHORA);
    assert.equal(r.datos.tipo, 'FUMIGACION');
    assert.deepEqual(r.faltantes, ['producto']);
  });
  it('fumigación con producto y cantidad (registro, no recomendación)', () => {
    const r = interpretarPorReglas('Ayer fumigué P-03 con FitoVerde, 2 litros, 4 horas', AHORA);
    assert.equal(r.datos.producto, 'Fitoverde');
    assert.equal(r.datos.cantidadUsada, 2);
    assert.equal(r.datos.unidad, 'L');
    assert.equal(r.datos.horas, 4);
    assert.equal(r.datos.fecha, '2026-11-19');
  });
  it('labor sin parcela', () => {
    assert.deepEqual(interpretarPorReglas('deshierbamos toda la mañana', AHORA).faltantes, ['parcela']);
  });
  it('asistencia con horas por defecto', () => {
    const r = interpretarPorReglas('asistencia de Pedro Gutierrez', AHORA);
    assert.equal(r.intencion, INTENCIONES.REGISTRAR_ASISTENCIA);
    assert.equal(r.datos.trabajador, 'Pedro Gutierrez');
    assert.equal(r.datos.horas, 8);
  });
  it('pregunta por trabajadores es consulta de personal', () => {
    assert.equal(interpretarPorReglas('cuantos vinieron hoy', AHORA).datos.tema, 'TRABAJADORES');
  });
  it('asistencia sin nombre', () => {
    assert.deepEqual(interpretarPorReglas('hoy se trabajo 8 horas', AHORA).faltantes, ['trabajador']);
  });
  it('observación de plaga', () => {
    const r = interpretarPorReglas('Hay pulgón en la parcela 4, severidad 3', AHORA);
    assert.equal(r.intencion, INTENCIONES.REGISTRAR_OBSERVACION);
    assert.equal(r.datos.tipo, 'PLAGA');
    assert.equal(r.datos.severidad, 3);
    assert.equal(r.datos.parcela, 'P-04');
  });
  it('cosecha en quintales', () => {
    const r = interpretarPorReglas('Cosechamos 12 qq de papa en la parcela 4, segunda', AHORA);
    assert.equal(r.intencion, INTENCIONES.REGISTRAR_COSECHA);
    assert.equal(r.datos.cantidadKg, 552);
    assert.equal(r.datos.cultivo, 'Papa');
    assert.equal(r.datos.calidad, 'SEGUNDA');
  });
  it('cosecha sin parcela', () => {
    assert.deepEqual(interpretarPorReglas('cosechamos 300 kg de tomate', AHORA).faltantes, ['parcela']);
  });
  it('fertilización registra cantidad sin exigir producto', () => {
    const r = interpretarPorReglas('fertilizamos la parcela 5 con nutrisuelo 3 sacos', AHORA);
    assert.equal(r.datos.tipo, 'FERTILIZACION');
    assert.equal(r.datos.unidad, 'saco');
    assert.deepEqual(r.faltantes, []);
  });
});
