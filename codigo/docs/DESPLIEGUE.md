# Despliegue: Render (API + SQLite) y Vercel (PWA)

Tiempo estimado: 30–40 minutos. Necesitas una cuenta de **GitHub**, **Render** y **Vercel** (todas gratuitas para la demo).

```
GitHub (repositorio) ──► Render: API Node.js + SQLite   https://<servicio>.onrender.com  (Swagger en /api/docs)
                    └──► Vercel: frontend PWA          https://<proyecto>.vercel.app
WhatsApp (Meta) ───────► https://<servicio>.onrender.com/api/webhooks/whatsapp
```

## 0. Subir el repositorio a GitHub

1. Crea un repositorio **privado** en GitHub (p. ej. `crm-agro`).
2. Desde la carpeta del proyecto:
   ```powershell
   git remote add origin https://github.com/<usuario>/crm-agro.git
   git push -u origin main sprint-0 sprint-1 sprint-2 sprint-3
   ```
3. Verifica que **no** se subieron `.env`, `*.db` ni `node_modules` (están en `.gitignore`).
4. En la pestaña **Actions** debe aparecer el workflow "CI CRM-Agro" (pruebas con cobertura + build).

## 1. Backend en Render (Blueprint)

1. En <https://dashboard.render.com> → **New → Blueprint** → conecta el repositorio. Render lee `render.yaml` de la raíz.
2. Revisa el servicio `crm-agro-api` (rootDir `codigo/backend`, plan **free**) y pulsa **Apply**.
3. Render pedirá las variables marcadas `sync: false`. Para la primera vez deja vacías las de Meta/Twilio/LLM y completa:
   | Variable | Valor |
   |---|---|
   | `CORS_ORIGIN` | por ahora `https://<proyecto>.vercel.app` (la ajustas en el paso 3) |
   | `FRONTEND_URL` | igual que `CORS_ORIGIN` (se usa para armar el enlace del QR) |
   `JWT_SECRET` se genera sola.
4. Espera el build (`npm ci && npm run build`) y el inicio (`prisma db push` + carga de la demo si la BD está vacía).
5. Comprueba: `https://<servicio>.onrender.com/api/salud` → `{"ok":true,"bd":"ok"}` y `…/api/docs` muestra Swagger.

> **Plan free:** el servicio "duerme" tras 15 min sin uso (la primera petición tarda ~1 min) y el disco es efímero: al reiniciar se pierden los datos y se vuelve a cargar la demo (útil para la exposición).
> **Producción:** cambia a `plan: starter` y descomenta el bloque `disk` en `render.yaml`, con `DATABASE_URL=file:/var/data/crm-agro.db`.

## 2. Frontend en Vercel

1. En <https://vercel.com/new> importa el mismo repositorio.
2. **Root Directory:** `codigo/frontend` · Framework: **Vite** (lo detecta; `vercel.json` ya define build, salida y reescrituras de la SPA).
3. **Environment Variables:** `VITE_API_URL = https://<servicio>.onrender.com` (sin `/api` y sin barra final).
4. **Deploy.** Abre `https://<proyecto>.vercel.app` e ingresa con `encargado@finca.test` / `Agro2026!`.

## 3. Conectar los dos

1. En Render → *Environment*: `CORS_ORIGIN` y `FRONTEND_URL` = la URL exacta de Vercel. **Save** (redeploy automático).
2. Prueba la ficha pública: en *Trazabilidad* abre un lote de cosecha → el QR debe apuntar a `https://<proyecto>.vercel.app/t/…`.
3. En el celular, abre la URL de Vercel y elige **Agregar a pantalla de inicio** (PWA).

## 4. WhatsApp (Meta Cloud API) en producción

Sigue `WHATSAPP_META.md`. En Render → *Environment*:

| Variable | Valor |
|---|---|
| `WHATSAPP_PROVIDER` | `meta` |
| `WHATSAPP_TOKEN` | token de acceso (temporal de 24 h o permanente de un usuario del sistema) |
| `WHATSAPP_PHONE_NUMBER_ID` | identificador del número de teléfono |
| `WHATSAPP_APP_SECRET` | Configuración de la app → Básica → Clave secreta |
| `WHATSAPP_VERIFY_TOKEN` | el mismo que pongas en el webhook de Meta |

En Meta → **WhatsApp → Configuración → Webhook → Editar**: `https://<servicio>.onrender.com/api/webhooks/whatsapp` con el token de verificación, y suscribir **messages**. En producción la firma `X-Hub-Signature-256` **siempre** se valida (sin `WHATSAPP_APP_SECRET` el webhook rechaza todo).

El celular del encargado se carga en la app (*Configuración → Usuarios*), o con `DEMO_WHATSAPP_ENCARGADO` en Render (lo usa la carga inicial de la demo).

## 5. Agente con LLM (opcional)

`AI_PROVIDER=claude` + `ANTHROPIC_API_KEY`, o `AI_PROVIDER=groq` + `GROQ_API_KEY`. Sin clave funciona con el intérprete por reglas.

## 6. CI/CD

- `.github/workflows/ci.yml` corre en cada push a `main` y `sprint-*`: pruebas del backend con cobertura (falla si baja de los umbrales), pruebas y build del frontend.
- En `main`, si existe el secreto `RENDER_DEPLOY_HOOK` (Render → Settings → Deploy Hook), dispara el deploy. Vercel despliega solo desde su integración con GitHub.
- Variable opcional del repositorio `VITE_API_URL` (Settings → Variables) para el build del CI.

## 7. Verificación final

| Prueba | Resultado esperado |
|---|---|
| `GET /api/salud` | `ok: true` |
| Login en la PWA como encargado | Tablero con datos de la demo |
| *Configuración → Módulos*: apagar M6 | Desaparece "Vivero" y `GET /api/vivero` → 403 |
| Simular WhatsApp: `hoy cosechamos 40 kg de tomate del lote 2` → `SI` | Lote de cosecha con enlace a Vercel |
| Abrir el QR en el celular | Ficha pública sin datos personales |

## 8. Costo mensual

| Servicio | Demo | Producción (una finca) |
|---|---|---|
| Vercel Hobby | US$ 0 | US$ 0 |
| Render | US$ 0 (free) | ≈ US$ 7 (starter) + ≈ US$ 0,25 (1 GB de disco) |
| WhatsApp (Meta Cloud API) | US$ 0 (número de prueba) | ≈ US$ 3–6 (plantillas de alertas; las respuestas a mensajes del cliente son gratuitas) |
| LLM | US$ 0 (reglas) | US$ 0–2 |
| **Total** | **US$ 0** | **≈ US$ 11–16 / mes** |

Precios de referencia: verifica las tarifas vigentes de cada proveedor antes de contratar.

## Problemas frecuentes

| Síntoma | Solución |
|---|---|
| La app dice "Sin conexión con el servidor" | `VITE_API_URL` mal escrita, o Render dormido (espera 1 min) |
| Error de CORS en la consola del navegador | `CORS_ORIGIN` en Render debe ser exactamente la URL de Vercel |
| El QR abre `localhost` | Falta `FRONTEND_URL` en Render |
| Los datos desaparecen | Plan free: disco efímero. Usa starter + disco para conservarlos |
| El build de Render falla en `prisma` | `prisma` y `@prisma/client` están en `dependencies`; revisa que `package-lock.json` esté subido |
