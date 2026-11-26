# Registro de Decisiones Técnicas (ADR)

Este documento registra las decisiones técnicas importantes tomadas durante el desarrollo del proyecto CRM-Agro, siguiendo el formato Architecture Decision Records (ADR).

---

## ADR-001: Renumeración de módulos según guía del ingeniero

**Fecha**: 2026-11-25
**Estado**: Aceptada
**Decisión tomada por**: Equipo de desarrollo

### Contexto

El proyecto inicial tenía una numeración de módulos diferente a la especificada en la guía del ingeniero. Era necesario renumerar para cumplir con los requisitos exactos del proyecto.

### Decisión

Se renumeran los módulos de la siguiente manera:

| Anterior | Nuevo | Nombre |
|----------|-------|--------|
| M0 | M0 | Núcleo (sin cambios) |
| M1 | (eliminado) | Parcelas → integrado en M0 como "Lotes" |
| M2 | M1 | Control técnico de campo |
| M3 | M2 | Trazabilidad |
| M4 | M3 | Trabajadores |
| M5 | (capacidad transversal) | WhatsApp + agente IA |
| M6 | M4 | Inventarios |
| - | M5 | Ventas y clientes (nuevo) |
| - | M6 | Vivero (nuevo) |
| - | M7 | Reportes y finanzas (nuevo) |

### Consecuencias

- ✅ Cumplimiento exacto con la guía del ingeniero
- ✅ Mejor organización modular
- ⚠️ Requiere actualizar: BD, API, frontend, Swagger, documentación, pruebas y seed
- ⚠️ Se debe hacer en una sola fase para evitar inconsistencias

---

## ADR-002: "Parcela" vs "Lote" - terminología

**Fecha**: 2026-11-25
**Estado**: Aceptada

### Contexto

La guía del ingeniero usa el término "lote" para referirse a las divisiones de campo (antes llamadas "parcelas"), pero también existe el "lote de cosecha" para trazabilidad. Esto genera ambigüedad.

### Decisión

- **Lote de campo** (o simplemente "lote"): división física de la finca donde se cultiva (tabla `Lote`, antes `Parcela`)
- **Lote de cosecha**: código QR de trazabilidad de un producto cosechado (tabla `LoteCosecha`, sin cambios)

En la interfaz y documentación, cuando el contexto es claro, se usa "lote". Cuando puede haber confusión, se especifica "lote de campo" o "lote de cosecha".

### Consecuencias

- ✅ Alineación con la terminología de la guía
- ✅ Distinción clara entre dos conceptos diferentes
- ⚠️ Requiere renombrar `Parcela` → `Lote` en todo el código

---

## ADR-003: Tabla ModuloFinca vs JSON modulosActivos

**Fecha**: 2026-11-25
**Estado**: Aceptada

### Contexto

El sistema actual guarda los módulos activos como un JSON en el campo `modulosActivos` de la tabla `Finca`. La guía sugiere una tabla separada para activación de módulos.

### Decisión

Crear tabla `ModuloFinca` con:
- `fincaId` (FK a Finca)
- `codigo` (ej: "M1", "M2", etc.)
- `activo` (boolean)

Esto permite:
- Consultas SQL más eficientes
- Validación de datos más estricta
- Histórico de activación/desactivación (si se agrega `fechaActivacion`)
- Configuración adicional por módulo (ej: límites, precios)

### Consecuencias

- ✅ Mejor normalización de la BD
- ✅ Más flexible para futuras extensiones
- ⚠️ Requiere migración del campo JSON actual
- ⚠️ Cambios en el middleware `requiereModulo()`

---

## ADR-004: WhatsApp como capacidad transversal, no como módulo

**Fecha**: 2026-11-25
**Estado**: Aceptada

### Contexto

En la numeración antigua, WhatsApp + agente era el módulo M5. En la nueva numeración, M5 es "Ventas y clientes". WhatsApp/agente es usado por múltiples módulos (campo, trabajadores, ventas, inventarios).

### Decisión

WhatsApp + agente de IA se convierte en una **capacidad transversal** activable a nivel de finca mediante un campo booleano `whatsappActivo` en la tabla `Finca`, en lugar de ser un módulo independiente.

