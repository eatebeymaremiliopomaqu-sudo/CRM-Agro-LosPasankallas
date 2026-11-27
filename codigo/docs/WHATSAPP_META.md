# Conectar WhatsApp con Meta (WhatsApp Cloud API)

**Es el proveedor usado en este proyecto** (`WHATSAPP_PROVIDER=meta`). Twilio queda como alternativa: su registro exige verificar un celular por SMS y no envía SMS a Bolivia (ver ADR-022 en `DECISIONES.md` y `WHATSAPP_TWILIO.md`).

Tiempo: 20–30 minutos. Necesitas una cuenta de Facebook y tu celular con WhatsApp. Es gratis para la demo: Meta da un **número de prueba** que puede escribir a **hasta 5 números verificados**.

```
Tu WhatsApp ──► número de prueba de Meta ──► Webhook POST https://<url>/api/webhooks/whatsapp (firma X-Hub-Signature-256)
                                                     │
CRM-Agro (agente) ◄──────────────────────────────────┘ responde por la Graph API (/<PHONE_NUMBER_ID>/messages)
```

## 1. Crear la app

1. Entra a <https://developers.facebook.com/apps> con tu cuenta de Facebook. Si es la primera vez, pulsa **Empezar** y registra tu cuenta de desarrollador (verifica el correo).
2. Pulsa **Crear app**.
3. Nombre de la app: `CRM-Agro` · correo de contacto: el tuyo → **Siguiente**.
4. **Caso de uso:** elige **"Conectarte con los clientes a través de WhatsApp"** → **Siguiente**. (Si Meta te pregunta el *tipo* de app, elige **Empresa / Business**.)
5. **Portfolio comercial:** elige **"Crear un portfolio comercial"** (o uno existente) → **Siguiente** → **Ir al panel / Crear app** (pide tu contraseña de Facebook).
6. En el panel de la app, en el menú izquierdo, abre **WhatsApp → Configuración de la API** (*API Setup*). Si no aparece, en **Casos de uso → Personalizar** agrega el producto **WhatsApp**.

## 2. Agregar tu número como destinatario de prueba

En **WhatsApp → Configuración de la API**:

1. **Paso 1 · "De":** ya está seleccionado el **número de prueba** (*Test number*, +1 555…).
2. **"Para":** abre la lista → **Administrar lista de números de teléfono** → **Agregar número de teléfono**.
3. País **Bolivia (+591)** y tu número de celular (8 dígitos, sin el 591) → **Siguiente**.
4. Te llega un **código por WhatsApp**: escríbelo → **Verificar**.
5. Vuelve a **"Para"** y elige tu número. Pulsa **Enviar mensaje**: te llega la plantilla *hello_world* desde el número de prueba. Así el número de prueba queda en tus chats; **respóndele "hola"** para abrir la ventana de 24 h.

## 3. Copiar las credenciales

| Variable de `codigo/backend/.env` | Dónde está |
|---|---|
| `WHATSAPP_TOKEN` | **WhatsApp → Configuración de la API → Paso 1 → "Token de acceso temporal" → Generar token de acceso** (empieza con `EAA…`; dura **24 h**) |
| `WHATSAPP_PHONE_NUMBER_ID` | Misma página, debajo del número de prueba: **"Identificador del número de teléfono"** (*Phone number ID*, solo dígitos). **No** es el número ni el "identificador de la cuenta de WhatsApp Business" |
| `WHATSAPP_APP_SECRET` | Menú izquierdo **Configuración de la app → Básica → Clave secreta de la app → Mostrar** (pide tu contraseña) |
| `WHATSAPP_VERIFY_TOKEN` | Lo inventas tú (texto sin espacios); debe ser igual al que pegues en el paso 4 |

```ini
WHATSAPP_PROVIDER=meta
WHATSAPP_TOKEN=EAA...
WHATSAPP_PHONE_NUMBER_ID=1234567890
WHATSAPP_APP_SECRET=xxxxxxxx
WHATSAPP_VERIFY_TOKEN=un-texto-secreto-sin-espacios
WHATSAPP_GRAPH_VERSION=v25.0
DEMO_WHATSAPP_ENCARGADO=591XXXXXXXX   # tu celular (591 + 8 dígitos), para el usuario encargado
```

Después de cambiar `DEMO_WHATSAPP_ENCARGADO` ejecuta `npm run db:seed`, o pon tu número en **Configuración → Usuarios** (usuario encargado, con *Alertas WhatsApp* activado).

