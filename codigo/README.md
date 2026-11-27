# 🌱 CRM-Agro

CRM web **modular y de bajo costo** para fincas pequeñas (frutas, hortalizas y vivero): control técnico de campo, trazabilidad con **QR**, trabajadores, inventarios, ventas, vivero y finanzas, con un **agente de IA por WhatsApp** que registra labores y cosechas **con confirmación previa (SI/NO)** y **nunca recomienda dosis** de agroquímicos.

> Todos los datos de la finca son **ficticios** (Finca Los Molles, Comarapa, Santa Cruz).

**Grupo Los Pasankallas** · Beymar Emilio Poma Queso (trabajo individual: Product Owner, Scrum Master y Developer) · UNIFRANZ Sede El Alto, Ingeniería de Sistemas · Programación Gráfica y Multimedia · Docente: Ing. Juan Gabriel Lazcano Balanza · Hito 5

## Módulos (activables por finca)

| Código | Módulo | Qué hace | Depende de |
|---|---|---|---|
| M0 | Núcleo | Login JWT, roles, finca, usuarios, **lotes de campo** y **campañas**, módulos activables (tabla `ModuloFinca`), auditoría | — (siempre activo) |
| M1 | Control técnico de campo | Calendario de labores, riego programado, labores, **aplicaciones** (producto, motivo, fecha, **carencia**), observaciones, cosechas por lote | M0 |
| M2 | Trazabilidad | **Lote de cosecha** con código y **QR**; ficha pública lote → labores → cosecha → venta; consulta SQL documentada | M1 |
| M3 | Trabajadores | Personal, asistencia, **tareas asignadas** ("Mis tareas"), jornales y pagos | M0 |
| M4 | Inventarios | Insumos y **productos cosechados**, entradas/salidas, alerta de stock mínimo | M0 |
| M5 | Ventas y clientes | Clientes (consentimiento WhatsApp), pedidos, ventas, precios, cobros y **cuentas por cobrar** | M4 |
| M6 | Vivero | Lotes de plantines: siembra, germinación (%), merma, stock y venta por M5 | — |
| M7 | Reportes y finanzas | **Costo por lote**, ingresos, **margen**, gráficos y exportación CSV | M1, M4 |
| — | WhatsApp + agente IA | Capacidad transversal (`Finca.whatsappActivo`): Meta Cloud API (usado), Twilio o simulado; alertas diarias | — |

Si un módulo está apagado, su menú desaparece y la API responde **403**.

**Terminología:** *lote* = campo/parcela de la finca (M0). *Lote de cosecha* = producto cosechado con código QR (M2).

## Roles

| Rol | Puede |
|---|---|
| PROPIETARIO | Todo: configura la finca, módulos y usuarios; pagos; **finanzas (M7)**; forzar una cosecha en carencia con justificación |
| ENCARGADO | Campo, aplicaciones fitosanitarias, trazabilidad, inventario, ventas, trabajadores y tareas, alertas |
| TRABAJADOR | Ve y marca **sus tareas**, registra labores y observaciones simples, consulta carencias. No ve ventas, finanzas ni pagos |

## Usuarios de demostración (clave `Agro2026!`)

| Correo | Rol | WhatsApp |
|---|---|---|
| propietario@finca.test | PROPIETARIO | 59170000001 |
| encargado@finca.test | ENCARGADO | `DEMO_WHATSAPP_ENCARGADO` del `.env` (sin valor: 59170000002) |
| trabajador@finca.test | TRABAJADOR (Juan Pérez) | 59170000003 |

Clientes de prueba con WhatsApp: `59133445566` (con consentimiento), `59166778899` (sin consentimiento).

## Ejecutar en local (Windows · PowerShell)

Requisitos: **Node.js 20 o superior** (probado con Node 26 y npm 11). **La ruta de la carpeta no puede contener `#`** (Vite falla).

```powershell
# 1) Backend  →  http://localhost:3000  ·  Swagger: http://localhost:3000/api/docs
cd codigo\backend
Copy-Item .env.example .env
npm install
# npm 11 bloquea scripts de instalación: autoriza los de Prisma y esbuild una sola vez
npm install-scripts approve prisma @prisma/client @prisma/engines esbuild
npm rebuild
npx prisma generate
npx prisma db push
npm run db:seed
npm run dev

# 2) Frontend (otra terminal)  →  http://localhost:5173
cd codigo\frontend
npm install
npm install-scripts approve esbuild   # solo si npm lo pide
npm rebuild
npm run dev
```