Alternativamente, se puede mantener como "submódulo" de M0 (Núcleo) si se requiere que aparezca en la lista de módulos para efectos de presentación.

**Decisión final**: Campo `whatsappActivo` en `Finca` + documentar como capacidad transversal.

### Consecuencias

- ✅ Refleja mejor la arquitectura real (es infraestructura, no funcionalidad de negocio)
- ✅ Simplifica la gestión de dependencias entre módulos
- ⚠️ Cambiar la UI de configuración de módulos
- ⚠️ Actualizar documentación y diagramas

---

## ADR-005: Siembra vs Campaña

**Fecha**: 2026-11-25
**Estado**: Aceptada

### Contexto

La guía menciona "campaña" como un ciclo de cultivo de un lote. El modelo actual tiene `Siembra` que cumple ese rol.

### Decisión

Renombrar `Siembra` → `Campania` (sin tilde por convención de código).

Una **campaña** representa un ciclo completo de cultivo en un lote: desde la siembra hasta la cosecha final, con todas las labores asociadas.

### Consecuencias

- ✅ Alineación con terminología agronómica estándar
- ✅ Nombre más semántico
- ⚠️ Renombrar en BD, API, frontend, pruebas

---

## ADR-006: Roles nuevos según guía

**Fecha**: 2026-11-25
**Estado**: Aceptada

### Contexto

Roles actuales: ADMIN, TECNICO, SUPERVISOR, CONSULTA.
Roles según guía: PROPIETARIO, ENCARGADO, TRABAJADOR.

### Decisión

Mapeo de roles:

| Anterior | Nuevo | Responsabilidades |
|----------|-------|-------------------|
| ADMIN | PROPIETARIO | Todo: configuración, usuarios, módulos, finanzas, pagos |
| TECNICO | ENCARGADO | Campo, trazabilidad, inventarios, ventas, trabajadores, aplicaciones fitosanitarias |
| SUPERVISOR | (eliminar o mapear a ENCARGADO) | - |
| CONSULTA | (eliminar o mantener como lectura) | Solo lectura |
| - | TRABAJADOR | Ve sus tareas, registra labores simples, marca tareas completadas |

**Decisión final**:
- PROPIETARIO (antes ADMIN)
- ENCARGADO (antes TECNICO)
- TRABAJADOR (nuevo)
- Eliminar SUPERVISOR y CONSULTA (o mantener CONSULTA si se necesita un rol de auditor/visitante)

### Consecuencias

- ✅ Alineación con la guía
- ✅ Roles más claros y específicos del dominio agrícola
- ⚠️ Actualizar `src/utils/permisos.js`
- ⚠️ Actualizar pruebas de RBAC
- ⚠️ Migrar usuarios del seed

---

## ADR-007: Usuario trabajador vinculado a Trabajador

**Fecha**: 2026-11-25
**Estado**: Aceptada

### Contexto

Los trabajadores de campo necesitan acceder al sistema para ver sus tareas y registrar labores, pero actualmente `Trabajador` y `Usuario` son entidades separadas.

### Decisión

Agregar campo opcional `trabajadorId` en la tabla `Usuario`. Cuando un usuario tiene rol TRABAJADOR y está vinculado a un `Trabajador`:
- Ve solo "sus tareas" (asignadas a ese trabajador)
- Puede registrar su asistencia
- Puede marcar tareas como completadas
- **NO** ve datos financieros ni pagos de otros

### Consecuencias

- ✅ Permite acceso móvil para trabajadores de campo
- ✅ Simplicidad (no requiere autenticación compleja por WhatsApp)
- ⚠️ Agregar campo `trabajadorId` en `Usuario` (nullable)
- ⚠️ Actualizar vistas de tareas para filtrar por trabajador

---

## ADR-008: Vitest en lugar de node:test para el backend

**Fecha**: 2026-11-25
**Estado**: Aceptada

### Contexto

Las pruebas actuales del backend usan `node:test` (nativo de Node.js). La guía pide "Jest o Vitest" y el frontend ya usa Vitest.

### Decisión

Migrar las pruebas del backend de `node:test` a **Vitest** para:
- Cumplir con la guía
- Unificar el framework de pruebas en todo el proyecto
- Aprovechar las funcionalidades avanzadas de Vitest (UI, coverage, watch mode)
- Mejor integración con el ecosistema de Vite

