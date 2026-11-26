# Sprint Reviews y Retrospectivas

> Lo **presentado** en cada review corresponde a lo implementado (ver commits de cada rama). Los comentarios del Product Owner y las votaciones de la retrospectiva son **plantilla**: complétenlos con lo que pasó en sus reuniones.

---

## Sprint 1 · Review

**Incremento:** núcleo modular (M0) con roles PROPIETARIO/ENCARGADO/TRABAJADOR y módulos activables; lotes en mapa y campañas; calendario de labores; aplicaciones con motivo y carencia; **bloqueo de cosecha por carencia (409)** con forzado auditado del propietario.
**Demo:** activar/desactivar M2 y ver el 403; intentar cosechar un lote recién fumigado.
**Historias:** HU-01 a HU-09 · 43 puntos completados.
**Comentarios del PO:** [completar]

## Sprint 1 · Retrospectiva (formato Empezar / Dejar / Continuar)

| Empezar | Dejar | Continuar |
|---|---|---|
| Escribir pruebas junto con cada regla de negocio | Cambiar nombres sin actualizar el frontend | Commits pequeños en español |
| Revisar la ruta del proyecto (sin `#`) al clonar | — | Registrar decisiones en DECISIONES.md |

**Acción de mejora:** checklist de "cambio de nombre" (backend, frontend, seed, pruebas, Swagger). Responsable: [Integrante].

---

## Sprint 2 · Review

**Incremento:** inventario de productos (cosecha → entrada), clientes con consentimiento, pedidos, ventas vinculadas al lote de cosecha, cobros parciales y cuentas por cobrar; ficha pública del QR hasta la venta (anonimizada) y consulta SQL documentada; tareas asignadas y "Mis tareas".
**Demo:** cosecha → stock sube → venta → el QR muestra la venta sin el nombre del cliente.
**Historias:** HU-10 a HU-18 · 45 puntos.
**Comentarios del PO:** [completar]

## Sprint 2 · Retrospectiva

| Empezar | Dejar | Continuar |
|---|---|---|
| Pruebas de API contra una BD de prueba | Confiar en datos aleatorios del seed (carencias incoherentes, DEF-31) | Revisión cruzada de pull requests |
| Probar con el rol trabajador desde el celular | — | Diseño móvil primero |

**Acción de mejora:** seed determinista con la historia de la demo. Responsable: [Integrante].

---

## Sprint 3 · Review

**Incremento:** WhatsApp real (Twilio/Meta/simulado) con firma, ALTA/BAJA, agente ampliado (cosecha, tarea hecha, pedido de cliente, consultas), políticas por perfil, alertas diarias con bitácora; M6 Vivero; M7 costos, margen, gráficos y CSV; 249 pruebas con 96 % de cobertura y CI; informe, diapositivas y guía de despliegue.
**Demo:** flujo completo de la exposición desde el celular.
**Historias:** HU-19 a HU-30 · 63 puntos.
**Comentarios del PO:** [completar]

## Sprint 3 · Retrospectiva

| Empezar | Dejar | Continuar |
|---|---|---|
| Probar con números de teléfono y fechas reales de Bolivia (UTC-4) | Dejar las pruebas para el final del sprint | Pruebas de humo del flujo de la demo antes de cada commit |
| Usar el validador de colores en los gráficos | — | Documentar guías paso a paso para cuentas externas |

**Lecciones aprendidas (para la lámina de aprendizajes):**
1. Las pruebas de API encontraron 6 defectos que las unitarias no veían (DEF-17, 18, 19, 28, 29 y el de fechas).
2. Un agente de IA seguro es más **código** que **IA**: el LLM solo extrae datos; validaciones, carencia y confirmación las hace el sistema.
3. La privacidad se diseña: el QR es público, así que nada personal entra en la ficha.
4. Modularidad real = la API responde 403, no solo esconder el menú.
