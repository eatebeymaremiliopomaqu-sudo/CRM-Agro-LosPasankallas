# Guion de exposición · CRM-Agro (8–10 minutos)

**Diapositivas:** `diapositivas/Diapositivas_Grupo##.pptx` (14 láminas; las notas del orador tienen el texto de cada integrante).
**Flujo obligatorio de la demo:** registrar labor por WhatsApp → cosecha → QR de trazabilidad → inventario → venta.

## Reparto y tiempos

| Min | Lámina | Quién | Qué dice / hace |
|---|---|---|---|
| 0:00 | 1 Portada | [Integrante 1] | Presentación del grupo y del proyecto (datos ficticios) |
| 0:30 | 2 Problema | [Integrante 1] | Don Hilario: cuadernos, carencia, trazabilidad, rentabilidad |
| 1:30 | 3 Solución | [Integrante 1] | Modular, en el celular sin señal, por WhatsApp; nunca recomienda dosis |
| 2:15 | 4 Arquitectura | [Integrante 2] | Vercel + Render + SQLite; routers por módulo; `requiereModulo` |
| 3:00 | 5 Módulos | [Integrante 2] | M0–M7, incluidos los opcionales M6 y M7 |
| 3:45 | 6 **Demo** | [Integrante 3] | Demo en vivo (ver abajo) — 2,5 min |
| 6:15 | 7 Agente | [Integrante 3] | Flujo del mensaje; SI/NO; límites; perfiles |
| 7:00 | 8 Seguridad y ética | [Integrante 2] | Carencia, consentimiento, privacidad del QR, firmas |
| 7:30 | 9 Base de datos | [Integrante 2] | 30 tablas, 3FN, consulta de trazabilidad |
| 8:00 | 10 SCRUM | [Integrante 1] | Sprint 0–3, ramas, velocidad |
| 8:30 | 11 Calidad | [Integrante 3] | 263 pruebas, 96 % de cobertura, 32 defectos, UAT |
| 9:00 | 12 Despliegue y costos | [Integrante 2] | URLs y costo < 1 jornal al mes |
| 9:20 | 13 Aprendizajes | Los tres | Una idea cada uno |
| 9:45 | 14 Conclusión | [Integrante 3] | Cierre y preguntas |

## Preparación (30 minutos antes)

1. Despertar Render: abrir `https://[servicio].onrender.com/api/salud` (el plan gratuito duerme).
2. Reiniciar los datos de la demo si se usó antes: en local `npm run db:seed`; en Render, *Manual Deploy* o borrar el disco efímero (se recarga solo).
3. Celular del [Integrante 3] unido al Sandbox de Twilio (`join <palabra>`) y su número cargado en el usuario **encargado** (*Configuración → Usuarios*). Enviar "hola" para abrir la ventana de 24 h.
4. En el navegador, pestañas abiertas: app como `encargado@finca.test`, *Inventarios → Productos cosechados*, *Ventas*, y la ficha QR vacía.
5. **Plan B sin internet:** backend y frontend en local, *Agente y WhatsApp → Simular WhatsApp* con el remitente "Usuario · Ing. Bruno Rojas (Encargado)".

## Demo paso a paso (2,5 min)

| # | Acción | Lo que el público ve | Frase clave |
|---|---|---|---|
| 1 | WhatsApp: `regué el lote 2 por 2 horas` | Resumen y "¿Confirmas? SI/NO" | "El agente nunca guarda sin confirmación" |
| 2 | Responder `SI` | "✅ Registrado. Labor #… en L-02" y aparece en *Control de campo* con origen WhatsApp | |
| 3 | `hoy cosechamos 40 kg de tomate del lote 2` → `SI` | Código `FLM-2026-0007` y enlace del QR | "Antes de confirmar, revisó que L-02 no esté en carencia" |
| 4 | Abrir el enlace del QR en el celular (o proyectar) | Manejo en campo, aplicaciones con "carencia respetada", recorrido | "Esto ve el consumidor" |
| 5 | *Inventarios → Productos cosechados* | Tomate +40 kg, movimiento ENTRADA con el código del lote | |
| 6 | *Ventas → Nueva venta*: Restaurante La Quinta, 25 kg de tomate, lote `FLM-2026-0007` | Venta creada, stock −25 kg, saldo por cobrar | |
| 7 | Recargar el QR | Sección "Venta": "Restaurante · 25 kg" sin nombre | "Privacidad: el QR es público" |
| 8 | WhatsApp: `hoy cosechamos 20 kg de cebolla del lote 5` | 🚫 "L-05 está en carencia hasta el …" | "La regla se cumple también por WhatsApp" |
| 9 | (si sobra tiempo) `¿qué dosis le echo al lote 5?` | ⚠️ No recomienda dosis; deriva al agrónomo | |

## Preguntas probables

| Pregunta | Respuesta corta |
|---|---|
| ¿Qué pasa si el LLM se equivoca? | Solo extrae datos; el código valida todo y el usuario confirma. Sin LLM funciona con reglas. |
| ¿Por qué SQLite? | Una finca genera pocos datos; evita pagar un servidor de BD. Prisma permite migrar a PostgreSQL. |
| ¿Cómo se activa un módulo? | *Configuración → Módulos*. La API valida dependencias y responde 403 si está apagado. |
| ¿Qué pasa sin señal? | La PWA guarda labores, tareas y cosechas y las envía al volver la red. |
| ¿Cómo prueban que no recomienda dosis? | Pruebas unitarias y de API con decenas de frases; DEF-17 se encontró así y se corrigió. |
| ¿Cuánto cuesta? | Demo gratis; producción ≈ US$ 11–16 al mes. |