### Consecuencias

- ✅ Cumplimiento de la guía
- ✅ Un solo framework de pruebas para todo el proyecto
- ✅ Mejor DX (developer experience)
- ⚠️ Requiere migración de las 91 pruebas existentes
- ⚠️ Instalar dependencias de Vitest en el backend
- ⚠️ Actualizar scripts en `package.json`

---

## ADR-013: Estrategia de migración limpia sin alias ni compatibilidad

**Fecha**: 2026-11-25
**Estado**: Aceptada
**Decisión tomada por**: Cliente/Product Owner

### Contexto

Al renumerar módulos y renombrar entidades (Parcela→Lote, Siembra→Campaña, roles), se planteó mantener alias de compatibilidad (ej: `ADMIN: 'PROPIETARIO'`, rutas `/api/parcelas` redirigiendo a `/api/lotes`).

### Decisión

**Cambio limpio sin alias**:
- NO mantener constantes antiguas (`ADMIN`, `TECNICO`, etc.)
- NO crear rutas de compatibilidad (`/api/parcelas`)
- Actualizar todo en un solo paso: backend, frontend, pruebas, Swagger, documentación
- Reiniciar la BD (`npx prisma db push --force-reset`) en lugar de migrar datos (son ficticios)

### Consecuencias

- ✅ Código más limpio sin deuda técnica
- ✅ No hay confusión sobre qué nombres usar
- ✅ Más fácil de entender para nuevos desarrolladores
- ⚠️ Requiere más cuidado en la migración (todo debe cambiar al mismo tiempo)
- ⚠️ No hay rollback fácil (aceptable porque es proyecto académico con datos ficticios)

---

## ADR-014: Funciones puras en utils/permisos.js sin dependencia de Prisma

**Fecha**: 2026-11-25
**Estado**: Aceptada

### Contexto

La tabla `ModuloFinca` requiere lectura de BD. Se planteó poner funciones async con Prisma en `utils/permisos.js`.

### Decisión

**Mantener `utils/permisos.js` como funciones puras**:
- `modulosDe(finca)` recibe el objeto finca con sus módulos ya cargados
- `tieneModulo(finca, codigo)` es función pura
- La lectura de `ModuloFinca` se hace en:
  - Middleware `requiereModulo()` (con `include` en Prisma)
  - Rutas que necesiten verificar módulos
  - El objeto finca incluye `finca.modulos` poblado

Ventajas:
- Las pruebas unitarias no requieren BD
- Más rápido (funciones síncronas)
- Separación de responsabilidades clara

### Consecuencias

- ✅ Pruebas unitarias sin BD (más rápidas)
- ✅ Funciones testables sin mocks
- ⚠️ Los controladores deben hacer `include: { modulos: true }` al cargar finca
- ⚠️ Documentar claramente el contrato de las funciones

---

## ADR-015: Permisos del rol TRABAJADOR en el agente

**Fecha**: 2026-11-25
**Estado**: Aceptada

### Contexto

El nuevo rol TRABAJADOR debe poder usar el agente por WhatsApp, pero con permisos limitados.

### Decisión

**TRABAJADOR puede usar el agente** (`'agente:usar'` incluye TRABAJADOR) pero con restricciones:

**Permitido**:
- Marcar sus tareas asignadas como completadas
- Registrar labores simples (riego, deshierbe) en lotes asignados
- Registrar observaciones fitosanitarias (plagas/enfermedades)
- Registrar su propia asistencia
- Consultar sus pendientes y tareas

**Prohibido**:
- Registrar aplicaciones fitosanitarias (solo ENCARGADO/PROPIETARIO)
- Crear/modificar campañas
- Acceder a datos de ventas o finanzas
- Ver pagos de otros trabajadores
- Modificar inventarios (solo consultar stock)

La validación se hace en `src/agente/repositorio.js` verificando el rol antes de ejecutar acciones.

### Consecuencias

- ✅ Trabajadores de campo pueden reportar desde su celular
- ✅ Control granular de qué puede hacer cada rol
- ⚠️ Requiere agregar validación de rol en cada función del repositorio
- ⚠️ Pruebas de RBAC del agente más complejas

