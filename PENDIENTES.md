# Tareas Pendientes - CRM-Agro PASANKALLAS

Este archivo registra las tareas pendientes organizadas por bloques según el orden de prioridad establecido.

## ✅ COMPLETADO

### BLOQUE 1 - Renumeración y nomenclatura (sprint-1) ✅
- [x] Schema migrado: Parcela→Lote, Siembra→Campania, ModuloFinca, campos consentimiento
- [x] Constantes y permisos actualizados (roles PROPIETARIO, ENCARGADO, TRABAJADOR)
- [x] Seed actualizado con nueva nomenclatura
- [x] Backend actualizado (middleware, rutas, agente, servicios, Swagger)
- [x] Frontend actualizado (router, vistas, stores, api, componentes)
- [x] Pruebas actualizadas (backend: 91 pruebas ✅, frontend: 7 pruebas ✅)
- [x] Backend arranca correctamente
- [x] Frontend compila sin errores
- [x] Commit: f5e9395

### BLOQUE 2 - Calendario, aplicaciones con carencia (sprint-1) ✅
- [x] Modelo `LaborProgramada` para calendario
- [x] Vista de calendario con tabla de labores programadas en frontend
- [x] Riego programado por frecuencia (campo LaborProgramada con tipos)
- [x] Aplicación con campos: `motivo`, `dosisEtiqueta` (texto), `periodoCarenciaDias`
- [x] Cálculo y display de fecha fin de carencia
- [x] Validación backend: HTTP 409 al cosechar lote en carencia (utils/carencia.js)
- [x] Override solo para PROPIETARIO con justificación
- [x] Pruebas automatizadas de bloqueo por carencia (10 tests nuevos)
- [x] Registro directo de cosecha por lote (en trazabilidad)
- [x] Commit: 45bc7a2

### BLOQUE 3 - Inventario de productos y Ventas (sprint-2) ✅
- [x] Inventario de productos cosechados (ProductoCosechado, MovimientoProducto)
- [x] Inventario de plantines (pendiente para M6)
- [x] Movimientos: cosecha→entrada, venta→salida automáticos
- [x] Descontar insumo usado en aplicación (opcional - no implementado)
- [x] Modelos: Cliente, Pedido, DetallePedido, Venta, DetalleVenta, Cobro
- [x] VentasView.vue completa con 5 pestañas
- [x] Vinculación DetalleVenta → LoteCosecha (trazabilidad)
- [x] Lista de precios (ProductoCosechado.precioVentaBs)
- [x] Cobros y cuentas por cobrar con estado automático
- [x] Pantallas móvil-first responsive
- [x] Backend: 4 rutas nuevas (productos, clientes, pedidos, ventas)
- [x] Seed: 5 productos, 6 clientes, 3 pedidos, 5 ventas
- [x] Permisos: ventas:leer, ventas:escribir
- [x] 105 pruebas backend ✅, 7 pruebas frontend ✅
- [x] Commit: 0b35d89

### BLOQUE 4 - Trazabilidad completa y Tareas (sprint-2) ✅
- [x] Ficha pública QR: lote → labores (aplicaciones y carencia) → cosecha → eventos → ventas (solo tipo de cliente)
- [x] Consultas SQL de trazabilidad documentadas y ejecutadas con parámetro enlazado (`GET /api/publico/lotes/:token/sql`)
- [x] Modelo `Tarea` vinculado a Trabajador (prioridad, estado, vencimiento, aviso)
- [x] Vista "Mis tareas" para rol TRABAJADOR (móvil, funciona sin conexión)
- [x] Asignación y seguimiento de tareas desde ENCARGADO/PROPIETARIO (pestaña en Trabajadores)
- [x] Aviso por WhatsApp al asignar tarea solo con consentimiento (fecha de consentimiento guardada)
- [x] Cosecha genera entrada automática en inventario de productos
- [x] Correcciones: forzar carencia (justificación se perdía en Zod), orden de tareas, `/api/lotes` en M0
- [x] 121 pruebas backend ✅, 7 pruebas frontend ✅, build OK

### BLOQUE 5 - WhatsApp real (Twilio + Meta) (sprint-3) ✅
- [x] Abstracción `WHATSAPP_PROVIDER` (twilio | meta | simulado)
- [x] Webhook Twilio `POST /api/webhooks/twilio` (form-urlencoded, firma X-Twilio-Signature, respuesta TwiML)
- [x] Normalización de números (`whatsapp:+591…` → `591…`)
- [x] Identificación del remitente: usuario, trabajador, cliente o desconocido
- [x] Comandos de consentimiento ALTA / BAJA (usuario, trabajador y cliente)
- [x] Intenciones nuevas con confirmación SI/NO: cosecha, tarea hecha, pedido de cliente
- [x] Consultas: labores pendientes, aplicaciones y carencia de un lote (solo lo registrado), stock, ventas día/semana/mes, cuentas por cobrar, precios, mis tareas
- [x] Políticas por perfil (trabajador y cliente limitados) y derivación de preguntas agronómicas
- [x] Carencia también por WhatsApp y en ventas (409)
- [x] Alertas automáticas diarias (setInterval, hora configurable) + botón "Enviar ahora" + bitácora
- [x] Guías `codigo/docs/WHATSAPP_TWILIO.md` y `WHATSAPP_META.md` (cloudflared, ngrok y Render)
- [x] Correcciones: prompt del LLM usaba "parcela", webhook revisaba un módulo inexistente, permisos del frontend sin `tareas:*`
- [x] 167 pruebas backend ✅ (vector oficial de firma de Twilio incluido), 11 frontend ✅, build OK

