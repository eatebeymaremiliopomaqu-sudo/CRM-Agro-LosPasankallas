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
    // twilio | meta | simulado. Si falta alguna credencial del proveedor elegido, se usa "simulado".
    proveedor: (process.env.WHATSAPP_PROVIDER || 'simulado').toLowerCase(),
    // Meta Cloud API
    token: process.env.WHATSAPP_TOKEN || '',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || 'crm-agro-verify',
    appSecret: process.env.WHATSAPP_APP_SECRET || '',
    // Twilio (Sandbox o número aprobado)
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || '',
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || '',
    twilioFrom: process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886',
    // URL pública EXACTA configurada en Twilio (para validar X-Twilio-Signature detrás de túneles/proxies)
    twilioWebhookUrl: process.env.TWILIO_WEBHOOK_URL || '',
    // En desarrollo se puede desactivar la validación de firma (NUNCA en producción)
    twilioValidarFirma: process.env.TWILIO_VALIDAR_FIRMA !== 'false',
  },
  alertas: {
    // Programador interno (setInterval). Se desactiva en pruebas.
    activas: process.env.ALERTAS_ACTIVAS !== 'false' && process.env.NODE_ENV !== 'test',
    zonaHorariaMin: Number(process.env.ZONA_HORARIA_MIN ?? -240), // Bolivia UTC-4
  },
};

export { ROLES, MODULOS } from './constantes.js';
