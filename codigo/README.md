# 🌱 CRM-Agro

CRM web modular y de bajo costo para fincas pequeñas: **control técnico de campo**, **trazabilidad con QR** y **gestión de trabajadores**, con **WhatsApp** y un **agente de IA** que registra datos con confirmación previa y **nunca recomienda dosis de agroquímicos**.

> Todos los datos incluidos son **ficticios** (Finca Los Molles, Comarapa).

## Módulos

| Código | Módulo | Qué hace |
|---|---|---|
| M0 | Núcleo | Login JWT, roles (ADMIN, TECNICO, SUPERVISOR, CONSULTA), finca, **módulos activables**, auditoría |
| M1 | Parcelas y cultivos | Parcelas en mapa (Leaflet/OSM), ciclos de siembra |
| M2 | Control técnico de campo | Labores, registro de aplicaciones (sin recomendaciones), observaciones fitosanitarias |
| M3 | Trazabilidad | Lotes de cosecha con código correlativo, **QR** y página pública del lote |
| M4 | Trabajadores | Personal, pasar lista, planilla de jornales y pagos |
| M5 | WhatsApp + agente IA | Webhook de WhatsApp Cloud API, agente (Claude / Groq / reglas) con confirmación SI/NO |
| M6 | Inventario (opcional) | Insumos con alertas de stock mínimo |

## Estructura

```
codigo/
├── backend/            API Node.js + Express + Prisma + SQLite
│   ├── prisma/         schema.prisma, seed.js (datos ficticios)
│   ├── src/
│   │   ├── agente/     agente.js (orquestador), parser.js (reglas), llm.js, guardrails.js
│   │   ├── routes/     un archivo por módulo
│   │   ├── services/   lotes/QR, nómina, WhatsApp
│   │   ├── middleware/ JWT, roles, módulos, validación Zod, errores
│   │   └── docs/       OpenAPI (Swagger en /api/docs)
│   └── tests/          unit/ (node:test) e integracion/ (supertest)
├── frontend/           Vue 3 + Vite + Pinia + PWA (sin conexión)
├── render.yaml         despliegue del backend en Render
└── .github/workflows/  CI/CD con GitHub Actions
```

## Ejecutar en local

Requisitos: Node.js 20+.

```bash
# 1) Backend
cd backend
cp .env.example .env
npm install
npx prisma db push        # crea dev.db (SQLite)
npm run db:seed           # carga datos ficticios
npm run dev               # http://localhost:3000  ·  Swagger: /api/docs

# 2) Frontend (otra terminal)
cd frontend
npm install
npm run dev               # http://localhost:5173
```

Usuarios de prueba (clave `Agro2026!`): `admin@finca.test`, `tecnico@finca.test`, `supervisor@finca.test`, `consulta@finca.test`.

## Pruebas

```bash
cd backend && npm run test:cov     # 91 pruebas unitarias + cobertura
cd backend && npm run test:int     # integración (requiere BD con seed)
cd frontend && npm test            # Vitest
```

## Despliegue

- **Backend → Render**: *New → Blueprint* apuntando al repositorio (usa `render.yaml`). Health check: `/api/salud`.
- **Frontend → Vercel**: importar la carpeta `frontend`, variable `VITE_API_URL` = URL de Render. `vercel.json` ya resuelve las rutas de la SPA.
- Ajustar en Render `CORS_ORIGIN` y `FRONTEND_URL` con la URL de Vercel.

## WhatsApp

1. Crear app en Meta for Developers → WhatsApp → número de prueba.
2. Webhook: `https://<render>/api/webhooks/whatsapp`, token de verificación = `WHATSAPP_VERIFY_TOKEN`, suscribir `messages`.
3. Cargar `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` y `WHATSAPP_APP_SECRET` en Render.
4. El teléfono de cada usuario (Configuración → Usuarios) identifica quién escribe.

Sin credenciales, el sistema funciona en **modo simulado** (pantalla *Agente y WhatsApp → Simular WhatsApp*).

## Agente de IA

`AI_PROVIDER=claude` (requiere `ANTHROPIC_API_KEY`), `groq` (requiere `GROQ_API_KEY`) o `reglas` (sin internet ni costo). Si el LLM falla o responde algo inválido, se usa automáticamente el intérprete por reglas.
