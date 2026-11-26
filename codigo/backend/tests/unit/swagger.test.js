// Swagger completo: toda ruta registrada en Express debe estar documentada en OpenAPI (y viceversa).
import { describe, it, expect } from 'vitest';
import { openapi } from '../../src/docs/openapi.js';
import auth from '../../src/routes/auth.js';
import fincas from '../../src/routes/fincas.js';
import lotes from '../../src/routes/lotes.js';
import campo from '../../src/routes/campo.js';
import { privado as trazaPrivado, publico as trazaPublico } from '../../src/routes/trazabilidad.js';
import trabajadores from '../../src/routes/trabajadores.js';
import tareas from '../../src/routes/tareas.js';
import { agenteRouter, webhookRouter, twilioRouter } from '../../src/routes/agente.js';
import alertas from '../../src/routes/alertas.js';
import insumos from '../../src/routes/insumos.js';
import productos from '../../src/routes/productos.js';
import clientes from '../../src/routes/clientes.js';
import pedidos from '../../src/routes/pedidos.js';
import ventas from '../../src/routes/ventas.js';
import vivero from '../../src/routes/vivero.js';
import reportes from '../../src/routes/reportes.js';
import dashboard from '../../src/routes/dashboard.js';

// Mismos prefijos que src/app.js
const MONTAJES = [
  ['/api/auth', auth], ['/api', fincas], ['/api/lotes', lotes], ['/api/campo', campo], ['/api/trazabilidad', trazaPrivado],
  ['/api/publico/lotes', trazaPublico], ['/api/trabajadores', trabajadores], ['/api/tareas', tareas], ['/api/agente', agenteRouter],
  ['/api/webhooks/whatsapp', webhookRouter], ['/api/webhooks/twilio', twilioRouter], ['/api/alertas', alertas], ['/api/insumos', insumos],
  ['/api/productos', productos], ['/api/clientes', clientes], ['/api/pedidos', pedidos], ['/api/ventas', ventas], ['/api/vivero', vivero],
  ['/api/reportes', reportes], ['/api/dashboard', dashboard],
];

const aOpenApi = (p) => p.replace(/:(\w+)(\([^)]*\))?/g, '{$1}').replace(/\/$/, '') || '/';

function rutasExpress() {
  const lista = [];
  for (const [prefijo, router] of MONTAJES) {
    for (const capa of router.stack) {
      if (!capa.route) continue;
      for (const metodo of Object.keys(capa.route.methods)) lista.push(`${metodo.toUpperCase()} ${aOpenApi(prefijo + capa.route.path)}`);
    }
  }
  return [...new Set(lista)].sort();
}
const rutasDocumentadas = () =>
  Object.entries(openapi.paths).flatMap(([ruta, ops]) => Object.keys(ops).filter((k) => k !== 'parameters').map((m) => `${m.toUpperCase()} ${ruta}`)).sort();

describe('Swagger 100 % (CP-DOC-01)', () => {
  it('cada endpoint de la API está documentado en /api/docs', () => {
    const faltan = rutasExpress().filter((r) => !rutasDocumentadas().includes(r) && r !== 'GET /api/salud');
    expect(faltan).toEqual([]);
  });
  it('no hay rutas documentadas que no existan', () => {
    const existentes = new Set([...rutasExpress(), 'GET /api/salud']);
    expect(rutasDocumentadas().filter((r) => !existentes.has(r))).toEqual([]);
  });
});
