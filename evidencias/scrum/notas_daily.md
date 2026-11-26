# Registro diario (Daily Scrum de un equipo de una persona)

**Autor:** Beymar Emilio Poma Queso · Grupo Los Pasankallas (trabajo individual)

Como el equipo es de una sola persona, la daily no es una reunión. Es un **registro breve al empezar cada jornada** (5 minutos), escrito en el rol de **Scrum Master**: qué se avanzó, qué se hará hoy y qué bloquea. Si hay un bloqueo, se anota la acción para quitarlo antes de seguir programando como **Developer**.

> ✏️ **COMPLETAR:** los ejemplos de abajo describen el trabajo que efectivamente quedó en los commits de cada rama. Las **fechas** son lo único que falta: reemplaza `dd/mm/aaaa` por el día real y agrega una entrada por cada día que trabajaste.

## Formato de cada entrada

```
Fecha: dd/mm/aaaa · Sprint N · Día n de 10
Ayer:          …
Hoy:           …
Bloqueos:      …   (acción para resolverlo)
Puntos pendientes del sprint (burndown): …
```

## Ejemplos

### Sprint 1 · Día 3 · Fecha: dd/mm/aaaa ✏️
- **Ayer:** renombré Parcela → Lote en el esquema y el seed; matriz de permisos con los 3 roles.
- **Hoy:** middleware `requiereModulo` con la tabla `ModuloFinca`; pruebas de RBAC; vista de lotes con mapa.
- **Bloqueos:** Vite falla si la ruta tiene el carácter numeral → renombrar la carpeta. Duda con el rol "consulta" → se elimina (ADR-006).
- **Pendiente del sprint:** 36 puntos. Decisión: cambio limpio sin alias (ADR-013).

### Sprint 2 · Día 6 · Fecha: dd/mm/aaaa ✏️
- **Ayer:** rutas de ventas y cobros; ficha pública del QR con labores; modelo `Tarea`.
- **Hoy:** cuentas por cobrar; ventas anonimizadas en el QR y consulta SQL documentada; vista "Mis tareas".
- **Bloqueos:** el JWT no trae `trabajadorId` → leerlo de la BD (DEF-15). ¿Mostrar el nombre del cliente en el QR? → No, por privacidad.
- **Decisión:** la cosecha genera la entrada de inventario automáticamente (ADR-017.9).

### Sprint 3 · Día 4 · Fecha: dd/mm/aaaa ✏️
- **Ayer:** webhook de Twilio con firma; intenciones de cosecha y pedido; alertas diarias.
- **Hoy:** probar con el celular en el Sandbox; políticas por perfil; botón "Enviar ahora" y bitácora.
- **Bloqueos:** hace falta un túnel (cloudflared) para la URL pública; las fechas en UTC confunden "hoy" (DEF-26); ventana de 24 h de WhatsApp para mensajes proactivos.
- **Decisión:** alertas solo a quien dio consentimiento; documentar la ventana de 24 h en la guía.

### Sprint 3 · Día 8 · Fecha: dd/mm/aaaa ✏️
- **Ayer:** migración a Vitest; reportes de costos por lote; seed de la demo.
- **Hoy:** pruebas de API con supertest; exportación CSV; guion de la exposición.
- **Bloqueos:** las pruebas encontraron que una pregunta de dosis con nombre comercial no se bloqueaba (DEF-17, crítico) → se corrige hoy con prueba de regresión antes de seguir.