---

## ADR-016: Distinción clara "Lote" vs "Lote de cosecha (QR)" en UI

**Fecha**: 2026-11-25
**Estado**: Aceptada

### Contexto

Renombrar `Parcela` → `Lote` puede generar confusión con `LoteCosecha` (código QR de trazabilidad).

### Decisión

**En la interfaz de usuario**:
- **"Lote"** o **"Lote de campo"**: división física donde se cultiva (menú, vistas, formularios)
- **"Lote de cosecha"** o **"QR"**: código de trazabilidad de producto cosechado

**En el código**:
- Tabla `Lote` (antes `Parcela`)
- Tabla `LoteCosecha` (sin cambios)

**En URLs y rutas**:
- `/lotes` → gestión de lotes de campo
- `/trazabilidad` → lotes de cosecha con QR

### Consecuencias

- ✅ Claridad en la UI para el usuario final
- ✅ No hay ambigüedad en formularios ni mensajes
- ⚠️ Requiere revisar todos los textos de la UI
- ⚠️ Documentar en el glosario del informe

---

## ADR-009: Abstracción de proveedores de WhatsApp

**Fecha**: 2026-11-25
**Estado**: Aceptada

### Contexto

El sistema actual soporta Meta Cloud API. La guía permite usar **Twilio Sandbox** como alternativa más simple para comenzar. Se recomienda Twilio en las instrucciones.

### Decisión

Crear una abstracción de proveedor de WhatsApp con variable de entorno `WHATSAPP_PROVIDER`:
- `meta`: Meta Cloud API (actual)
- `twilio`: Twilio API (Sandbox para desarrollo, API completa para producción)
- `simulado`: Sin credenciales, solo para pruebas locales

Implementar adaptadores en `src/services/whatsapp.js` que normalicen:
- Formato de números (`whatsapp:+591...` en Twilio vs `591...` en Meta)
- Validación de webhooks (firma HMAC en Meta vs `X-Twilio-Signature`)
- Envío de mensajes (TwiML vs REST API de Meta)

### Consecuencias

- ✅ Flexibilidad para elegir proveedor
- ✅ Facilita testing (modo simulado)
- ✅ Permite migración futura entre proveedores
- ⚠️ Requiere refactorización de `src/services/whatsapp.js`
- ⚠️ Documentar configuración de cada proveedor

---

## ADR-010: Período de carencia y bloqueo de cosecha/venta

**Fecha**: 2026-11-25
**Estado**: Aceptada

### Contexto

La guía requiere **respeto del período de carencia**: no permitir cosechar ni vender productos de un lote que está en carencia por una aplicación fitosanitaria reciente.

### Decisión

1. **Registro de aplicaciones** incluye `periodoCarenciaDias` (obligatorio si es agroquímico)
2. **Cálculo automático** de fecha de fin de carencia: `fechaAplicacion + periodoCarenciaDias`
3. **Validación en API**:
   - `POST /api/campo/labores` con tipo COSECHA → verificar que el lote no esté en carencia
   - `POST /api/ventas` → verificar que los lotes de los productos no estén en carencia
   - Si está en carencia: **HTTP 409 Conflict** con mensaje explicativo
4. **Override solo para PROPIETARIO**: con justificación (guardada en auditoría) y advertencia clara

### Consecuencias

- ✅ Cumple requisito de seguridad alimentaria
- ✅ Protege al productor de sanciones
- ✅ Auditoría de excepciones
- ⚠️ Requiere endpoint de consulta de "lotes en carencia"
- ⚠️ Pruebas automatizadas obligatorias de este flujo

---

## ADR-011: Consentimiento para WhatsApp (GDPR/protección de datos)

**Fecha**: 2026-11-25
**Estado**: Aceptada

### Contexto

La guía menciona **consentimiento de trabajadores y clientes** para el uso de WhatsApp. Es un requisito ético y legal (RGPD/GDPR si se exporta, Ley 164 de Telecomunicaciones en Bolivia).

### Decisión

1. Agregar campos en `Trabajador` y `Cliente`:
   - `consentimientoWhatsapp` (boolean, default false)
   - `fechaConsentimiento` (DateTime, nullable)

