# Sprint 0 · Análisis y descubrimiento

> Entrevista **simulada** con un productor **ficticio** (no es una persona real). Trabajo individual: los tres roles los asume Beymar Emilio Poma Queso.

**Duración:** 1 semana · **Rama:** `sprint-0` · **Participante:** Beymar Emilio Poma Queso (Product Owner, Scrum Master y Developer)

## 1. Entrevista al productor (simulada)

**Entrevistado:** Don Hilario Mamani (ficticio), encargado de la Finca Los Molles, Comarapa (6,5 ha: tomate, pimentón, frutilla, papa, cebolla, maíz y un pequeño vivero).
**Formato:** 40 minutos, preguntas abiertas.

| # | Pregunta | Respuesta (resumen) | Necesidad detectada |
|---|---|---|---|
| 1 | ¿Cómo anotan hoy lo que se hace en el campo? | "En un cuaderno y en el WhatsApp del grupo. Muchas veces se pierde." | Registro simple desde el celular, sin cuadernos |
| 2 | ¿Usan computadora? | "Poco. El celular sí, todo el día." | Interfaz móvil primero; WhatsApp como canal principal |
| 3 | ¿Hay señal en los lotes? | "En la parte baja casi no." | Funcionamiento sin conexión (PWA) |
| 4 | ¿Cómo controlan las fumigaciones? | "El ingeniero indica y yo anoto la fecha. A veces se cosechó antes de tiempo." | Registrar aplicaciones con carencia y **bloquear cosechas** dentro de la carencia |
| 5 | ¿Les gustaría que el sistema recomiende qué fumigar? | "Eso lo decide el ingeniero." | El agente **no recomienda dosis**; solo registra y muestra lo registrado |
| 6 | ¿A quién venden? | "Al Abasto, a un súper y a un restaurante. Algunos pagan después." | Clientes, pedidos, ventas y **cuentas por cobrar** |
| 7 | ¿Les piden saber de dónde viene el producto? | "El súper ya pidió una etiqueta." | **QR de trazabilidad** hasta la venta |
| 8 | ¿Cómo organizan a los trabajadores? | "Les digo cada mañana; anoto los jornales." | **Tareas asignadas**, asistencia y jornales; aviso por WhatsApp |
| 9 | ¿Usarían WhatsApp para avisos automáticos? | "Sí, pero hay gente que no quiere que le escriban." | **Consentimiento** (ALTA/BAJA) |
| 10 | ¿Cuánto pagarían al mes? | "Poco, menos que un jornal." | Arquitectura de **bajo costo** y modular |
| 11 | ¿Qué otra cosa quisieran saber? | "Si un lote me deja plata o no." | **Costos y margen por lote** (M7) |
| 12 | ¿Venden plantines? | "Sí, del vivero, a vecinos." | **Vivero** (M6) |

## 2. Hallazgos → épicas

| Épica | Módulo | Historias |
|---|---|---|
| Núcleo modular y roles | M0 | HU-01 a HU-05 |
| Control de campo y carencia | M1 | HU-06 a HU-09 |
| Trazabilidad QR | M2 | HU-15, HU-16 |
| Trabajadores y tareas | M3 | HU-17, HU-18 |
| Inventarios | M4 | HU-10, HU-11 |
| Ventas y cobros | M5 | HU-12 a HU-14 |
| WhatsApp + agente IA | Transversal | HU-19 a HU-24 |
| Vivero | M6 | HU-25, HU-26 |
| Finanzas | M7 | HU-27, HU-28 |
| Calidad y despliegue | — | HU-29, HU-30 |

El detalle (criterios de aceptación y puntos) está en `product_backlog.csv` (importable en Jira o Trello).

## 3. Modelo de datos inicial

Ver `../diagramas/modelo_er.png` (versión final, 30 tablas en 3FN) y la sección de base de datos del informe.

## 4. Decisiones del Sprint 0

- Stack: Vue 3 + Vite (PWA), Node.js + Express + Prisma, SQLite; Vercel + Render (bajo costo).
- WhatsApp por **Twilio Sandbox** para la demo; Meta Cloud API como alternativa.
- Agente con **reglas + LLM opcional**: el LLM solo extrae datos; las decisiones y validaciones las hace el código.
- Estimación con puntos de historia (Fibonacci), comparando cada historia con una de referencia (HU-01 = 3 puntos). Velocidad esperada: ~45 puntos por sprint.
- Ver `../../DECISIONES.md` (ADR-001 a ADR-021).

## 5. Definition of Done (acordada)

1. Diff completo autorrevisado (rol Scrum Master) y fusionado en la rama del sprint.
2. Pruebas automatizadas en verde; build sin errores.
3. Swagger y documentación actualizados.
4. Sin datos reales ni claves en el repositorio.
