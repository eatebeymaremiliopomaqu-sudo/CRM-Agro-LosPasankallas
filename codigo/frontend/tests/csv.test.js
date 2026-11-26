import { describe, it, expect } from 'vitest';
import { aCSV } from '../src/utils/csv.js';

describe('Exportación CSV (M7)', () => {
  const cols = [['codigo', 'Lote'], ['margen', 'Margen (Bs)'], ['nota', 'Nota']];
  it('usa ";" y coma decimal para Excel en español', () => {
    expect(aCSV([{ codigo: 'L-01', margen: 280.5, nota: 'ok' }], cols)).toBe('Lote;Margen (Bs);Nota\r\nL-01;280,5;ok');
  });
  it('escapa comillas, separadores y saltos de línea', () => {
    expect(aCSV([{ codigo: 'L;2', margen: null, nota: 'dijo "hola"\nfin' }], cols).split('\r\n')[1]).toBe('"L;2";;"dijo ""hola""\nfin"');
  });
  it('sin filas devuelve solo la cabecera', () => expect(aCSV([], cols)).toBe('Lote;Margen (Bs);Nota'));
});
