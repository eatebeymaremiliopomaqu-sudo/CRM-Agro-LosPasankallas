import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { config } from './config.js';
import { prisma } from './db.js';
import { autenticar, requiereModulo } from './middleware/auth.js';
import { manejadorErrores, noEncontradoRuta } from './middleware/errores.js';
import { openapi } from './docs/openapi.js';
import auth from './routes/auth.js';
import fincas from './routes/fincas.js';
import lotes from './routes/lotes.js';
import campo from './routes/campo.js';
import { privado as trazaPrivado, publico as trazaPublico } from './routes/trazabilidad.js';
import trabajadores from './routes/trabajadores.js';
import tareas from './routes/tareas.js';
import { agenteRouter, webhookRouter, twilioRouter } from './routes/agente.js';
import alertas from './routes/alertas.js';
import insumos from './routes/insumos.js';
import productos from './routes/productos.js';
import clientes from './routes/clientes.js';
import pedidos from './routes/pedidos.js';
import ventas from './routes/ventas.js';
import dashboard from './routes/dashboard.js';

export function crearApp() {
  const app = express();
  app.set('trust proxy', 1); // Render está detrás de un proxy

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: config.corsOrigin, credentials: false }));
  // Guardamos el cuerpo crudo para verificar la firma del webhook de WhatsApp
  app.use(express.json({ limit: '200kb', verify: (req, _res, buf) => { req.rawBody = buf; } }));
  if (!config.esProduccion || process.env.LOG_HTTP) app.use(morgan('dev'));
  app.use('/api', rateLimit({ windowMs: 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false }));

  // Salud (Render la usa como health check)
  app.get('/api/salud', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ ok: true, bd: 'ok', version: '1.0.0', hora: new Date().toISOString() });
    } catch {
      res.status(503).json({ ok: false, bd: 'error' });
    }
  });

  // Documentación Swagger
  app.get('/api/openapi.json', (_req, res) => res.json(openapi));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapi, { customSiteTitle: 'CRM-Agro API' }));

  // Rutas públicas
  app.use('/api/auth', auth);
  app.use('/api/publico/lotes', trazaPublico);
  app.use('/api/webhooks/whatsapp', webhookRouter); // Meta Cloud API
  app.use('/api/webhooks/twilio', twilioRouter); // Twilio (form-urlencoded + X-Twilio-Signature)

  // Rutas protegidas (JWT + módulo activo)
  app.use('/api', autenticar);
  app.use('/api/dashboard', dashboard);
  app.use('/api', fincas); // M0
  app.use('/api/lotes', lotes); // M0: lotes y cultivos siempre activos
  app.use('/api/campo', requiereModulo('M1'), campo);
  app.use('/api/trazabilidad', requiereModulo('M2'), trazaPrivado);
  app.use('/api/trabajadores', requiereModulo('M3'), trabajadores);
  app.use('/api/tareas', requiereModulo('M3'), tareas);
  app.use('/api/agente', agenteRouter); // capacidad transversal (ADR-004)
  app.use('/api/alertas', alertas);
  app.use('/api/insumos', requiereModulo('M4'), insumos);
  app.use('/api/productos', requiereModulo('M5'), productos);
  app.use('/api/clientes', requiereModulo('M5'), clientes);
  app.use('/api/pedidos', requiereModulo('M5'), pedidos);
  app.use('/api/ventas', requiereModulo('M5'), ventas);

  app.use(noEncontradoRuta);
  app.use(manejadorErrores);
  return app;
}
