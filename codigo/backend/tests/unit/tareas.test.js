import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ordenarTareas, puedeGestionarTarea, transicionTarea, tareaVencida, mensajeTareaAsignada } from '../../src/utils/tareas.js';
import { armarFichaPublica, finCarencia, CONSULTAS_TRAZABILIDAD } from '../../src/services/trazabilidad.js';
import { claveCultivo } from '../../src/utils/codigos.js';

describe('Tareas asignadas · transiciones (CP-M3-10)', () => {
  it('PENDIENTE → iniciar → EN_CURSO', () => assert.deepEqual(transicionTarea('PENDIENTE', 'iniciar'), { ok: true, estado: 'EN_CURSO' }));
  it('se puede completar desde PENDIENTE o EN_CURSO', () => {
    assert.equal(transicionTarea('PENDIENTE', 'completar').estado, 'COMPLETADA');
    assert.equal(transicionTarea('EN_CURSO', 'completar').estado, 'COMPLETADA');
  });
  it('no se completa una tarea cancelada ni se cancela una completada', () => {
    assert.equal(transicionTarea('CANCELADA', 'completar').ok, false);
    assert.equal(transicionTarea('COMPLETADA', 'cancelar').ok, false);
    assert.equal(transicionTarea('EN_CURSO', 'iniciar').ok, false);
  });
  it('acción desconocida', () => assert.match(transicionTarea('PENDIENTE', 'borrar').error, /desconocida/));
});

describe('Tareas asignadas · permisos (CP-M3-11)', () => {
  const tarea = { trabajadorId: 7 };
  it('el trabajador gestiona solo sus tareas', () => {
    assert.equal(puedeGestionarTarea({ rol: 'TRABAJADOR', trabajadorId: 7 }, tarea), true);
    assert.equal(puedeGestionarTarea({ rol: 'TRABAJADOR', trabajadorId: 8 }, tarea), false);
    assert.equal(puedeGestionarTarea({ rol: 'TRABAJADOR', trabajadorId: null }, tarea), false);
  });
  it('encargado y propietario gestionan todas', () => {
    assert.equal(puedeGestionarTarea({ rol: 'ENCARGADO' }, tarea), true);
    assert.equal(puedeGestionarTarea({ rol: 'PROPIETARIO' }, tarea), true);
  });
  it('sin usuario o sin tarea no se permite', () => {
    assert.equal(puedeGestionarTarea(null, tarea), false);
    assert.equal(puedeGestionarTarea({ rol: 'ENCARGADO' }, null), false);
  });
});

describe('Tareas asignadas · orden y vencimiento', () => {
  it('ordena activas primero, luego urgencia y vencimiento', () => {
    const r = ordenarTareas([
      { id: 1, estado: 'COMPLETADA', prioridad: 'URGENTE' },
      { id: 2, estado: 'PENDIENTE', prioridad: 'BAJA' },
      { id: 3, estado: 'PENDIENTE', prioridad: 'URGENTE', fechaVencimiento: '2026-12-05' },
      { id: 4, estado: 'PENDIENTE', prioridad: 'URGENTE', fechaVencimiento: '2026-12-01' },
      { id: 5, estado: 'EN_CURSO', prioridad: 'MEDIA' },
    ]);
    assert.deepEqual(r.map((t) => t.id), [5, 4, 3, 2, 1]);
  });
  it('vence al terminar el día límite y solo si sigue activa', () => {
    const t = { estado: 'PENDIENTE', fechaVencimiento: '2026-11-20T00:00:00Z' };
    assert.equal(tareaVencida(t, new Date('2026-11-20T15:00:00Z')), false);
    assert.equal(tareaVencida(t, new Date('2026-11-21T01:00:00Z')), true);
    assert.equal(tareaVencida({ ...t, estado: 'COMPLETADA' }, new Date('2026-12-30')), false);
    assert.equal(tareaVencida({ estado: 'PENDIENTE' }), false);
  });
  it('el aviso de WhatsApp incluye tarea, lote y cómo darse de baja', () => {
    const m = mensajeTareaAsignada({ titulo: 'Regar L-02', prioridad: 'ALTA', lote: { codigo: 'L-02', nombre: 'Ladera' }, fechaVencimiento: '2026-11-30T00:00:00Z' });
    assert.match(m, /Regar L-02/);
    assert.match(m, /L-02 \(Ladera\)/);
    assert.match(m, /BAJA/);
  });
});

