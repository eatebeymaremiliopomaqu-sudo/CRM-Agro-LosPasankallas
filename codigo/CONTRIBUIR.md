# Guía de contribución

Este proyecto es un **trabajo individual** de **Beymar Emilio Poma Queso** (grupo Los Pasankallas). Este documento explica cómo se trabajó con Git para dejar evidencia por sprint.

## Estructura de ramas

- **`main`**: rama principal con el código estable
- **`sprint-0`**: Sprint 0 (entrevista simulada, historias de usuario, modelo ER inicial)
- **`sprint-1`**: Sprint 1 (renumeración M0–M7, roles, campo con calendario y bloqueo por carencia)
- **`sprint-2`**: Sprint 2 (inventario de productos, ventas y cobros, trazabilidad hasta la venta, tareas)
- **`sprint-3`**: Sprint 3 (WhatsApp real y agente ampliado, alertas, M6 Vivero, M7 Finanzas, pruebas con Vitest)

Todas las ramas contienen commits del único integrante.

## Flujo de trabajo por sprint

1. **Cambiar a la rama del sprint**:
   ```bash
   git checkout sprint-X
   ```
2. **Trabajar en las tareas del sprint** con commits frecuentes y mensajes descriptivos en español:
   ```bash
   git add .
   git commit -m "feat: descripción clara del cambio"
   ```
3. **Al cerrar el sprint** (después de la review y la retrospectiva), integrar a `main`:
   ```bash
   git checkout main
   git merge sprint-X --no-ff -m "Merge sprint X: resumen de logros"
   git push origin main
   ```

## Identidad en Git

```bash
git config user.name "Beymar Emilio Poma Queso"
git config user.email "<tu correo de GitHub>"
```

Como hay un solo integrante, la revisión de código la hace él mismo en el rol de Scrum Master: antes de fusionar revisa el diff completo (`git diff main...sprint-X`) y comprueba que las pruebas pasen.

## Mensajes de commit

- `feat: …` nueva funcionalidad
- `fix: …` corrección de un defecto
- `refactor: …` mejora sin cambiar el comportamiento
- `test: …` pruebas nuevas o actualizadas
- `docs: …` documentación
- `style: …` cambios visuales

```bash
git commit -m "feat: agregar modelo Campaña para ciclos de cultivo"
git commit -m "fix: corregir validación de período de carencia"
git commit -m "test: agregar pruebas de cálculo de costos por lote"
```

## Qué NO se sube al repositorio

`.gitignore` excluye `node_modules/`, `.env`, `*.db` (y sus `-journal`), `dist/`, `coverage/` y `entrega/`.

**Nunca** hacer commit de claves API (Anthropic, Groq, Twilio, Meta), tokens, contraseñas ni datos reales de personas. El celular real del encargado va solo en `.env` (`DEMO_WHATSAPP_ENCARGADO`). Usar `.env.example` (sin valores) como plantilla.

## Revisión antes de hacer push

1. Las pruebas pasan:
   ```bash
   cd codigo/backend && npm test
   cd codigo/frontend && npm test
   ```
2. No hay archivos sensibles: `git status` y `git diff --cached`.
3. El mensaje explica qué se cambió y por qué.

## Resolución de conflictos

1. Git marca los archivos en conflicto.
2. Buscar las marcas `<<<<<<<`, `=======`, `>>>>>>>` y resolver a mano.
3. `git add <archivo>` y `git commit` para completar el merge.