2. **Nunca enviar mensajes automáticos** (alertas, notificaciones) a números que no hayan dado consentimiento

3. **Comandos por WhatsApp**:
   - `ALTA` → activa consentimiento y registra fecha
   - `BAJA` → desactiva consentimiento

4. **UI**: checkbox al crear/editar trabajador o cliente, con texto legal claro

### Consecuencias

- ✅ Cumple con protección de datos
- ✅ Transparencia y ética
- ⚠️ Cambios en BD (2 campos por tabla)
- ⚠️ Filtrar destinatarios de alertas automáticas
- ⚠️ Documentar en el informe (sección Seguridad y Ética)

---

## ADR-012: M6 Vivero y M7 Reportes como módulos opcionales implementados

**Fecha**: 2026-11-25
**Estado**: Aceptada

### Contexto

La rúbrica exige M0-M5 + al menos un módulo opcional. La guía menciona vivero y análisis financiero. Estos aparecen en la imagen oficial del proyecto.

### Decisión

Implementar **ambos módulos opcionales**:
- **M6 Vivero**: producción de plantines (siembra, germinación, stock, venta)
- **M7 Reportes y finanzas**: costos por lote, ingresos, márgenes, gráficos, exportación

Esto permite:
- Superar el mínimo (solo 1 opcional)
- Demostrar más funcionalidades
- Cubrir el caso de uso completo de fincas con vivero (mencionado en la guía)

### Consecuencias

- ✅ Proyecto más completo y destacado
- ✅ Demuestra capacidad técnica
- ⚠️ Más trabajo de implementación (justificado por el impacto)
- ⚠️ Más pruebas y documentación

---

## ADR-017: Decisiones de implementación de los bloques 2 a 4

**Fecha**: 2026-11-25
**Estado**: Aceptada
**Decisión tomada por**: Equipo de desarrollo

### Contexto

Durante la implementación aparecieron detalles que la guía no fija. Se eligió en cada caso la opción más simple que la cumple.

### Decisión

| # | Bloque | Decisión | Motivo |
|---|---|---|---|
| 17.1 | 2 | Carencia: la API responde **409** al cosechar un lote en carencia. Solo PROPIETARIO puede forzar con `?forzar=true` + justificación (≥ 10 caracteres), que queda en auditoría. | Seguridad alimentaria (ADR-010). |
| 17.2 | 2 | La "dosis" solo existe como `dosisEtiqueta`: texto copiado de la etiqueta por el encargado. El agente nunca la calcula ni la recomienda. | Regla de oro del agente (la guía tiene una errata en "Restricciones"). |
| 17.3 | 3 | Vencimiento de cuentas por cobrar = fecha de venta + 7 días (estado `VENCIDO`). No se agregó plazo por cliente. | Suficiente para alertas y reportes. |
| 17.4 | 4 | `/api/lotes` pertenece a M0 (siempre activo), no a M1. | En la guía, lotes y cultivos son parte del Núcleo. |
| 17.5 | 4 | El `trabajadorId` del usuario se lee de la BD en cada petición de tareas (no va en el JWT). | Si cambia el vínculo no hay que volver a iniciar sesión. |
| 17.6 | 4 | Tareas: `PENDIENTE → EN_CURSO → COMPLETADA`; `CANCELADA` solo desde activas. Se puede completar directo desde `PENDIENTE`. | Menos toques en el celular. |
| 17.7 | 4 | Ficha pública del QR: ventas anonimizadas (solo tipo de cliente, fecha y cantidad). Nunca nombres, teléfonos, precios ni responsables técnicos. | Protección de datos (ADR-011). |
| 17.8 | 4 | Las consultas SQL de trazabilidad viven en `src/services/trazabilidad.js`, se ejecutan de verdad con parámetro enlazado (`?`) en `GET /api/publico/lotes/:token/sql` y son las mismas del informe. | La consulta documentada es real y no admite inyección. |
| 17.9 | 4 | Registrar una cosecha crea la ENTRADA en el inventario de productos (por clave de cultivo, p. ej. "Pimentón" → `PIMENTON`); si el producto no existe, se crea. La calidad DESCARTE no entra a stock. | Flujo de la demo: cosecha → inventario → venta. |
| 17.10 | 4 | No se agregó rol AGRONOMO. | Opcional en la guía; tres roles bastan. |

