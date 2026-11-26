# Sprint Reviews y Retrospectivas (equipo de una persona)

**Autor:** Beymar Emilio Poma Queso · Grupo Los Pasankallas (trabajo individual)

Al cerrar cada sprint, Beymar cambia de rol en dos momentos separados:

1. **Review (rol Product Owner):** ejecuta la demo del incremento contra el objetivo del sprint y los criterios de aceptación de cada historia, y decide qué pasa a "Hecho" y qué vuelve al backlog. Usa como "cliente" al productor ficticio de la entrevista simulada (Don Hilario).
2. **Retrospectiva (rol Scrum Master):** revisa el proceso (registro diario, burndown, defectos encontrados) con el formato Empezar / Dejar / Continuar y elige **una** acción de mejora para el siguiente sprint.

> Lo **presentado** en cada review corresponde a lo implementado (ver commits de cada rama).
> ✏️ **COMPLETAR:** las líneas "Observaciones del PO" son tuyas: escribe qué aceptaste, qué rechazaste y por qué.

---

## Sprint 1 · Review

**Incremento:** núcleo modular (M0) con roles PROPIETARIO/ENCARGADO/TRABAJADOR y módulos activables; lotes en mapa y campañas; calendario de labores; aplicaciones con motivo y carencia; **bloqueo de cosecha por carencia (409)** con forzado auditado del propietario.
**Demo:** activar/desactivar M2 y ver el 403; intentar cosechar un lote recién fumigado.
**Historias:** HU-01 a HU-09 · 43 puntos completados.
**Observaciones del PO:** ✏️ COMPLETAR

## Sprint 1 · Retrospectiva

| Empezar | Dejar | Continuar |
|---|---|---|
| Escribir pruebas junto con cada regla de negocio | Cambiar nombres sin actualizar el frontend | Commits pequeños en español |
| Revisar la ruta del proyecto (sin el carácter numeral) al clonar | — | Registrar decisiones en DECISIONES.md |

**Acción de mejora:** checklist de "cambio de nombre" (backend, frontend, seed, pruebas, Swagger).

---

## Sprint 2 · Review

**Incremento:** inventario de productos (cosecha → entrada), clientes con consentimiento, pedidos, ventas vinculadas al lote de cosecha, cobros parciales y cuentas por cobrar; ficha pública del QR hasta la venta (anonimizada) y consulta SQL documentada; tareas asignadas y "Mis tareas".
**Demo:** cosecha → stock sube → venta → el QR muestra la venta sin el nombre del cliente.
**Historias:** HU-10 a HU-18 · 45 puntos.
**Observaciones del PO:** ✏️ COMPLETAR

## Sprint 2 · Retrospectiva

| Empezar | Dejar | Continuar |
|---|---|---|
| Pruebas de API contra una BD de prueba | Confiar en datos aleatorios del seed (carencias incoherentes, DEF-31) | Autorrevisión del diff completo antes de fusionar |
| Probar con el rol trabajador desde el celular | — | Diseño móvil primero |

**Acción de mejora:** seed determinista con la historia de la demo.

---

## Sprint 3 · Review

**Incremento:** WhatsApp real (Twilio/Meta/simulado) con firma, ALTA/BAJA, agente ampliado (cosecha, tarea hecha, pedido de cliente, consultas), políticas por perfil, alertas diarias con bitácora; M6 Vivero; M7 costos, margen, gráficos y CSV; pruebas automatizadas con más de 90 % de cobertura y CI; informe, diapositivas y guía de despliegue.
**Demo:** flujo completo de la exposición desde el celular.
**Historias:** HU-19 a HU-30 · 63 puntos.
**Observaciones del PO:** ✏️ COMPLETAR

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
5. Trabajando solo, separar los momentos de PO, SM y Developer evita "programar sin rumbo": el objetivo del sprint se fija antes de abrir el editor.
