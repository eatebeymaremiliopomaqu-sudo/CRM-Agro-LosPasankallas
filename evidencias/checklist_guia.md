# Lista de verificación de la guía del ingeniero

✅ cumplido y verificado · ⏳ listo en el código, falta un paso que requiere las cuentas o los datos del autor

**Grupo Los Pasankallas** · Beymar Emilio Poma Queso (trabajo individual) · Programación Gráfica y Multimedia · Hito 5

## Módulos

| # | Requisito | Estado | Evidencia |
|---|---|---|---|
| 1 | M0 Núcleo: finca, usuarios con roles propietario/encargado/trabajador, lotes y cultivos, módulos activables | ✅ | `ModuloFinca`, `middleware/auth.js`, `utils/permisos.js`; prueba CP-M0-01 |
| 2 | M1 Campo: calendario de labores, riego, aplicaciones (producto, motivo, fecha, carencia), cosechas por lote | ✅ | `routes/campo.js`, `CampoView.vue`; CP-M1-10, CP-M2-02 |
| 3 | M2 Trazabilidad: código con QR, historial lote → labores → cosecha → venta, ficha para el cliente | ✅ | `services/trazabilidad.js`, `LotePublicoView.vue`; CP-M2-10/11 |
| 4 | M3 Trabajadores: registro, asistencia, tareas asignadas, jornales y pagos | ✅ | `routes/trabajadores.js`, `routes/tareas.js`, `MisTareasView.vue`; CP-M3-01/10 |
| 5 | M4 Inventarios: insumos y productos cosechados, entradas/salidas, alerta de stock mínimo | ✅ | `InsumosView.vue` (Inventarios), `services/inventario.js`; CP-M4-01/02 |
| 6 | M5 Ventas: clientes, pedidos, ventas, precios, cuentas por cobrar | ✅ | `VentasView.vue`, `routes/ventas.js`; CP-M5-01/02 |
| 7 | Al menos un módulo opcional | ✅ | M6 Vivero y M7 Reportes y finanzas (ambos) |
| 8 | Módulos activables: UI oculta y API 403 | ✅ | CP-M0-01 (prueba de API) |

## Requisitos técnicos

| # | Requisito | Estado | Evidencia |
|---|---|---|---|
| 9 | SQLite con entidades sugeridas (finca, lote, cultivo/campaña, labor, aplicación, cosecha, trabajador, jornal, insumo, movimiento, cliente, venta, detalle) | ✅ | `prisma/schema.prisma` (30 tablas); `diagramas/modelo_er.png` |
| 10 | Informe explica tablas, claves, normalización y consultas clave | ✅ | Informe §5; `prisma/consultas_clave.sql` (verificadas) |
| 11 | Backend Node.js + Express, REST, JWT, roles, validaciones | ✅ | `src/`; Zod en cada entrada; CP-SEG-01/02 |
| 12 | Frontend Vue 3 (Vite, Router, Pinia), responsivo, PWA | ✅ | `codigo/frontend`; `vite-plugin-pwa`; barra inferior por rol |
| 13 | WhatsApp (Cloud API o Twilio): registrar labores y cosechas | ✅ código · ⏳ celular real | `routes/agente.js`, `services/whatsapp.js`; CP-WA-05 (webhook firmado en pruebas). Falta: conectar el celular de Beymar (`docs/WHATSAPP_TWILIO.md`) |
| 14 | Enviar alertas (riego, aplicaciones, stock mínimo) | ✅ | `services/alertas.js`; botón "Enviar ahora"; CP-WA-04 |
| 15 | Recibir pedidos de clientes | ✅ | Intención PEDIDO_CLIENTE; CP-AG-20 |
| 16 | Agente IA interpreta mensajes con confirmación previa | ✅ | `agente/agente.js`; CP-AG-05 |
| 17 | Agente responde consultas sobre labores, inventario y ventas | ✅ | `agente/repositorio.js#consultar`; CP-AG-20 |
| 18 | Agente no reemplaza al agrónomo, no inventa dosis, siempre confirma | ✅ | `agente/guardrails.js`; CP-AG-01/02, DEF-17 |

## SCRUM