### Consecuencias

- ✅ Comportamiento predecible y probado (pruebas en `tests/unit/tareas.test.js` y `carencia.test.js`)
- ⚠️ El plazo fijo de 7 días puede no reflejar acuerdos reales con cada cliente

---

## ADR-018: WhatsApp real, perfiles del agente y alertas (bloque 5)

**Fecha**: 2026-11-25
**Estado**: Aceptada
**Decisión tomada por**: Equipo de desarrollo

### Contexto

La guía pide WhatsApp real (Twilio Sandbox o Meta), registrar labores y cosechas con mensajes simples, consultas, alertas y pedidos de clientes con consentimiento.

### Decisión

| # | Decisión | Motivo |
|---|---|---|
| 18.1 | `WHATSAPP_PROVIDER=twilio\|meta\|simulado`. Si faltan credenciales del proveedor elegido se usa `simulado` (todo queda en la bitácora). | La app funciona igual sin cuentas. |
| 18.2 | Twilio responde con **TwiML** en la misma petición; los avisos proactivos (alertas, tareas, pedidos) usan la API REST. | Las respuestas no dependen de la ventana de 24 h ni de credenciales REST. |
| 18.3 | La firma `X-Twilio-Signature` se valida con `TWILIO_WEBHOOK_URL` (URL exacta configurada en Twilio). En producción la validación es obligatoria. | Detrás de túneles/proxies la URL reconstruida puede no coincidir. |
| 18.4 | Remitente: usuario → perfil de su rol; trabajador sin usuario → perfil TRABAJADOR; cliente → perfil CLIENTE (solo con consentimiento); desconocido → mensaje de registro. | Lo pide la guía. |
| 18.5 | `ALTA`/`BAJA` (también "acepto"/"stop") cambian el consentimiento de usuario, trabajador y cliente con ese número. `Usuario` también tiene `consentimientoWhatsapp`. | Nunca enviar alertas a quien no aceptó (ADR-011). |
| 18.6 | Políticas por perfil en `agente/politicas.js` (funciones puras): el trabajador no registra aplicaciones, cosechas ni asistencia, ni consulta ventas; el cliente solo pide y ve precios. | ADR-015. |
| 18.7 | El ejecutor tiene un paso `preparar` antes de pedir SI/NO: valida lote, **carencia** (también por WhatsApp, sin opción de forzar), resuelve la tarea y el producto/precio del pedido. | El usuario no confirma algo que luego fallará. |
| 18.8 | "¿Qué dosis se aplicó…?" (pasado/registro) es una consulta y muestra la *dosis de etiqueta registrada* tal cual; "¿qué dosis le echo…?" sigue bloqueado. Preguntas de diagnóstico se derivan al ingeniero agrónomo. | Punto 5 de la guía. |
| 18.9 | Alertas con `setInterval` (cada minuto compara la hora local de Bolivia con `Finca.horaAlertas`), una vez por día; botón "Enviar ahora" para la demo; bitácora `BitacoraAlerta`. | Sin dependencias nuevas (la guía acepta node-cron o setInterval). |
| 18.10 | Fechas de los mensajes en hora local de Bolivia (UTC-4). | A las 21:00 locales sigue siendo "hoy". |
| 18.11 | Venta de un lote de cosecha cosechado dentro de su carencia → 409 (PROPIETARIO puede forzar con justificación). Solo cuentan aplicaciones anteriores a la cosecha. | ADR-010. |
| 18.12 | `/api/agente` y `/api/alertas` no dependen de un módulo (capacidad transversal). | ADR-004. |

### Consecuencias

- ✅ Mismo agente para web, Twilio, Meta y simulador
- ⚠️ Twilio Sandbox: los avisos proactivos solo llegan dentro de las 24 h siguientes al último mensaje del usuario

---

## ADR-019: Vivero (M6) y fórmulas de finanzas (M7)

**Fecha**: 2026-11-25
**Estado**: Aceptada
**Decisión tomada por**: Equipo de desarrollo

### Decisión

