# Conectar WhatsApp con Meta (WhatsApp Cloud API)

Alternativa a Twilio. Es la API oficial de Meta; requiere una app de Meta for Developers. Para la demo del curso se recomienda **Twilio** (ver `WHATSAPP_TWILIO.md`); esta guía queda para producción.

## 1. Crear la app

1. Entra a <https://developers.facebook.com/apps> → **Crear app** → tipo **Empresa** (Business).
2. Agrega el producto **WhatsApp** y entra a **WhatsApp → Configuración de la API**.
3. Meta te da un **número de prueba** y un **token temporal** (dura 24 h). Para algo estable, crea un **usuario del sistema** en el Business Manager con un token permanente.
4. En **Para**, agrega tu número (`591` + 8 dígitos) como destinatario de prueba y verifícalo con el código que te llega.

## 2. Variables de entorno

```ini
WHATSAPP_PROVIDER=meta
WHATSAPP_TOKEN=EAAG...            # token de acceso
WHATSAPP_PHONE_NUMBER_ID=1234567890 # "Identificador del número de teléfono"
WHATSAPP_VERIFY_TOKEN=crm-agro-verify   # lo inventas tú; debe coincidir con el paso 3
WHATSAPP_APP_SECRET=xxxxxxxx      # Configuración de la app → Básica → Clave secreta
```

## 3. Webhook

1. Expón el backend con una URL https (túnel `cloudflared tunnel --url http://localhost:3000` o Render).
2. En **WhatsApp → Configuración → Webhook → Editar**:
   - URL de devolución de llamada: `https://<tu-url>/api/webhooks/whatsapp`
   - Token de verificación: el mismo `WHATSAPP_VERIFY_TOKEN`
3. Meta hace un `GET` con `hub.challenge`; el backend responde si el token coincide.
4. Suscríbete al campo **messages**.

El backend valida la firma `X-Hub-Signature-256` con `WHATSAPP_APP_SECRET`, responde `200` de inmediato y envía la respuesta del agente por la Graph API.

## 4. Prueba

Envía `ayuda` desde tu WhatsApp al número de prueba. Los mismos mensajes de la tabla de `WHATSAPP_TWILIO.md` (sección 7) funcionan igual.

## Diferencias con Twilio

| | Twilio Sandbox | Meta Cloud API |
|---|---|---|
| Alta | Minutos, `join palabra` | App de Meta, verificación del negocio para producción |
| Formato del número | `whatsapp:+591…` (se normaliza a `591…`) | `591…` |
| Firma del webhook | `X-Twilio-Signature` (HMAC-SHA1, Base64) | `X-Hub-Signature-256` (HMAC-SHA256, hex) |
| Respuesta | TwiML en la misma petición | Llamada a la Graph API |
| Costo | Sandbox gratis | 1.000 conversaciones de servicio/mes gratis aprox.; luego por conversación (ver tarifas vigentes de Meta) |