### BLOQUE 6 - Seed completo y pantallas faltantes (sprint-3) ✅
- [x] Seed determinista con historia para la demo: labor por WhatsApp → cosecha L-02 → QR → inventario → venta
- [x] Lote con carencia vigente (L-05) y lote que sale de carencia mañana (L-04); todas las cosechas previas respetan la carencia
- [x] Clientes con/sin consentimiento; pedido recibido por WhatsApp
- [x] Ventas con cobros completos, parciales y vencidos; stock bajo en frutilla y AgroProtect
- [x] Labores programadas para hoy, atrasadas y próximas (alertas)
- [x] Fechas del seed y del agente en hora local de Bolivia
- [x] Inventarios (M4): insumos + productos cosechados + movimientos (API de productos pasa a M4)
- [x] Menú según rol y módulos activos; barra inferior móvil priorizada por rol
- [x] Cola offline: tareas hechas y cosechas
- [x] Corrige: modal de carencia nunca se mostraba (error HTTP mal leído), etiquetas de módulos antiguas
- [x] Demo verificada de punta a punta contra el servidor (10/10 pasos)
- [x] 167 pruebas backend ✅, 11 frontend ✅, build OK

### BLOQUE 7 - M6 Vivero y M7 Reportes/Finanzas (sprint-3) ✅
- [x] Modelo `LotePlantin` (siembra, germinadas, % germinación, merma, stock disponible, precio, costo)
- [x] Venta de plantines a través de M5 (valida disponibles, actualiza vendidos/etapa)
- [x] ViveroView.vue (KPI, avance, venta)
- [x] Aplicación descuenta el insumo usado del inventario (`Aplicacion.insumoId`)
- [x] Costo por lote = labores + jornales + insumos valorizados; ingresos por ventas; margen y margen %; costo por kg
- [x] Filtros por campaña y fechas
- [x] Gráficos Chart.js (ingresos vs costos, composición del costo) con paleta validada
- [x] Exportación a CSV (UI y `/api/reportes/costos.csv`)
- [x] ReportesView.vue con fórmulas visibles
- [x] Corrige: lotes no aparecían en el mapa ni en el formulario de labores (`activo` vs `activa`)
- [x] 182 pruebas backend ✅, 14 frontend ✅, build OK; M6/M7 verificados contra el servidor

### BLOQUE 8 - Calidad y pruebas (sprint-3) ✅
- [x] Pruebas del backend migradas a Vitest
- [x] Cobertura con @vitest/coverage-v8: 96 % de líneas (umbrales en `vitest.config.js`: ≥ 85 % global, ≥ 90-95 % crítico)
- [x] Pruebas de API con supertest sobre `prisma/test.db` creada y cargada automáticamente
- [x] Pruebas de RBAC, módulos, carencia, ventas, trazabilidad, tareas, webhooks (firma válida e inválida), vivero, reportes y agente
- [x] Casos UAT con "Don Hilario, encargado de Finca Los Molles" (`evidencias/pruebas/casos_uat.md`)
- [x] `plan_de_pruebas.csv` actualizado (unitarias, API, UAT, manuales)
- [x] `reporte_defectos.csv` con 32 defectos (18 nuevos encontrados por las pruebas y la revisión)
- [x] `metricas.md` + `metricas.png` generados por script a partir de la cobertura real
- [x] CI en `.github/workflows/ci.yml` (raíz del repo) con cobertura y build
- [x] Corrige: dosis con nombre comercial no bloqueada (crítico), "tarea hecha 12", detalle de venta 500, destino con nombre del cliente en el QR
- [x] 247 pruebas backend ✅, 14 frontend ✅

### BLOQUE 9 - Documentación final y entregables (main) ✅
- [x] README.md actualizado (módulos, roles, arranque en Windows, demo, WhatsApp, pruebas)
- [x] LEEME.txt con integrante, roles, usuarios, arranque y WhatsApp
- [x] Swagger 100 %: 66 rutas, verificado por prueba automática (`tests/unit/swagger.test.js`)
- [x] Informe fuente HTML en `informe/fuente/` + PDF generado por script (Chrome headless)
- [x] Consultas SQL clave en `codigo/backend/prisma/consultas_clave.sql` (verificadas contra la BD)
- [x] Diagramas regenerados por script: arquitectura, ER, flujo del agente, flujo de la demo
- [x] PPTX de 14 láminas con notas del orador para un expositor y lámina de aprendizajes (fuente pptxgenjs)
- [x] Evidencias SCRUM: Sprint 0, backlog importable, sprint backlogs 1–3, dailies, reviews, retrospectivas, burndowns, velocidad
- [x] Guion de exposición 8–10 min con la demo paso a paso
- [x] 249 pruebas backend ✅ (96 % de líneas), 14 frontend ✅

