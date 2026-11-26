import { describe, it, expect } from 'vitest';
import { PERMISOS, puede } from '../src/utils/permisos.js';
import { PERMISOS as PERMISOS_API } from '../../backend/src/utils/permisos.js';
import { tareaVencida } from '../src/utils/tareas.js';

describe('Matriz RBAC del frontend', () => {
  it('es idéntica a la del backend (si no, se ocultan o muestran botones por error)', () => {
    expect(PERMISOS).toEqual({ ...PERMISOS_API });
  });
  it('el trabajador ve sus tareas pero no ventas ni finanzas', () => {
    expect(puede('TRABAJADOR', 'tareas:leer')).toBe(true);
    expect(puede('TRABAJADOR', 'tareas:escribir')).toBe(false);
    expect(puede('TRABAJADOR', 'ventas:leer')).toBe(false);
    expect(puede('TRABAJADOR', 'finanzas:ver')).toBe(false);
  });
  it('permiso desconocido es falso', () => expect(puede('PROPIETARIO', 'x:y')).toBe(false));
});

describe('Tareas · vencimiento en la UI', () => {
  it('vence al terminar el día y solo si está activa', () => {
    const t = { estado: 'PENDIENTE', fechaVencimiento: '2026-11-20T00:00:00Z' };
    expect(tareaVencida(t, new Date('2026-11-20T20:00:00Z'))).toBe(false);
    expect(tareaVencida(t, new Date('2026-11-21T00:30:00Z'))).toBe(true);
    expect(tareaVencida({ ...t, estado: 'COMPLETADA' }, new Date('2027-01-01'))).toBe(false);
  });
});
