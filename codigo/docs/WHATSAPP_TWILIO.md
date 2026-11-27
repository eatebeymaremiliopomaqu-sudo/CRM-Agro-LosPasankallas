# Conectar tu WhatsApp con Twilio (Sandbox) · alternativa

> **En este proyecto se usó Meta WhatsApp Cloud API** (`WHATSAPP_META.md`). Twilio exige verificar la cuenta con un SMS que no llega a números de Bolivia, así que esta guía queda como alternativa para quien sí pueda registrarse (ADR-022). El código de Twilio sigue soportado y probado.

Esta guía conecta **tu celular** con el agente de CRM-Agro usando el **Sandbox de WhatsApp de Twilio** (gratis, para pruebas y la demo).
Al terminar podrás escribirle al número del Sandbox desde tu WhatsApp, registrar labores y cosechas con confirmación SI/NO, hacer consultas, recibir alertas y probar pedidos de clientes.

> Tiempo estimado: 20–30 minutos. Necesitas una cuenta de Twilio (gratuita) y el backend corriendo (en tu PC con un túnel, o en Render).

---

## 0. Cómo funciona

```
Tu WhatsApp ──► Número del Sandbox de Twilio ──► POST /api/webhooks/twilio (tu backend)
                                                     │  valida X-Twilio-Signature
                                                     │  identifica quién escribe (usuario, trabajador, cliente)
                                                     │  agente: interpreta → pide SI/NO → guarda
Tu WhatsApp ◄── Twilio ◄──────────── respuesta TwiML ┘
```

- Las **respuestas** a tus mensajes viajan en la misma petición (TwiML).
- Las **alertas** y los **avisos de tareas** salen por la API REST de Twilio (necesitan `TWILIO_ACCOUNT_SID` y `TWILIO_AUTH_TOKEN`).
- El backend reconoce tu número si está cargado en un **usuario**, **trabajador** o **cliente** de la finca.

---

## 1. Crear la cuenta y activar el Sandbox

1. Entra a <https://www.twilio.com/try-twilio> y crea una cuenta gratuita (verifica tu correo y tu número).
2. En la consola de Twilio ve a **Messaging → Try it out → Send a WhatsApp message**.
3. Verás el número del Sandbox (normalmente **+1 415 523 8886**) y una frase del tipo **`join palabra-palabra`**.
4. Desde tu WhatsApp, envía esa frase exacta (`join palabra-palabra`) a ese número.
5. Twilio te responderá confirmando que te uniste al Sandbox.

> Si dejas de usar el Sandbox por varios días, Twilio puede sacarte: vuelve a enviar `join palabra-palabra`.

## 2. Copiar las credenciales

En la página principal de la consola (**Account Info**) copia:

| Dato de Twilio | Variable en `codigo/backend/.env` |
|---|---|
| Account SID (empieza con `AC…`) | `TWILIO_ACCOUNT_SID` |
| Auth Token (botón "Show") | `TWILIO_AUTH_TOKEN` |
| Número del Sandbox | `TWILIO_WHATSAPP_FROM=whatsapp:+14155238886` |

> **Nunca** subas el `.env` a Git ni pegues el Auth Token en el informe o las diapositivas.

## 3. Registrar tu celular en la finca

El agente solo atiende números conocidos. Tienes dos opciones:

- **Como personal**: entra a la app como `propietario@finca.test` → **Configuración → Usuarios y roles** y pon tu número en el usuario con el que quieres probar (por ejemplo el **encargado**). Formato: `591` + 8 dígitos, sin espacios ni `+` (p. ej. `59170000002`). Para el encargado de la demo también puedes ponerlo en `DEMO_WHATSAPP_ENCARGADO` del `.env` y ejecutar `npm run db:seed`. Activa el interruptor **Alertas WhatsApp** para recibir alertas.
- **Como cliente**: **Ventas → Clientes → editar** un cliente, pon tu número y marca el consentimiento.

> Puedes cambiar de rol para la demo editando el número en otro usuario o cliente.

## 4. Exponer el backend con una URL pública

Twilio necesita una URL **https** que llegue a tu backend. Elige **A (túnel local)** o **B (Render)**.

### A. Túnel local con cloudflared (recomendado, sin cuenta)

1. Descarga `cloudflared` para Windows: <https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/>
2. Con el backend corriendo (`npm run dev` en `codigo/backend`), abre otra terminal y ejecuta:
   ```powershell
   cloudflared tunnel --url http://localhost:3000
   ```
3. Copia la URL que aparece, por ejemplo `https://algo-raro.trycloudflare.com`.
4. Tu webhook será: `https://algo-raro.trycloudflare.com/api/webhooks/twilio`

> La URL de un túnel rápido cambia cada vez que lo reinicias: repite los pasos 5 y 6 si cambia.

