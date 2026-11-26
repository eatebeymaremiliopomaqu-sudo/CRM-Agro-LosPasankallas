# Guía de contribución

Este documento explica cómo los integrantes del equipo deben trabajar con Git para cumplir con los requisitos de la guía del ingeniero.

## Estructura de ramas

El proyecto tiene las siguientes ramas:

- **`main`**: rama principal con el código estable
- **`sprint-0`**: Sprint 0 (entrevista, historias de usuario, modelo ER inicial)
- **`sprint-1`**: Sprint 1 (renumeración de módulos, M0, M1 parcial)
- **`sprint-2`**: Sprint 2 (M1 completo, M2, M3, M4)
- **`sprint-3`**: Sprint 3 (M5, M6, M7, WhatsApp, despliegue)

## Flujo de trabajo por sprint

Cada sprint sigue este flujo:

1. **Cambiar a la rama del sprint**:
   ```bash
   git checkout sprint-X
   ```

2. **Trabajar en las tareas del sprint**, haciendo commits frecuentes con mensajes descriptivos en español:
   ```bash
   git add .
   git commit -m "Descripción clara del cambio"
   ```

3. **Al finalizar el sprint**, integrar los cambios a `main`:
   ```bash
   git checkout main
   git merge sprint-X --no-ff -m "Merge sprint X: [resumen de logros]"
   git push origin main
   ```

## Configuración de identidad

**MUY IMPORTANTE**: Cada integrante debe configurar su propio nombre y email en Git **antes de hacer commits**:

```bash
git config user.name "Nombre Completo del Integrante"
git config user.email "email@ejemplo.com"
```

Esto es necesario porque la guía del ingeniero requiere **evidencia de commits de los 3 integrantes** en cada sprint.

### Verificar la configuración

Para verificar tu configuración actual:

```bash
git config user.name
git config user.email
```

### Configuración por integrante

**Integrante 1**: [Nombre completo]
```bash
git config user.name "Nombre del Integrante 1"
git config user.email "integrante1@ejemplo.com"
```

**Integrante 2**: [Nombre completo]
```bash
git config user.name "Nombre del Integrante 2"
git config user.email "integrante2@ejemplo.com"
```

**Integrante 3**: [Nombre completo]
```bash
git config user.name "Nombre del Integrante 3"
git config user.email "integrante3@ejemplo.com"
```

## Distribución de trabajo por sprint

### Sprint 0 (Preparación)
- **Todos**: entrevista simulada al productor ficticio "Don Hilario"
- **Integrante 1**: redacción de historias de usuario
- **Integrante 2**: diseño del modelo ER inicial
- **Integrante 3**: configuración del entorno y dependencias

### Sprint 1 (Renumeración y núcleo)
- **Integrante 1**: migración del esquema de BD (renumeración de módulos)
- **Integrante 2**: actualización de rutas y middleware del backend
- **Integrante 3**: actualización de vistas del frontend

### Sprint 2 (Funcionalidades core)
- **Integrante 1**: M1 (calendario, aplicaciones con carencia)
- **Integrante 2**: M2 (trazabilidad completa) y M3 (tareas)
- **Integrante 3**: M4 (inventarios) y M5 (ventas)

### Sprint 3 (Integración y despliegue)
- **Integrante 1**: M6 (vivero) y M7 (reportes financieros)
- **Integrante 2**: WhatsApp real (Twilio/Meta) y agente ampliado
- **Integrante 3**: pruebas, despliegue y documentación final

## Mensajes de commit

Usar mensajes claros en español, siguiendo estas convenciones:

- `feat: agregar [funcionalidad]` - nueva funcionalidad
- `fix: corregir [problema]` - corrección de bug
- `refactor: mejorar [componente]` - refactorización sin cambio de funcionalidad
- `test: agregar pruebas de [módulo]` - agregar o actualizar pruebas
- `docs: actualizar [documentación]` - cambios en documentación
- `style: ajustar estilos de [componente]` - cambios visuales

### Ejemplos

```bash
git commit -m "feat: agregar modelo Campaña para ciclos de cultivo"
git commit -m "fix: corregir validación de período de carencia"
git commit -m "test: agregar pruebas de cálculo de costos por lote"
git commit -m "docs: actualizar README con nuevos módulos M6 y M7"
```

## ¿Qué NO subir al repositorio?

El archivo `.gitignore` ya está configurado para excluir:

- `node_modules/` - dependencias (se instalan con `npm install`)
- `.env` - variables de entorno secretas (cada desarrollador tiene el suyo)
- `*.db`, `*.db-journal`, etc. - bases de datos locales
- `dist/` - archivos compilados
- `coverage/` - reportes de cobertura

**NUNCA** hacer commit de:
- Claves API (Anthropic, Groq, Twilio, Meta)
- Tokens de acceso
- Contraseñas
- Datos reales de personas

Usar siempre el archivo `.env.example` con valores vacíos como plantilla.

## Revisión antes de hacer push

Antes de hacer push, verificar:

1. **Las pruebas pasan**:
   ```bash
   cd codigo/backend && npm test
   cd codigo/frontend && npm test
   ```

2. **No hay archivos sensibles**:
   ```bash
   git status
   git diff --cached
   ```

3. **El mensaje de commit es descriptivo**:
   - ¿Explica QUÉ se cambió?
   - ¿Explica POR QUÉ se cambió?

## Resolución de conflictos

Si hay conflictos al hacer merge:

1. Git marcará los archivos en conflicto
2. Abrir los archivos y buscar las marcas `<<<<<<<`, `=======`, `>>>>>>>`
3. Resolver manualmente, eligiendo qué código conservar
4. Marcar como resuelto: `git add [archivo]`
5. Completar el merge: `git commit`

## Recursos

- [Git - Guía sencilla](https://rogerdudler.github.io/git-guide/index.es.html)
- [Conventional Commits](https://www.conventionalcommits.org/es/)
- [Atlassian Git Tutorials](https://www.atlassian.com/es/git/tutorials)
