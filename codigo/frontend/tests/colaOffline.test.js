import { describe, it, expect, beforeEach } from 'vitest';
import { crearCola } from '../src/utils/colaOffline.js';
import { puede } from '../src/utils/permisos.js';
import { bs, claseSeveridad, fecha, iniciales, numero } from '../src/utils/formato.js';

function almacenMemoria() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
}

describe('Cola sin conexión (CP-PWA-01)', () => {
  let cola;
  beforeEach(() => {
    cola = crearCola(almacenMemoria());
  });

  it('encola y lista en orden', () => {
    cola.encolar({ metodo: 'POST', ruta: '/campo/labores', cuerpo: { a: 1 } });
    cola.encolar({ metodo: 'POST', ruta: '/campo/observaciones', cuerpo: { b: 2 } });
    expect(cola.cantidad()).toBe(2);
    expect(cola.listar()[0].ruta).toBe('/campo/labores');
  });

  it('sincroniza todo cuando vuelve la red', async () => {
    cola.encolar({ metodo: 'POST', ruta: '/x', cuerpo: {} });
    cola.encolar({ metodo: 'POST', ruta: '/y', cuerpo: {} });
    const enviados = [];
    const r = await cola.sincronizar(async (i) => enviados.push(i.ruta));
    expect(r.enviados).toBe(2);
    expect(r.pendientes).toBe(0);
    expect(enviados).toEqual(['/x', '/y']);
  });

  it('si sigue sin red, se detiene y conserva los pendientes', async () => {
    cola.encolar({ metodo: 'POST', ruta: '/x', cuerpo: {} });
    cola.encolar({ metodo: 'POST', ruta: '/y', cuerpo: {} });
    const r = await cola.sincronizar(async () => {
      throw Object.assign(new Error('sin red'), { status: 0 });
    });
    expect(r.enviados).toBe(0);
    expect(r.pendientes).toBe(2);
    expect(cola.listar()[0].intentos).toBe(1);
  });

  it('descarta y reporta los rechazados por validación (4xx)', async () => {
    cola.encolar({ metodo: 'POST', ruta: '/malo', cuerpo: {}, descripcion: 'Labor X' });
    cola.encolar({ metodo: 'POST', ruta: '/bueno', cuerpo: {} });
    const r = await cola.sincronizar(async (i) => {
      if (i.ruta === '/malo') throw Object.assign(new Error('Datos inválidos'), { status: 400 });
    });
    expect(r.rechazados).toHaveLength(1);
    expect(r.enviados).toBe(1);
    expect(r.pendientes).toBe(0);
  });

  it('tolera almacenamiento corrupto', () => {
    const a = almacenMemoria();
    a.setItem('crm-agro:cola', '{roto');
    expect(crearCola(a).listar()).toEqual([]);
  });
});

describe('Utilidades de interfaz', () => {
  it('permisos de la interfaz', () => {
    expect(puede('CONSULTA', 'labores:escribir')).toBe(false);
    expect(puede('TECNICO', 'aplicaciones:escribir')).toBe(true);
    expect(puede('SUPERVISOR', 'aplicaciones:escribir')).toBe(false);
  });
  it('formatos', () => {
    expect(fecha(null)).toBe('—');
    expect(numero(undefined)).toBe('—');
    expect(bs(10)).toMatch(/^Bs 10[,.]00$/);
    expect(iniciales('Juan Pérez Choque')).toBe('JP');
    expect(claseSeveridad(5)).toBe('rojo');
    expect(claseSeveridad(3)).toBe('ambar');
    expect(claseSeveridad(1)).toBe('gris');
  });
});
