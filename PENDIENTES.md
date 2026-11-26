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

## 📋 PENDIENTE

### BLOQUE 7 - M6 Vivero y M7 Reportes/Finanzas (sprint-3)
- [ ] Modelo `LotePlantin` (siembra, germinación, stock, precio)
- [ ] Venta de plantines a través de M5
- [ ] ViveroView.vue
- [ ] Cálculo costos por lote (labores + jornales + insumos)
- [ ] Cálculo ingresos y márgenes
- [ ] Filtros por campaña y fechas
- [ ] Gráficos Chart.js
- [ ] Exportación a CSV
- [ ] ReportesView.vue
- [ ] Explicación de fórmulas en informe

### BLOQUE 8 - Calidad y pruebas (sprint-3)
- [ ] Migrar pruebas backend a Vitest
- [ ] Cobertura con @vitest/coverage-v8 (meta ≥80% global, ≥90% crítico)
- [ ] Pruebas de API con supertest + BD de prueba
- [ ] Pruebas de RBAC, módulos, carencia, ventas, trazabilidad, webhooks
- [ ] Casos UAT con "Don Hilario, encargado de Finca Los Molles"
- [ ] Archivo `evidencias/pruebas/casos_uat.md`
- [ ] Actualizar `plan_de_pruebas.csv`
- [ ] Actualizar `reporte_defectos.csv`
- [ ] Archivo `evidencias/pruebas/metricas.md` con gráfico PNG
- [ ] Actualizar CI `.github/workflows/ci.yml`

### BLOQUE 9 - Documentación final y entregables (main)
- [ ] README.md actualizado con nueva nomenclatura
- [ ] LEEME.txt con integrantes, roles por sprint, usuarios
- [ ] Swagger 100% completo
- [ ] Informe fuente en `informe/fuente/` (Markdown o HTML)
- [ ] Informe PDF generado automáticamente
- [ ] Diagramas actualizados (arquitectura, ER, flujos)
- [ ] Diapositivas fuente con pptxgenjs
- [ ] PPTX 12-15 láminas con notas del orador
- [ ] Evidencias SCRUM:
  - [ ] Sprint 0: entrevista, historias, modelo ER
  - [ ] Sprint backlogs 1-3
  - [ ] Notas de daily (plantilla + ejemplos)
  - [ ] Reviews y retrospectivas
  - [ ] Burndowns actualizados
- [ ] Guión de exposición 8-10 min
- [ ] Lista de verificación final
- [ ] ZIP final sin node_modules, .env, *.db

## ⚠️ BLOQUEADORES

Ninguno por el momento.

## 📝 NOTAS

- Los módulos M5 (Ventas), M6 (Vivero) y M7 (Reportes) están comentados en router.js y App.vue hasta su implementación en bloques posteriores.
- Los datos son 100% ficticios y deben permanecer así.
- El agente NUNCA recomienda dosis, productos ni mezclas.
- Siempre pide confirmación SI/NO antes de guardar.
- Todas las pruebas deben estar en verde antes de cada commit.
