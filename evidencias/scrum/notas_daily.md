# Notas de daily (Daily Scrum)

> **Plantilla + ejemplos.** Los ejemplos describen el trabajo realmente hecho en cada bloque, pero los nombres y fechas están entre [ ]: reemplácenlos con su registro real (una nota por día).

## Plantilla (15 minutos, de pie)

```
Fecha: [dd/mm/aaaa] · Sprint [N] · Día [n de 10]
Asistentes: [Integrante 1], [Integrante 2], [Integrante 3]

[Integrante]  Ayer: …            Hoy: …            Impedimentos: …
[Integrante]  Ayer: …            Hoy: …            Impedimentos: …
[Integrante]  Ayer: …            Hoy: …            Impedimentos: …

Acuerdos / acciones: …
Puntos pendientes del sprint (burndown): …
```

## Ejemplos

### Sprint 1 · Día 3
| Integrante | Ayer | Hoy | Impedimentos |
|---|---|---|---|
| [Integrante 1] | Renombré Parcela → Lote en el esquema y el seed | Middleware `requiereModulo` con la tabla `ModuloFinca` | Ninguno |
| [Integrante 2] | Matriz de permisos con los 3 roles | Pruebas de RBAC | Dudas con el rol "consulta" → se elimina (ADR-006) |
| [Integrante 3] | Vista de lotes con mapa | Calendario de labores | Vite falla si la ruta tiene `#` → renombrar carpeta |

**Acuerdos:** cambio limpio sin alias (ADR-013). Pendientes: 36 puntos.

### Sprint 2 · Día 6
| Integrante | Ayer | Hoy | Impedimentos |
|---|---|---|---|
| [Integrante 1] | Rutas de ventas y cobros | Cuentas por cobrar | Ninguno |
| [Integrante 2] | Ficha pública del QR con labores | Ventas anonimizadas + consulta SQL documentada | ¿Mostrar el nombre del cliente? → No (privacidad) |
| [Integrante 3] | Modelo `Tarea` | Vista "Mis tareas" | El JWT no trae `trabajadorId` → leer de la BD (DEF-15) |

**Acuerdos:** la cosecha genera entrada de inventario automáticamente (ADR-017.9).

### Sprint 3 · Día 4
| Integrante | Ayer | Hoy | Impedimentos |
|---|---|---|---|
| [Integrante 1] | Webhook de Twilio con firma | Probar con el celular en el Sandbox | Hace falta túnel (cloudflared) para la URL pública |
| [Integrante 2] | Intenciones de cosecha y pedido | Políticas por perfil (trabajador, cliente) | Fechas en UTC confunden "hoy" (DEF-26) |
| [Integrante 3] | Alertas diarias | Botón "Enviar ahora" y bitácora | Ventana de 24 h de WhatsApp para mensajes proactivos |

**Acuerdos:** las alertas solo a quien dio consentimiento; documentar la ventana de 24 h en la guía.

### Sprint 3 · Día 8
| Integrante | Ayer | Hoy | Impedimentos |
|---|---|---|---|
| [Integrante 1] | Migración a Vitest | Pruebas de API con supertest | Las pruebas encontraron que una dosis con nombre comercial no se bloqueaba (DEF-17, crítico) |
| [Integrante 2] | Reportes de costos por lote | Exportación CSV | Ninguno |
| [Integrante 3] | Seed de la demo | Guion de la exposición | Ninguno |

**Acuerdos:** DEF-17 se corrige hoy con prueba de regresión antes de seguir.
