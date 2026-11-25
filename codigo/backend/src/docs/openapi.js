// Especificación OpenAPI 3 (Swagger) del CRM-Agro. Se sirve en /api/docs
const ref = (n) => ({ $ref: `#/components/schemas/${n}` });
const json = (schema) => ({ content: { 'application/json': { schema } } });
const ok = (desc = 'OK', schema = { type: 'object' }) => ({ description: desc, ...json(schema) });
const errores = {
  400: { description: 'Datos inválidos' },
  401: { description: 'Sin token o token inválido' },
  403: { description: 'Sin permiso o módulo inactivo' },
  404: { description: 'No encontrado' },
};
const op = (tag, summary, extra = {}) => ({ tags: [tag], summary, responses: { 200: ok(), ...errores }, ...extra });
const cuerpo = (schema) => ({ requestBody: { required: true, ...json(schema) } });
const idParam = [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }];

export const openapi = {
  openapi: '3.0.3',
  info: {
    title: 'CRM-Agro API',
    version: '1.0.0',
    description:
      'API del CRM para fincas pequeñas: control técnico de campo, trazabilidad con QR y gestión de trabajadores. ' +
      'Autenticación con JWT (botón **Authorize**). Usuario demo: admin@finca.test / Agro2026!',
  },
  servers: [{ url: '/', description: 'Servidor actual' }],
  components: {
    securitySchemes: { bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    schemas: {
      Login: { type: 'object', required: ['email', 'password'], properties: { email: { type: 'string', example: 'admin@finca.test' }, password: { type: 'string', example: 'Agro2026!' } } },
      Lote: { type: 'object', required: ['codigo', 'nombre', 'areaHa'], properties: { codigo: { type: 'string', example: 'L-05' }, nombre: { type: 'string', example: 'Ladera norte' }, areaHa: { type: 'number', example: 0.8 }, lat: { type: 'number' }, lng: { type: 'number' }, tipoSuelo: { type: 'string' }, riego: { type: 'string', enum: ['GOTEO', 'ASPERSION', 'GRAVEDAD', 'SECANO'] } } },
      Campania: { type: 'object', required: ['cultivo', 'fechaSiembra'], properties: { cultivo: { type: 'string', example: 'Tomate' }, variedad: { type: 'string' }, fechaSiembra: { type: 'string', format: 'date' }, fechaCosechaEst: { type: 'string', format: 'date' } } },
      Labor: { type: 'object', required: ['loteId', 'tipo'], properties: { loteId: { type: 'integer' }, tipo: { type: 'string', enum: ['SIEMBRA', 'RIEGO', 'FERTILIZACION', 'FUMIGACION', 'DESHIERBE', 'PODA', 'COSECHA', 'MONITOREO', 'OTRA'] }, fecha: { type: 'string', format: 'date' }, horas: { type: 'number' }, costoBs: { type: 'number' }, descripcion: { type: 'string' }, aplicacion: ref('Aplicacion') } },
      Aplicacion: { type: 'object', description: 'Registro de lo aplicado por el encargado (no es recomendación).', properties: { producto: { type: 'string' }, ingredienteActivo: { type: 'string' }, cantidadUsada: { type: 'number' }, unidad: { type: 'string' }, periodoCarenciaDias: { type: 'integer' }, responsableTecnico: { type: 'string' } } },
      Observacion: { type: 'object', required: ['loteId', 'tipo', 'severidad', 'nota'], properties: { loteId: { type: 'integer' }, tipo: { type: 'string', enum: ['PLAGA', 'ENFERMEDAD', 'CLIMA', 'SUELO', 'OTRO'] }, severidad: { type: 'integer', minimum: 1, maximum: 5 }, nota: { type: 'string' } } },
      LoteCosecha: { type: 'object', required: ['campaniaId', 'fechaCosecha', 'cantidadKg'], properties: { campaniaId: { type: 'integer' }, fechaCosecha: { type: 'string', format: 'date' }, cantidadKg: { type: 'number' }, calidad: { type: 'string', enum: ['PRIMERA', 'SEGUNDA', 'DESCARTE'] }, destino: { type: 'string' } } },
      Trabajador: { type: 'object', required: ['nombre', 'jornalBs'], properties: { nombre: { type: 'string' }, documento: { type: 'string' }, telefono: { type: 'string' }, cargo: { type: 'string' }, jornalBs: { type: 'number', example: 120 } } },
      Asistencias: { type: 'object', properties: { registros: { type: 'array', items: { type: 'object', properties: { trabajadorId: { type: 'integer' }, fecha: { type: 'string', example: '2026-11-20' }, horas: { type: 'number', example: 8 }, tarea: { type: 'string' }, loteId: { type: 'integer' } } } } } },
      MensajeAgente: { type: 'object', required: ['texto'], properties: { texto: { type: 'string', example: 'regué el lote 2 por 3 horas' } } },
      RespuestaAgente: { type: 'object', properties: { estado: { type: 'string', enum: ['PENDIENTE', 'REGISTRADO', 'CANCELADO', 'RECHAZADO', 'FALTAN_DATOS', 'INFO', 'ERROR'] }, respuesta: { type: 'string' }, accionId: { type: 'integer' } } },
    },
  },
  security: [{ bearer: [] }],
  paths: {
    '/api/salud': { get: { ...op('Sistema', 'Estado del servicio y la base de datos'), security: [] } },
    '/api/auth/login': { post: { ...op('M0 Núcleo', 'Iniciar sesión y obtener JWT'), ...cuerpo(ref('Login')), security: [] } },
    '/api/auth/yo': { get: op('M0 Núcleo', 'Usuario y finca actuales') },
    '/api/finca': { get: op('M0 Núcleo', 'Datos de la finca y módulos activos'), patch: op('M0 Núcleo', 'Actualizar datos de la finca (PROPIETARIO)') },
    '/api/finca/modulos': { put: { ...op('M0 Núcleo', 'Activar o desactivar módulos (PROPIETARIO)'), ...cuerpo({ type: 'object', properties: { modulos: { type: 'array', items: { type: 'string' }, example: ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7'] } } }) } },
    '/api/usuarios': { get: op('M0 Núcleo', 'Listar usuarios (PROPIETARIO)'), post: op('M0 Núcleo', 'Crear usuario (PROPIETARIO)') },
    '/api/auditoria': { get: op('M0 Núcleo', 'Bitácora de auditoría (PROPIETARIO)') },
    '/api/dashboard': { get: op('Tablero', 'Indicadores, alertas y series para gráficos') },
    '/api/lotes': { get: op('M1 Control técnico de campo', 'Listar lotes con campaña actual'), post: { ...op('M1 Control técnico de campo', 'Crear lote'), ...cuerpo(ref('Lote')) } },
    '/api/lotes/{id}': { parameters: idParam, get: op('M1 Control técnico de campo', 'Detalle con historial'), patch: op('M1 Control técnico de campo', 'Editar lote'), delete: op('M1 Control técnico de campo', 'Baja lógica') },
    '/api/lotes/{id}/campanias': { parameters: idParam, post: { ...op('M1 Control técnico de campo', 'Registrar campaña (ciclo de cultivo)'), ...cuerpo(ref('Campania')) } },
    '/api/campo/labores': { get: op('M1 Control técnico de campo', 'Listar labores (filtros: loteId, tipo, desde, hasta)'), post: { ...op('M1 Control técnico de campo', 'Registrar labor (con aplicación opcional)'), ...cuerpo(ref('Labor')) } },
    '/api/campo/observaciones': { get: op('M1 Control técnico de campo', 'Listar observaciones'), post: { ...op('M1 Control técnico de campo', 'Registrar observación'), ...cuerpo(ref('Observacion')) } },
    '/api/trazabilidad/lotes': { get: op('M2 Trazabilidad', 'Listar lotes de cosecha'), post: { ...op('M2 Trazabilidad', 'Crear lote de cosecha (genera código y token QR)'), ...cuerpo(ref('LoteCosecha')) } },
    '/api/trazabilidad/lotes/{id}': { parameters: idParam, get: op('M2 Trazabilidad', 'Detalle del lote de cosecha con QR (data URL)') },
    '/api/trazabilidad/lotes/{id}/qr.svg': { parameters: idParam, get: op('M2 Trazabilidad', 'Código QR en SVG para imprimir') },
    '/api/trazabilidad/lotes/{id}/eventos': { parameters: idParam, post: op('M2 Trazabilidad', 'Agregar evento (ACOPIO, EMPAQUE, DESPACHO…)') },
    '/api/publico/lotes/{token}': { get: { ...op('M2 Trazabilidad', 'Vista pública del lote de cosecha (lo que ve quien escanea el QR)'), security: [], parameters: [{ name: 'token', in: 'path', required: true, schema: { type: 'string' } }] } },
    '/api/trabajadores': { get: op('M3 Trabajadores', 'Listar trabajadores'), post: { ...op('M3 Trabajadores', 'Registrar trabajador'), ...cuerpo(ref('Trabajador')) } },
    '/api/trabajadores/asistencias': { get: op('M3 Trabajadores', 'Listar asistencias (desde, hasta)'), post: { ...op('M3 Trabajadores', 'Pasar lista (registro masivo idempotente)'), ...cuerpo(ref('Asistencias')) } },
    '/api/trabajadores/planilla': { get: op('M3 Trabajadores', 'Planilla de jornales del periodo') },
    '/api/trabajadores/{id}/pagos': { parameters: idParam, post: op('M3 Trabajadores', 'Generar pago del periodo (PROPIETARIO)') },
    '/api/agente/mensaje': { post: { ...op('M1 Control técnico de campo', 'Enviar mensaje al agente (registra con confirmación)'), ...cuerpo(ref('MensajeAgente')), responses: { 200: ok('Respuesta del agente', ref('RespuestaAgente')), ...errores } } },
    '/api/agente/acciones': { get: op('M1 Control técnico de campo', 'Historial de acciones propuestas/confirmadas') },
    '/api/agente/whatsapp/mensajes': { get: op('M1 Control técnico de campo', 'Bitácora de mensajes de WhatsApp') },
    '/api/agente/whatsapp/simular': { post: op('M1 Control técnico de campo', 'Simular un mensaje entrante (demo)') },
    '/api/webhooks/whatsapp': { get: { ...op('M1 Control técnico de campo', 'Verificación del webhook (Meta)'), security: [] }, post: { ...op('M1 Control técnico de campo', 'Recepción de mensajes (firma HMAC)'), security: [] } },
    '/api/insumos': { get: op('M4 Inventarios', 'Listar insumos con alerta de stock'), post: op('M4 Inventarios', 'Crear insumo') },
    '/api/insumos/{id}/movimientos': { parameters: idParam, post: op('M4 Inventarios', 'Entrada o salida de stock') },
  },
};