> Para reiniciar los datos de la demo: `npm run db:seed` en `codigo/backend`.
> Para liberar un puerto ocupado usa el PID exacto: `netstat -ano | findstr :3000` y luego `taskkill /PID <número> /F` (nunca `taskkill /IM node.exe`).

## Demo de la exposición (8–10 min)

**Labor por WhatsApp → cosecha → QR → inventario → venta.** Paso a paso en `../evidencias/guion_exposicion.md`.

1. *Agente y WhatsApp → Simular WhatsApp* (o tu celular con Meta Cloud API): `regué el lote 2 por 2 horas` → `SI`.
2. `hoy cosechamos 40 kg de tomate del lote 2` → `SI` → código del lote de cosecha y enlace del QR.
3. Abrir el QR: labores, aplicaciones con carencia respetada, cosecha.
4. *Inventarios → Productos cosechados*: el tomate subió 40 kg.
5. *Ventas → Nueva venta* vinculada al lote de cosecha → el QR muestra la venta (sin datos del cliente).
6. Límites: `hoy cosechamos 20 kg de cebolla del lote 5` → bloqueo por carencia; `¿qué dosis le echo al lote 5?` → rechazo.

## WhatsApp

- Sin credenciales funciona en modo **simulado** (bitácora en *Agente y WhatsApp*).
- **Meta Cloud API (el usado en este proyecto):** [`docs/WHATSAPP_META.md`](docs/WHATSAPP_META.md) — webhook `/api/webhooks/whatsapp`.
- **Twilio Sandbox (alternativa):** [`docs/WHATSAPP_TWILIO.md`](docs/WHATSAPP_TWILIO.md) — webhook `POST /api/webhooks/twilio`. No se usó porque Twilio no envía el SMS de verificación a Bolivia (ADR-022).
- Comandos `ALTA` / `BAJA` para el consentimiento. Alertas diarias a la hora configurada (solo a quien aceptó).

## Pruebas

```powershell
cd codigo\backend ; npm test          # Vitest: unitarias + API (crea prisma/test.db sola)
cd codigo\backend ; npm run test:cov  # con cobertura (umbrales en vitest.config.js)
cd codigo\frontend ; npm test         # Vitest (jsdom)
```

Resultados, plan, UAT, defectos y métricas en `../evidencias/pruebas/`.

## Estructura

```
codigo/
├── backend/                 API Node.js + Express + Prisma + SQLite
│   ├── prisma/              schema.prisma · seed.js (historia de la demo) · seed-si-vacio.js (Render)
│   ├── src/
│   │   ├── agente/          agente.js (orquestador SI/NO) · parser.js (reglas) · llm.js (Claude/Groq)
│   │   │                    guardrails.js (no dosis) · politicas.js (perfiles) · repositorio.js
│   │   ├── routes/          un archivo por módulo + webhooks + alertas
│   │   ├── services/        whatsapp (Meta/Twilio/simulado) · alertas · trazabilidad (SQL) · finanzas · inventario
│   │   ├── utils/           carencia · tareas · vivero · permisos (RBAC puro) · códigos
│   │   ├── middleware/      JWT, roles, módulos activos, validación Zod, errores
│   │   └── docs/openapi.js  Swagger (100 % de las rutas, verificado por prueba)
│   ├── tests/               unit/ · integracion/ (supertest) · setup/ (BD de prueba)
│   └── vitest.config.js
├── frontend/                Vue 3 + Vite + Pinia + Vue Router + PWA (cola sin conexión), Leaflet, Chart.js
├── docs/                    WHATSAPP_META.md · WHATSAPP_TWILIO.md · DESPLIEGUE.md
└── (raíz del repositorio)    render.yaml (Blueprint de Render) · .github/workflows/ci.yml (CI/CD)
```

## Despliegue

Frontend en **Vercel**, backend + SQLite en **Render**. Guía: [`docs/DESPLIEGUE.md`](docs/DESPLIEGUE.md).

## Decisiones técnicas

Ver `../DECISIONES.md` (ADR-001 a ADR-022) y `../PENDIENTES.md`.

## Seguridad y ética

JWT con expiración, RBAC en la API, Helmet, límite de intentos de login, validación Zod en cada entrada, auditoría, secretos solo en `.env`. Consentimiento de WhatsApp con fecha (ALTA/BAJA) para trabajadores, usuarios y clientes. Bloqueo de cosecha y venta en período de carencia. El agente no reemplaza al agrónomo: no recomienda productos, dosis ni mezclas, y siempre pide confirmación.