**Alternativa con ngrok** (requiere cuenta gratuita en <https://ngrok.com>):
```powershell
ngrok config add-authtoken <tu-token-de-ngrok>
ngrok http 3000
```
Usa la URL `https://….ngrok-free.app/api/webhooks/twilio`.

### B. Backend desplegado en Render

Si ya desplegaste (ver `DESPLIEGUE.md`), tu webhook es:
`https://<servicio>.onrender.com/api/webhooks/twilio`

> El plan gratuito de Render "duerme" tras 15 minutos: antes de la demo abre `https://<servicio>.onrender.com/api/salud` para despertarlo.

## 5. Configurar el webhook en Twilio

1. En la consola: **Messaging → Try it out → Send a WhatsApp message → pestaña Sandbox settings**.
2. En **"When a message comes in"** pega tu URL del paso 4 y elige el método **POST**.
3. Guarda (**Save**).

## 6. Variables de entorno del backend

En `codigo/backend/.env` (en Render: **Environment** del servicio):

```ini
WHATSAPP_PROVIDER=twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
# EXACTAMENTE la misma URL que pegaste en Twilio (se usa para validar la firma)
TWILIO_WEBHOOK_URL=https://algo-raro.trycloudflare.com/api/webhooks/twilio
TWILIO_VALIDAR_FIRMA=true
```

Reinicia el backend. En la consola debe verse `WhatsApp: twilio`. En la app, **Agente y WhatsApp** mostrará la insignia `WhatsApp: twilio`.

## 7. Probar desde tu celular

Escribe al número del Sandbox (como **encargado**):

| Envías | Esperas |
|---|---|
| `ayuda` | Lista de cosas que el agente puede hacer |
| `regué el lote 3 por 2 horas` | "📝 Voy a registrar… ¿Confirmas?" |
| `SI` | "✅ Registrado. Labor #… guardada en L-03" |
| `hoy cosechamos 40 kg de tomate del lote 2` → `SI` | Lote de cosecha con código, enlace del QR y entrada al inventario |
| `hoy cosechamos 20 kg de cebolla del lote 5` | 🚫 Bloqueo: L-05 está en carencia (datos de demo) |
| `¿qué se aplicó en el lote 5 y hasta cuándo es la carencia?` | Lo registrado y la fecha de fin de carencia |
| `¿qué dosis le echo al lote 5?` | ⚠️ Rechazo: no recomienda dosis |
| `labores pendientes` · `stock de frutilla` · `ventas de la semana` · `cuentas por cobrar` | Consultas con datos reales |
| `BAJA` / `ALTA` | Quita o vuelve a dar el consentimiento |

Como **cliente** (tu número en un cliente): `precios`, `quiero 3 cajas de frutilla para el viernes` → `SI`. El pedido aparece en **Ventas → Pedidos** con la insignia *WhatsApp*.

**Alertas:** en **Agente y WhatsApp → Alertas de hoy → Enviar ahora**. También se envían solas todos los días a la hora configurada en **Configuración → WhatsApp y alertas**.

> **Ventana de 24 horas:** en WhatsApp, un negocio solo puede enviarte mensajes libres (alertas, avisos de tareas) dentro de las 24 h siguientes a tu último mensaje. Antes de probar alertas, escribe cualquier cosa al Sandbox. Para producción se usan plantillas aprobadas por Meta.

## 8. Problemas frecuentes

| Síntoma | Causa y solución |
|---|---|
| Twilio no responde nada | Revisa en la consola de Twilio **Monitor → Logs → Errors**. Suele ser la URL del webhook mal copiada o el backend apagado. |
| Error **403 "Firma X-Twilio-Signature inválida"** | `TWILIO_WEBHOOK_URL` no es idéntica a la URL configurada en Twilio (https, sin barra final), o el Auth Token es otro. |
| Error **503 "Falta TWILIO_AUTH_TOKEN"** | Falta la variable en `.env`/Render. |
| "Este número no está registrado" | Tu número no está en ningún usuario/trabajador/cliente, o tiene otro formato. Usa `591` + 8 dígitos, sin `+` ni espacios. |
| "El canal de WhatsApp no está activo" | **Configuración → WhatsApp y alertas →** activa el canal. |
| Las alertas no llegan | Tu usuario no tiene el consentimiento activo, o pasaron más de 24 h desde tu último mensaje al Sandbox. |
| Respuesta tarda la primera vez en Render | El servicio estaba dormido; vuelve a intentar en 1 minuto. |

## 9. Probar sin Twilio

Sin credenciales, `WHATSAPP_PROVIDER=simulado`: todo funciona igual desde **Agente y WhatsApp → Simular WhatsApp**, eligiendo el remitente (usuario, trabajador, cliente o número desconocido). Los mensajes salientes quedan en la **bitácora**.

Para probar el webhook con `curl` en local sin firma (solo desarrollo):
```powershell
# en .env: TWILIO_VALIDAR_FIRMA=false
curl.exe -X POST http://localhost:3000/api/webhooks/twilio -d "From=whatsapp:+59170000002" --data-urlencode "Body=labores pendientes"
```