### BLOQUE 10 - Despliegue y cierre (main) ✅
- [x] `render.yaml` movido a la raíz del repositorio (Render lo busca ahí) con variables de WhatsApp, Twilio y alertas
- [x] `vercel.json` revisado (Root Directory `codigo/frontend`, reescrituras de la SPA)
- [x] `codigo/docs/DESPLIEGUE.md` paso a paso (GitHub, Render, Vercel, Twilio, CI, verificación, costos)
- [x] API probada en modo producción (`NODE_ENV=production`)
- [x] Checklist de la guía marcado con evidencias: `evidencias/checklist_guia.md`
- [x] ZIP de entrega generado con `git archive` (sin node_modules, .env ni *.db)

### FASE FINAL - Preparación para presentar (main)
- [x] PASO 1 · Datos reales: grupo Los Pasankallas, Beymar Emilio Poma Queso (trabajo individual), asignatura, docente e hito en LEEME, README, CONTRIBUIR, informe, diapositivas, SCRUM, guion y checklist
- [x] PASO 1 · Informe §8.1 "Adaptación de SCRUM a un equipo de una persona"; notas del orador y guion para un expositor
- [x] PASO 1 · Archivos renombrados: `Informe_Grupo_LosPasankallas.pdf`, `Diapositivas_Grupo_LosPasankallas.pptx`
- [x] PASO 1 · Celular real del encargado solo en `.env` (`DEMO_WHATSAPP_ENCARGADO`, ADR-021)
- [x] PASO 2 · Verificación local: `db push --force-reset` + seed con el celular del encargado, /api/salud y /api/docs OK, build OK, 249 + 14 pruebas en verde, flujo de la demo por API OK (labor con SI → cosecha → QR → inventario → venta → ficha con la venta), servidor detenido por PID
- [x] PASO 3 · Cambio a Meta WhatsApp Cloud API (Twilio no envía SMS de verificación a Bolivia, ADR-022): firma obligatoria en producción, Graph API configurable (v25.0), registro en consola, documentación actualizada
- [x] PASO 3 · Celular de Beymar conectado al número de prueba de Meta (26/11/2026, túnel cloudflared): "ayuda" respondido, cosecha de 40 kg de tomate del L-02 + SI → lote FLM-2026-0007, alerta manual entregada al encargado (10 avisos). La app se suscribió a la WABA con POST /subscribed_apps. Los destinatarios ficticios fallan con #131030 (número no verificado), como se espera
- [ ] PASO 3 · Antes de la exposición: renovar el token temporal (24 h) o crear un token permanente de usuario del sistema
- [ ] PASO 4 · GitHub, Render y Vercel; URLs públicas en los documentos
- [ ] PASO 5 · Capturas reales, tablero Trello/Jira, registro SCRUM
- [ ] PASO 6 · ZIP final `CRM_Agro_Grupo_LosPasankallas.zip`

## 📋 PENDIENTE (requiere cuentas o datos de Beymar)

- [ ] Conectar el celular al número de prueba de Meta (`codigo/docs/WHATSAPP_META.md`) y ejecutar CP-MAN-03 / UAT-01 a 06 con el celular real
- [ ] Subir a GitHub y desplegar en Render y Vercel; anotar las URL públicas
- [ ] Importar `evidencias/scrum/product_backlog.csv` en Trello o Jira y guardar una captura del tablero
- [ ] ✏️ Completar las fechas del registro diario, las horas de los sprint backlogs, las observaciones del PO y el avance diario real de los burndowns (`evidencias/scrum/fuente/generar_scrum.mjs`)
- [ ] Capturas reales de la app desplegada en `evidencias/capturas/` y pruebas manuales CP-MAN-01, 02 y 04

## ⚠️ BLOQUEADORES

Ninguno técnico. Los pendientes de arriba dependen de cuentas externas (GitHub, Render, Vercel, Twilio, Jira) o de datos que no deben inventarse.

## 📝 NOTAS

- Los datos son 100 % ficticios y deben permanecer así.
- El agente NUNCA recomienda dosis, productos ni mezclas, y siempre pide confirmación SI/NO antes de guardar.
- Todas las pruebas deben estar en verde antes de cada commit (`npm test` en backend y frontend).
- Para liberar un puerto usar el PID exacto (`netstat -ano | findstr :3000` → `taskkill /PID <n> /F`), nunca `taskkill /IM node.exe`.
