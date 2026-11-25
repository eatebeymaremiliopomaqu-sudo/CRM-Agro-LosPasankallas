import 'dotenv/config';

const requerida = (nombre, porDefecto) => {
  const valor = process.env[nombre] ?? porDefecto;
  if (valor === undefined || valor === '') {
    throw new Error(`Falta la variable de entorno ${nombre}`);
  }
  return valor;
};

const esProduccion = process.env.NODE_ENV === 'production';

export const config = {
  port: Number(process.env.PORT || 3000),
  esProduccion,
  // En producción el secreto es obligatorio; en desarrollo hay uno de respaldo.
  jwtSecret: esProduccion ? requerida('JWT_SECRET') : process.env.JWT_SECRET || 'dev-secreto-no-usar-en-produccion',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map((s) => s.trim()),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  ia: {
    proveedor: process.env.AI_PROVIDER || 'reglas',
    anthropicKey: process.env.ANTHROPIC_API_KEY || '',
    anthropicModel: process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5',
    groqKey: process.env.GROQ_API_KEY || '',
    groqModel: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
    minutosConfirmacion: 10,
  },
  whatsapp: {
    token: process.env.WHATSAPP_TOKEN || '',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || 'crm-agro-verify',
    appSecret: process.env.WHATSAPP_APP_SECRET || '',
  },
};

export { ROLES, MODULOS } from './constantes.js';