describe('Trazabilidad pública (CP-M2-10)', () => {
  const lc = {
    codigo: 'FSR-2026-0001',
    calidad: 'PRIMERA',
    cantidadKg: 120,
    destino: 'Mercado',
    fechaCosecha: new Date('2026-11-20T12:00:00Z'),
    eventos: [{ tipo: 'COSECHA', fecha: new Date('2026-11-20T12:00:00Z'), detalle: 'ok' }],
    campania: {
      cultivo: 'Tomate',
      variedad: 'Kada',
      fechaSiembra: new Date('2026-08-01T12:00:00Z'),
      lote: { codigo: 'L-01', nombre: 'Bajío', areaHa: 1.2, tipoSuelo: 'Franco', riego: 'GOTEO', finca: { nombre: 'Finca', municipio: 'Comarapa', departamento: 'Santa Cruz' } },
      labores: [
        { tipo: 'RIEGO', fecha: new Date('2026-10-01T12:00:00Z'), descripcion: 'riego', aplicacion: null },
        { tipo: 'FUMIGACION', fecha: new Date('2026-11-01T12:00:00Z'), descripcion: 'fum', aplicacion: { producto: 'FitoVerde', motivo: 'Polilla', ingredienteActivo: 'X', periodoCarenciaDias: 14 } },
      ],
    },
    detallesVenta: [{ cantidad: 40, unidad: 'kg', venta: { fecha: new Date('2026-11-21T12:00:00Z'), cliente: { tipo: 'MAYORISTA', nombre: 'NO DEBE SALIR', telefono: '591700' } } }],
  };

  it('calcula fin de carencia y si se respetó', () => {
    const f = armarFichaPublica(lc, new Date('2026-11-25T00:00:00Z'));
    const fum = f.labores.find((l) => l.producto);
    assert.equal(fum.fechaFinCarencia.toISOString(), '2026-11-15T12:00:00.000Z');
    assert.equal(fum.carenciaRespetada, true);
    assert.equal(fum.carenciaVigente, false);
    assert.equal(f.resumen.carenciaRespetada, true);
    assert.equal(f.resumen.aplicaciones, 1);
  });
  it('detecta cosecha dentro de la carencia', () => {
    const f = armarFichaPublica({ ...lc, fechaCosecha: new Date('2026-11-10T12:00:00Z') });
    assert.equal(f.resumen.carenciaRespetada, false);
  });
  it('las ventas se anonimizan: solo tipo de cliente, fecha y cantidad', () => {
    const f = armarFichaPublica(lc);
    assert.deepEqual(Object.keys(f.ventas[0]).sort(), ['cantidad', 'destino', 'fecha', 'unidad']);
    assert.equal(f.ventas[0].destino, 'Mercado mayorista');
    assert.doesNotMatch(JSON.stringify(f), /NO DEBE SALIR|591700/);
    assert.equal(f.resumen.kgVendidos, 40);
  });
  it('finCarencia sin días devuelve null', () => {
    assert.equal(finCarencia(new Date(), 0), null);
    assert.equal(finCarencia(new Date(), null), null);
  });
  it('las consultas SQL usan parámetro enlazado y no concatenan el token', () => {
    assert.equal(CONSULTAS_TRAZABILIDAD.length, 4);
    for (const c of CONSULTAS_TRAZABILIDAD) {
      assert.match(c.sql, /tokenPublico = \?/);
      assert.doesNotMatch(c.sql, /\$\{/);
    }
    assert.doesNotMatch(CONSULTAS_TRAZABILIDAD.find((c) => c.nombre === 'ventas').sql, /cl\.nombre|cl\.telefono/);
  });
});

describe('Inventario · clave de cultivo', () => {
  it('normaliza tildes y mayúsculas', () => {
    assert.equal(claveCultivo('Pimentón'), 'PIMENTON');
    assert.equal(claveCultivo('Maíz choclo'), 'MAIZ');
    assert.equal(claveCultivo(''), 'OTRO');
  });
});
