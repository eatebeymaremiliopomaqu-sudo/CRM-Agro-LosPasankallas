# Registro de decisiones técnicas · CRM-Agro

Cada decisión indica el bloque en que se tomó, la alternativa elegida y por qué.
Criterio general: ante una ambigüedad de la guía, se elige la opción más simple que la cumpla.

| # | Bloque | Decisión | Motivo |
|---|---|---|---|
| D-01 | 1 | Sin script de migración de nomenclatura: la BD se reinicia con `npx prisma db push --force-reset` y se recarga el seed. | Todos los datos son ficticios. |
| D-02 | 1 | Cambio limpio sin alias de roles (ADMIN→PROPIETARIO) ni de rutas (`/api/parcelas`). | Evita doble mantenimiento; lo pidió el equipo. |
| D-03 | 1 | `modulosDe()` / `tieneModulo()` son funciones puras que reciben la finca con sus módulos; la lectura de `ModuloFinca` vive en el middleware `requiereModulo` y en las rutas. | Las pruebas unitarias no dependen de la BD. |
| D-04 | 1 | Activación de módulos en tabla `ModuloFinca(fincaId, codigo, activo)` en lugar de un JSON. | Lo sugiere la guía y permite normalizar (3FN). |
| D-05 | 1 | El agente de WhatsApp NO es un módulo: es una capacidad transversal (campo `Finca.whatsappActivo`). | La numeración oficial M0–M7 no lo incluye. |
| D-06 | 1 | El rol TRABAJADOR puede usar el agente con permisos limitados: marcar sus tareas, registrar labores/observaciones simples y consultar sus pendientes. Nunca aplicaciones fitosanitarias, ventas ni finanzas. | Pedido del equipo; respeta la guía. |
| D-07 | 1 | En la UI siempre se distingue "Lote (de campo)" de "Lote de cosecha (QR)". | Evita confusión entre la parcela física y el producto trazable. |
| D-08 | 1 | No se agregó rol AGRONOMO. | La guía lo deja opcional; tres roles bastan para la demo. |
| D-09 | 2 | Carencia: la API responde **409** al cosechar un lote en carencia. Solo PROPIETARIO puede forzar con `?forzar=true` + justificación (≥10 caracteres) y queda en auditoría. | Requisito de seguridad y ética de la guía. |
| D-10 | 2 | La "dosis" solo existe como `dosisEtiqueta`: texto copiado de la etiqueta por el encargado. El agente nunca la calcula ni recomienda. | Regla de oro del agente (la guía tiene una errata en "Restricciones"). |
| D-11 | 3 | Vencimiento de cuentas por cobrar = fecha de la venta + 7 días (estado `VENCIDO`). No se agregó una columna de plazo por cliente. | Más simple; suficiente para alertas y reportes. |
| D-12 | 4 | Las rutas `/api/lotes` pertenecen a M0 (siempre activo), no a M1. | En la guía, lotes y cultivos son parte del Núcleo. |
| D-13 | 4 | `trabajadorId` del usuario se lee de la BD en cada petición de tareas (no va en el JWT). | Si cambia el vínculo usuario↔trabajador no hay que volver a iniciar sesión. |
| D-14 | 4 | Tareas: `PENDIENTE → EN_CURSO → COMPLETADA`, y `CANCELADA` solo desde activas. Se puede completar directo desde `PENDIENTE` (menos toques en el celular). | Uso real en campo. |
| D-15 | 4 | El aviso de tarea por WhatsApp solo se envía si `Trabajador.consentimientoWhatsapp = true`; al cambiar el consentimiento se guarda `fechaConsentimiento`. | Consentimiento exigido por la guía. |
| D-16 | 4 | Ficha pública del QR: ventas anonimizadas (solo tipo de cliente, fecha y cantidad). Nunca nombres, teléfonos, precios ni responsables técnicos. | Protección de datos personales. |
| D-17 | 4 | Las consultas SQL de trazabilidad viven en `src/services/trazabilidad.js`, se ejecutan de verdad con parámetro enlazado (`?`) en `GET /api/publico/lotes/:token/sql` y son las mismas del informe. | La consulta documentada es real y no admite inyección. |
| D-18 | 4 | Registrar una cosecha crea automáticamente la ENTRADA en el inventario de productos (por clave de cultivo, p. ej. "Pimentón" → `PIMENTON`). Si no existe el producto, se crea. La calidad DESCARTE no entra a stock. | Flujo de la demo: cosecha → inventario → venta. |
