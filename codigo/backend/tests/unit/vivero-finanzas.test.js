import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { porcentajeGerminacion, disponibles, costoUnitario, validarConteo, etapaSegunStock, conIndicadores } from '../../src/utils/vivero.js';
import { calcularCostosPorLote, costoUnitInsumo, ingresosPorMes } from '../../src/services/finanzas.js';
import { evaluarDescuento } from '../../src/services/inventario.js';

describe('M6 · Vivero (CP-M6-01)', () => {
  const lp = { semillasSembradas: 2000, germinadas: 1840, merma: 60, vendidos: 600, costoBs: 620, etapa: 'LISTO' };
  it('% de germinación', () => {
    assert.equal(porcentajeGerminacion(lp), 92);
    assert.equal(porcentajeGerminacion({ germinadas: 1, semillasSembradas: 3 }), 33.3);
    assert.equal(porcentajeGerminacion({ germinadas: 0, semillasSembradas: 0 }), 0);
  });
  it('disponibles = germinadas − merma − vendidos (nunca negativo)', () => {
    assert.equal(disponibles(lp), 1180);
    assert.equal(disponibles({ germinadas: 10, merma: 8, vendidos: 5 }), 0);
  });
  it('costo unitario sobre plantines útiles', () => {
    assert.equal(costoUnitario(lp), 0.35);
    assert.equal(costoUnitario({ costoBs: 100, germinadas: 0, merma: 0 }), null);
  });
  it('valida conteos imposibles', () => {
    assert.deepEqual(validarConteo(lp), []);
    assert.equal(validarConteo({ ...lp, germinadas: 2500 }).length > 0, true);
    assert.equal(validarConteo({ ...lp, merma: 1900 }).length > 0, true);
    assert.equal(validarConteo({ ...lp, vendidos: 1800 }).length > 0, true);
  });
  it('etapa AGOTADO cuando no quedan plantines y vuelve a LISTO', () => {
    assert.equal(etapaSegunStock({ ...lp, vendidos: 1780 }), 'AGOTADO');
    assert.equal(etapaSegunStock({ ...lp, etapa: 'AGOTADO' }), 'LISTO');
    assert.equal(etapaSegunStock({ ...lp, etapa: 'CRECIMIENTO', vendidos: 1780 }), 'CRECIMIENTO');
  });
  it('agrega indicadores', () => assert.deepEqual(Object.keys(conIndicadores(lp)).slice(-3), ['porcentajeGerminacion', 'disponibles', 'costoUnitario']));
});

describe('M7 · Costos por lote, ingresos y margen (CP-M7-01)', () => {
  const datos = {
    lotes: [{ id: 1, codigo: 'L-01', nombre: 'A', cultivo: 'Frutilla' }, { id: 2, codigo: 'L-02', nombre: 'B', cultivo: 'Tomate' }],
    labores: [
      { loteId: 1, costoBs: 100, aplicacion: { producto: 'Urea', cantidadUsada: 10, insumo: { costoUnitBs: 5 } } }, // 100 + 50 insumo
      { loteId: 1, costoBs: 0, aplicacion: { producto: 'FitoVerde', cantidadUsada: 2 } }, // por nombre: 2 × 200
      { loteId: 2, costoBs: 30, aplicacion: null },
      { loteId: 99, costoBs: 1000 }, // otro lote: se ignora
    ],
    asistencias: [
      { loteId: 1, horas: 8, trabajador: { jornalBs: 120 } },
      { loteId: 1, horas: 4, trabajador: { jornalBs: 100 } },
      { loteId: 2, horas: 8, trabajador: { jornalBs: 110 } },
    ],
    detallesVenta: [{ loteId: 1, subtotal: 1000 }, { loteId: null, subtotal: 50 }],
    cosechas: [{ loteId: 1, cantidadKg: 100 }],
    insumos: [{ nombre: 'FitoVerde', costoUnitBs: 200 }],
  };
  const r = calcularCostosPorLote(datos);
  const l1 = r.lotes.find((l) => l.codigo === 'L-01');
  const l2 = r.lotes.find((l) => l.codigo === 'L-02');

  it('costo = labores + jornales + insumos valorizados', () => {
    assert.equal(l1.costoLabores, 100);
    assert.equal(l1.costoJornales, 170); // 120 + 0.5 × 100
    assert.equal(l1.costoInsumos, 450); // 10 × 5 + 2 × 200
    assert.equal(l1.costoTotal, 720);
  });
  it('margen y margen %', () => {
    assert.equal(l1.ingresos, 1000);
    assert.equal(l1.margen, 280);
    assert.equal(l1.margenPct, 28);
    assert.equal(l1.costoPorKg, 7.2);
  });
  it('sin ingresos no hay margen % ni costo por kg', () => {
    assert.equal(l2.margen, -140);
    assert.equal(l2.margenPct, null);
    assert.equal(l2.costoPorKg, null);
  });
  it('totales incluyen ventas sin lote aparte', () => {
    assert.equal(r.totales.costoTotal, 860);
    assert.equal(r.totales.ingresosSinLote, 50);
    assert.equal(r.totales.ingresos, 1050);
    assert.equal(r.totales.margen, 190);
  });
  it('costo del insumo por vínculo o por nombre', () => {
    assert.equal(costoUnitInsumo({ producto: 'x', insumo: { costoUnitBs: 9 } }), 9);
    assert.equal(costoUnitInsumo({ producto: 'fitoverde' }, datos.insumos), 200);
    assert.equal(costoUnitInsumo({ producto: 'Desconocido' }, datos.insumos), 0);
  });
  it('ingresos por mes', () => {
    assert.deepEqual(ingresosPorMes([{ fecha: '2026-10-02T12:00:00Z', total: 10 }, { fecha: '2026-11-02T12:00:00Z', total: 5 }, { fecha: '2026-10-20T12:00:00Z', total: 2.5 }]), [{ mes: '2026-10', total: 12.5 }, { mes: '2026-11', total: 5 }]);
  });
});

describe('M4 · Descuento del insumo usado en una aplicación (CP-M4-10)', () => {
  const insumo = { stock: 5, unidad: 'L' };
  it('descuenta si la unidad coincide y hay stock', () => assert.deepEqual(evaluarDescuento(insumo, 2, 'L'), { descontar: true }));
  it('no descuenta con unidad distinta, sin stock o sin cantidad', () => {
    assert.equal(evaluarDescuento(insumo, 2, 'kg').motivo, 'UNIDAD_DISTINTA');
    assert.equal(evaluarDescuento(insumo, 9, 'L').motivo, 'STOCK_INSUFICIENTE');
    assert.equal(evaluarDescuento(insumo, 0, 'L').motivo, 'SIN_CANTIDAD');
    assert.equal(evaluarDescuento(null, 1, 'L').motivo, 'SIN_INSUMO');
  });
  it('litros escritos de varias formas', () => assert.equal(evaluarDescuento(insumo, 1, 'litros').descontar, true));
});
