# Pruebas de aceptación (UAT) · CRM-Agro

**Usuario simulado:** Don Hilario, encargado de la **Finca Los Molles** (Comarapa, Santa Cruz). 54 años, usa WhatsApp todos los días, poca costumbre con computadoras; en el campo tiene señal intermitente.
**Objetivo:** comprobar que puede hacer el flujo de la exposición — **labor por WhatsApp → cosecha → QR → inventario → venta** — sin ayuda y que el sistema lo protege (carencia, dosis).

| Dato | Valor |
|---|---|
| Fecha de ejecución | 2026-11-25 |
| Entorno | Local (backend + frontend), datos ficticios del seed, WhatsApp en modo **simulado** |
| Cuenta usada | `encargado@finca.test` (teléfono 59170000002) |
| Quién ejecutó | Beymar Emilio Poma Queso, en el rol de Don Hilario, usando **Agente y WhatsApp → Simular WhatsApp** y la app web. Los mismos pasos están automatizados en `codigo/backend/tests/integracion/flujos.test.js` y `api.test.js` |
| Pendiente | Repetir UAT-01 a UAT-06 con el celular real de Beymar conectado al Sandbox de Twilio (ver `codigo/docs/WHATSAPP_TWILIO.md`) y anotar el resultado en la última columna |

Criterio de aceptación general: cada paso se completa en menos de 1 minuto, el sistema **pide confirmación SI/NO** antes de guardar y los mensajes se entienden sin explicación técnica.

---

## UAT-01 · Registrar una labor por WhatsApp

| # | Acción de Don Hilario | Resultado esperado | Resultado obtenido |
|---|---|---|---|
| 1 | Escribe `regué el lote 2 por 2 horas` | El agente resume "Labor RIEGO en L-02, 2 h" y pregunta ¿Confirmas? SI/NO | ✅ Igual al esperado |
| 2 | Responde `SI` | "✅ Registrado. Labor #… guardada en L-02" | ✅ |
| 3 | El encargado abre **Control de campo** | La labor aparece con origen *WhatsApp* | ✅ |

**Aceptado.** Observación: Don Hilario pregunta qué pasa si escribe "lote dos" en letras → se anota como mejora (hoy solo entiende números).

## UAT-02 · Cosechar tomate del lote 2 y obtener el QR

| # | Acción | Esperado | Obtenido |
|---|---|---|---|
| 1 | Escribe `hoy cosechamos 40 kg de tomate del lote 2` (ejemplo de la guía) | Resumen "Cosecha de 40 kg de Tomate en L-02… se generará un lote de cosecha con QR y entrará al inventario" | ✅ |
| 2 | Responde `SI` | Código `FLM-2026-0007` y enlace de trazabilidad | ✅ |
| 3 | Abre **Trazabilidad** en la web | Lote de cosecha con QR para imprimir | ✅ |

**Aceptado.**

## UAT-03 · El sistema impide cosechar un lote en carencia

| # | Acción | Esperado | Obtenido |
|---|---|---|---|
| 1 | Escribe `hoy cosechamos 20 kg de cebolla del lote 5` | 🚫 "El lote L-05 está en carencia hasta el dd/mm/aaaa por AgroProtect 50 (ficticio)… No se puede registrar la cosecha" y **no pide confirmación** | ✅ |
| 2 | Intenta lo mismo en la web (Trazabilidad → Nuevo lote de cosecha) | Aviso de carencia con producto y fecha de fin; como encargado **no** ve "Forzar" | ✅ |
| 3 | La propietaria intenta forzar sin justificación / con justificación | Sin justificación: error. Con justificación: se crea con advertencia y queda en Auditoría | ✅ |

**Aceptado.**

## UAT-04 · Escanear el QR (vista del consumidor)