> **Token de 24 h:** para la exposición genera uno nuevo ese día, o crea un token permanente: **business.facebook.com → Configuración del negocio → Usuarios del sistema → Agregar** (rol administrador) → **Asignar activos** (la app, control total) → **Generar token** con los permisos `whatsapp_business_messaging` y `whatsapp_business_management`.

## 4. Webhook

1. Arranca el backend (`npm run dev` en `codigo/backend`) y, en otra terminal, el túnel:
   ```powershell
   cloudflared tunnel --url http://localhost:3000
   ```
   Copia la URL `https://…trycloudflare.com` que aparece (cambia cada vez que reinicias el túnel). En producción usa la URL de Render.
2. En Meta: **WhatsApp → Configuración** (*Configuration*) → sección **Webhook** → **Editar**:
   - **URL de devolución de llamada:** `https://<tu-url>/api/webhooks/whatsapp`
   - **Token de verificación:** el mismo `WHATSAPP_VERIFY_TOKEN`
   - **Verificar y guardar.** Meta hace un `GET` con `hub.challenge`; en la consola del backend aparece `[whatsapp:meta] webhook verificado por Meta`.
3. En la misma página, **Campos del webhook → Administrar** → activa **messages** (*Suscribirse*) → **Listo**.

El backend valida la firma `X-Hub-Signature-256` con `WHATSAPP_APP_SECRET` (obligatoria en producción), responde `200` de inmediato y envía la respuesta del agente por la Graph API.

## 5. Prueba

Desde tu WhatsApp, escribe al número de prueba de Meta:

| Mensaje | Respuesta esperada |
|---|---|
| `ayuda` | Lista de lo que puedes hacer según tu perfil (encargado) |
| `regué el lote 2 por 2 horas` → `SI` | Resumen + confirmación → "✅ Registrado" |
| `hoy cosechamos 40 kg de tomate del lote 2` → `SI` | Lote de cosecha con código y enlace del QR |
| `hoy cosechamos 20 kg de cebolla del lote 5` | 🚫 Bloqueado por carencia |
| `¿qué dosis le echo al lote 5?` | ⚠️ No recomienda dosis; deriva al agrónomo |
| `BAJA` / `ALTA` | Quita / da el consentimiento para alertas |

En la consola del backend verás cada mensaje: `[whatsapp:meta] ← 591…: ayuda` y `[whatsapp:meta] → 591…: …`.

## Problemas frecuentes

| Síntoma | Causa y solución |
|---|---|
| "No se pudo validar la URL de devolución de llamada" | El backend o el túnel no están corriendo, la URL no termina en `/api/webhooks/whatsapp`, o el token de verificación no coincide con `WHATSAPP_VERIFY_TOKEN` (reinicia el backend tras editar `.env`) |
| Llega el mensaje pero no hay respuesta y la consola dice `Meta respondió 401` | Token vencido (24 h): genera otro y reinicia el backend |
| `Meta respondió 400 … (#131030) Recipient phone number not in allowed list` | Tu número no está verificado en **"Para"** (paso 2) |
| La consola dice `firma X-Hub-Signature-256 inválida` | `WHATSAPP_APP_SECRET` mal copiado |
| No llega nada al backend | Falta suscribirse al campo **messages**, o cambió la URL del túnel (actualízala en Meta) |
| "Este número no está registrado" | Tu número no está en ningún usuario, trabajador o cliente; revisa `DEMO_WHATSAPP_ENCARGADO` y ejecuta `npm run db:seed` |
| Las alertas automáticas no llegan | Fuera de la ventana de 24 h Meta solo permite **plantillas aprobadas**. Escribe "hola" al número de prueba antes de "Enviar ahora" |

## Diferencias con Twilio

| | Meta Cloud API (usado) | Twilio Sandbox (alternativa) |
|---|---|---|
| Alta | App de Meta; el código de verificación llega por **WhatsApp** | Cuenta de Twilio; exige verificación por **SMS** (no llega a Bolivia) |
| Formato del número | `591…` | `whatsapp:+591…` (se normaliza a `591…`) |
| Firma del webhook | `X-Hub-Signature-256` (HMAC-SHA256, hex) | `X-Twilio-Signature` (HMAC-SHA1, Base64) |
| Respuesta | Llamada a la Graph API | TwiML en la misma petición |
| Costo | Número de prueba gratis; en producción, las conversaciones de servicio iniciadas por el cliente son gratuitas y las plantillas se cobran por mensaje (ver tarifas vigentes de Meta) | Sandbox gratis; luego por mensaje |
