// Pruebas del backend con Vitest (ADR-008). Unitarias + API (supertest) sobre una BD SQLite de prueba
// que se crea y se carga con los datos ficticios automáticamente (tests/setup/bd-prueba.js).
import { defineConfig } from 'vitest/config';

export const ENV_PRUEBAS = {
  NODE_ENV: 'test',
  DATABASE_URL: 'file:./test.db', // relativo a prisma/ → prisma/test.db (ignorado por Git)
  JWT_SECRET: 'secreto-solo-para-pruebas',
  FRONTEND_URL: 'http://localhost:5173',
  ALERTAS_ACTIVAS: 'false',
  AI_PROVIDER: 'reglas',
  WHATSAPP_PROVIDER: 'simulado',
  TWILIO_AUTH_TOKEN: 'token-de-prueba',
  TWILIO_WEBHOOK_URL: 'http://localhost/api/webhooks/twilio',
  TWILIO_VALIDAR_FIRMA: 'true',
  WHATSAPP_APP_SECRET: 'secreto-meta-de-prueba',
  // Valores fijos: el .env local (con credenciales reales de Meta) no debe influir en las pruebas.
  WHATSAPP_VERIFY_TOKEN: 'crm-agro-verify',
  WHATSAPP_TOKEN: '',
  WHATSAPP_PHONE_NUMBER_ID: '',
};

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    globalSetup: ['tests/setup/bd-prueba.js'],
    env: ENV_PRUEBAS,
    fileParallelism: false, // un solo archivo SQLite
    testTimeout: 20000,
    hookTimeout: 120000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.js'],
      exclude: ['src/server.js', 'src/docs/**'],
      reporter: ['text', 'text-summary', 'html', 'json-summary'],
      reportsDirectory: 'coverage',
      // Meta de la guía: ≥ 80 % global y ≥ 90 % en la lógica crítica. Si baja, `npm run test:cov` falla (y el CI también).
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 75,
        'src/agente/{agente,guardrails,parser,politicas}.js': { lines: 95, functions: 95 },
        'src/utils/{carencia,tareas,vivero}.js': { lines: 90 },
        'src/services/{finanzas,trazabilidad}.js': { lines: 95 },
        'src/routes/ventas.js': { lines: 90 },
      },
    },
  },
});