| # | Acción | Esperado | Obtenido |
|---|---|---|---|
| 1 | Abre el enlace del QR en el celular | Ficha móvil: finca, lote de campo, fechas, calidad | ✅ |
| 2 | Revisa "Manejo en campo" | Labores con aplicaciones, motivo y fin de carencia; mensaje "cosecha después de la carencia" | ✅ |
| 3 | Revisa "Venta" | Solo tipo de destino (p. ej. "Restaurante"), fecha y cantidad — sin nombres ni teléfonos | ✅ |
| 4 | Pulsa "Ver consulta SQL" | Se muestran las consultas reales de trazabilidad | ✅ |

**Aceptado.** Observación: Don Hilario propone que la ficha muestre una foto del lote (mejora futura).

## UAT-05 · Inventario y venta vinculada al lote

| # | Acción | Esperado | Obtenido |
|---|---|---|---|
| 1 | Abre **Inventarios → Productos cosechados** | "Tomate Santa Cruz" subió 40 kg; movimiento de ENTRADA con el código del lote | ✅ |
| 2 | En **Ventas → Nueva venta** vende 25 kg a un restaurante eligiendo el lote `FLM-2026-0007` | Venta creada, stock baja 25 kg, cuenta por cobrar si no se cobra | ✅ |
| 3 | Vuelve a abrir el QR | Aparece la venta anonimizada | ✅ |

**Aceptado.**

## UAT-06 · Pedir una dosis (límite del agente)

| # | Acción | Esperado | Obtenido |
|---|---|---|---|
| 1 | Escribe `¿qué dosis le echo al lote 5?` | ⚠️ No recomienda dosis; sugiere al ingeniero agrónomo y la etiqueta | ✅ |
| 2 | Escribe `¿cuánto AgroProtect le echo a la mochila?` | Mismo rechazo | ✅ (tras corregir DEF-17) |
| 3 | Escribe `¿qué se aplicó en el lote 5 y hasta cuándo es la carencia?` | Lista de lo registrado, "dosis de etiqueta registrada" tal cual se cargó, y fecha de fin de carencia | ✅ |

**Aceptado.**

## UAT-07 · Juan (trabajador) gestiona sus tareas

| # | Acción | Esperado | Obtenido |
|---|---|---|---|
| 1 | Entra como `trabajador@finca.test` en el celular | Menú corto: Mis tareas, Campo, Agente…; sin ventas ni finanzas | ✅ |
| 2 | En **Mis tareas** pulsa "Marcar hecha" | La tarea pasa al historial | ✅ |
| 3 | Por WhatsApp escribe `mis tareas` y luego `tarea hecha 47` → `SI` | Lista numerada y confirmación | ✅ (tras corregir DEF-18) |
| 4 | Escribe `fumigué el lote 3 con FitoVerde` | 🔒 "Las aplicaciones las registra el encargado" | ✅ |

**Aceptado.**

## UAT-08 · Un cliente hace un pedido por WhatsApp

| # | Acción | Esperado | Obtenido |
|---|---|---|---|
| 1 | María González (sin consentimiento) escribe `quiero 2 kg de tomate` | Se le pide responder ALTA; no se registra nada | ✅ |
| 2 | Responde `ALTA` y luego `quiero 3 cajas de frutilla para el viernes` → `SI` | Pedido recibido; aparece en Ventas → Pedidos con insignia *WhatsApp* | ✅ |
| 3 | Escribe `BAJA` | Deja de recibir avisos | ✅ |

**Aceptado.**

---

## Resumen

| Caso | Resultado | Defectos asociados |
|---|---|---|
| UAT-01 | Aceptado | — |
| UAT-02 | Aceptado | — |
| UAT-03 | Aceptado | DEF-27 (modal de carencia no aparecía), DEF-24 (cosecha por WhatsApp sin carencia) |
| UAT-04 | Aceptado | DEF-28 (destino con nombre del cliente) |
| UAT-05 | Aceptado | DEF-29 (detalle de venta daba error 500) |
| UAT-06 | Aceptado | DEF-17 |
| UAT-07 | Aceptado | DEF-15, DEF-18, DEF-19 |
| UAT-08 | Aceptado | — |

**Mejoras sugeridas por el usuario (backlog):** entender números escritos en letras ("lote dos"); foto del lote en la ficha QR; audio de WhatsApp (nota de voz) en lugar de texto.