| # | Requisito | Estado | Evidencia |
|---|---|---|---|
| 19 | Product Backlog | ✅ | `scrum/product_backlog.csv` (importable en Jira/Trello) |
| 20 | Sprint 0 + 3 sprints | ✅ | `scrum/sprint0_analisis.md`, `sprint_backlog_1..3.md`, ramas `sprint-0..3` |
| 21 | Sprint Backlog | ✅ | `scrum/sprint_backlog_N.md` |
| 22 | Tablero Jira/Trello | ⏳ | Importar `product_backlog.csv` en el tablero de Trello o Jira y agregar captura en `evidencias/capturas/` |
| 23 | Notas de daily | ✅ · ✏️ fechas | `scrum/notas_daily.md` (registro diario de una persona; completar las fechas reales) |
| 24 | Review y retrospectiva por sprint | ✅ · ✏️ observaciones | `scrum/reviews_y_retrospectivas.md` (completar las observaciones del PO) |
| 25 | Burndowns y velocidad | ✅ plantilla | `scrum/burndown_sprintN.png`, `velocidad.png` (reemplazar el avance diario con el registro real en `scrum/fuente/generar_scrum.mjs`) |

## Pruebas

| # | Requisito | Estado | Evidencia |
|---|---|---|---|
| 26 | Plan de pruebas | ✅ | `pruebas/plan_de_pruebas.csv` |
| 27 | Casos funcionales, de API y UAT con usuario de finca simulado | ✅ | `tests/integracion/*.test.js`; `pruebas/casos_uat.md` (Don Hilario) |
| 28 | Pruebas automatizadas con Jest o Vitest | ✅ | Vitest: 249 backend + 14 frontend, todas en verde |
| 29 | Reporte de defectos | ✅ | `pruebas/reporte_defectos.csv` (32) |
| 30 | Métricas: cobertura y defectos por severidad | ✅ | `pruebas/metricas.md` + `metricas.png` (96 % de líneas) |

## Despliegue

| # | Requisito | Estado | Evidencia |
|---|---|---|---|
| 31 | Frontend en Vercel | ⏳ | `codigo/frontend/vercel.json` listo; pasos en `docs/DESPLIEGUE.md` §2 |
| 32 | Backend + BD en Render | ⏳ | `render.yaml` (raíz) listo y probado en modo producción; `DESPLIEGUE.md` §1 |
| 33 | Variables de entorno protegidas | ✅ | `.env.example` sin valores; `sync: false` en Render |
| 34 | URL pública | ⏳ | Completar en `LEEME.txt` e informe tras desplegar |
| 35 | Costo mensual estimado y justificado | ✅ | Informe §12; `DESPLIEGUE.md` §8 |

## Seguridad y ética

| # | Requisito | Estado | Evidencia |
|---|---|---|---|
| 36 | Datos protegidos, sin claves en el repositorio | ✅ | `.gitignore`; JWT, RBAC, Helmet, auditoría |
| 37 | Consentimiento de trabajadores y clientes para WhatsApp | ✅ | Campos con fecha + ALTA/BAJA; CP-M3-11, CP-WA-05 |
| 38 | Respeto de los períodos de carencia | ✅ | 409 en web, WhatsApp y ventas; CP-M2-02 |

## Entregables

| # | Requisito | Estado | Evidencia |
|---|---|---|---|
| 39 | Código ZIP con README | ✅ | `entrega/CRM_Agro_Grupo_LosPasankallas.zip`; `codigo/README.md` |
| 40 | Grupos de 3 con roles rotativos y ramas por sprint | ✅ trabajo individual (adaptación explicada en el informe) | Beymar asumió PO, SM y Developer (informe §8.1); ramas `sprint-0..3` con sus commits |
| 41 | Informe PDF con todas las secciones | ✅ | `informe/Informe_Grupo_LosPasankallas.pdf` (fuente HTML) |
| 42 | Diapositivas PPTX 12–15 láminas (problema, solución, arquitectura, demo, SCRUM, calidad, aprendizajes) | ✅ | `diapositivas/Diapositivas_Grupo_LosPasankallas.pptx` (14, con notas) |
| 43 | Evidencia SCRUM | ✅ | `evidencias/scrum/` |
| 44 | Plan y reporte de pruebas | ✅ | `evidencias/pruebas/` |
| 45 | Exposición 8–10 min con el flujo WhatsApp → cosecha → QR → inventario → venta | ✅ guion | `evidencias/guion_exposicion.md`; flujo verificado contra el servidor |
| 46 | ZIP `CRM_Agro_Grupo_LosPasankallas.zip` sin node_modules, .env ni *.db | ✅ | Generado con `git archive` (solo archivos versionados) |
| 47 | LEEME.txt con integrantes, roles y usuarios | ✅ | `LEEME.txt` (grupo, integrante, roles asumidos, usuarios de prueba y arranque) |
| 48 | Capturas reales de la app desplegada | ⏳ | Agregar en `evidencias/capturas/` tras desplegar |