| # | Decisión | Motivo |
|---|---|---|
| 19.1 | `LotePlantin` guarda sembradas, germinadas, merma y vendidos; **disponibles = germinadas − merma − vendidos** se calcula (no se guarda). Código `VIV-AAAA-NN`. | Evita inconsistencias de stock. |
| 19.2 | La venta de plantines usa la misma API de M5 (`DetalleVenta.lotePlantinId`): valida disponibles, suma `vendidos` y pasa el lote a AGOTADO si se acaba. | "Venta de plantines a través de M5". |
| 19.3 | `Aplicacion.insumoId` opcional: al registrar una aplicación con insumo (o con el mismo nombre de un insumo) se descuenta el stock si la unidad coincide y alcanza. | La guía: "una aplicación puede descontar el insumo usado". |
| 19.4 | Costo del lote = labores (`costoBs` = gastos directos) + jornales (horas/8 × jornal, solo asistencias con lote) + insumos (cantidad × costo unitario). Ingresos = ventas de sus lotes de cosecha. Margen % = margen / ingresos. | Fórmulas simples y explicables; el informe las detalla. |
| 19.5 | Las asistencias sin lote (galpón, vivero) y las ventas sin lote de cosecha no se cargan a ningún lote: aparecen aparte en los totales. El vivero se reporta separado. | No inventar prorrateos. |
| 19.6 | M7 solo para PROPIETARIO (`finanzas:ver`). Exportación CSV con `;` y BOM para Excel en español (backend `/costos.csv` y botón en la UI). | La guía reserva las finanzas al propietario. |
| 19.7 | Colores de los gráficos validados con el validador de daltonismo (azul `#1F78B4`, naranja `#C8823A`, violeta `#8E5FC2`); siempre con leyenda. | Accesibilidad. |

---

## ADR-020: Estrategia de pruebas (bloque 8)

**Fecha**: 2026-11-25
**Estado**: Aceptada (complementa ADR-008)

### Decisión

| # | Decisión | Motivo |
|---|---|---|
| 20.1 | Backend 100 % en **Vitest** (`node:assert` se mantiene en las aserciones antiguas; las nuevas usan `expect`). | La guía pide Jest o Vitest; un solo framework en todo el proyecto. |
| 20.2 | Pruebas de API con **supertest** sobre `prisma/test.db`, que `tests/setup/bd-prueba.js` crea desde cero y carga con el seed antes de cada ejecución. Ejecución secuencial (`fileParallelism: false`). | Reproducible en cualquier PC y en el CI, sin tocar `dev.db`. |
| 20.3 | Variables de entorno de prueba fijas en `vitest.config.js` (token de Twilio, secreto de Meta, URL del webhook). | Permite probar firmas válidas e inválidas. |
| 20.4 | Umbrales de cobertura: ≥ 85 % de líneas global; ≥ 95 % en agente/guardrails/parser/políticas y finanzas/trazabilidad; ≥ 90 % en carencia, tareas, vivero y ventas. | Meta de la guía (≥ 80 % global, ≥ 90 % crítico) con margen. |
| 20.5 | Los limitadores de tasa global y del agente se omiten cuando `NODE_ENV=test`. El de login sigue activo. | Las suites hacen cientos de peticiones por minuto. |
| 20.6 | La cobertura del frontend mide `src/utils` (lógica); las vistas se validan con UAT y pruebas manuales. | Probar vistas Vue requeriría otra herramienta (fuera de alcance). |
| 20.7 | El workflow de CI vive en `.github/workflows/ci.yml` en la raíz del repositorio (antes estaba en `codigo/.github`, donde GitHub no lo ejecuta). | Requisito de GitHub Actions. |

---

## Plantilla para nuevas decisiones

```markdown
## ADR-XXX: Título de la decisión

**Fecha**: YYYY-MM-DD
**Estado**: Propuesta | Aceptada | Rechazada | Obsoleta
**Decisión tomada por**: Nombre/Equipo

### Contexto

Descripción del problema o situación que requiere una decisión.

### Decisión

La decisión tomada y sus razones.

### Consecuencias

- ✅ Beneficios
- ⚠️ Riesgos o trabajo adicional
- ❌ Desventajas aceptadas
```

---

**Nota**: Este documento debe actualizarse cada vez que se tome una decisión técnica importante durante el desarrollo del proyecto.
