// Páginas públicas que Meta exige para publicar la app de WhatsApp (modo Live):
// política de privacidad y eliminación de datos. HTML estático, sin datos de la base.
import { Router } from 'express';

const pagina = (titulo, cuerpo) => `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titulo} · CRM-Agro</title>
<style>body{font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:760px;margin:2rem auto;padding:0 1rem;line-height:1.6;color:#1f2a1f}
h1{color:#2c5f2d}h2{font-size:1.1rem;margin-top:1.6rem}small{color:#555}</style></head>
<body>${cuerpo}<hr><small>CRM-Agro · Proyecto académico del Grupo Los Pasankallas (UNIFRANZ Sede El Alto, Ingeniería de Sistemas, Hito 5). Última actualización: 26 de noviembre de 2026.</small></body></html>`;

const PRIVACIDAD = pagina('Política de privacidad', `
<h1>Política de privacidad de CRM-Agro</h1>
<p>CRM-Agro es un sistema de gestión para fincas pequeñas desarrollado como proyecto académico. Esta política explica qué datos trata el sistema, incluido su asistente de WhatsApp.</p>
<h2>1. Datos que recopilamos</h2>
<ul>
<li>Número de WhatsApp y nombre de perfil de quien escribe al asistente.</li>
<li>El texto de los mensajes enviados al asistente (registros de campo, cosechas, consultas).</li>
<li>Datos que los usuarios de la finca registran en el sistema: lotes, labores, cosechas, inventario, ventas y clientes.</li>
</ul>
<h2>2. Para qué los usamos</h2>
<ul>
<li>Identificar al usuario, trabajador o cliente registrado y responderle.</li>
<li>Registrar en el sistema los datos que el usuario confirma (respuesta SI/NO).</li>
<li>Enviar alertas de la finca solo a quien dio su consentimiento. Escribiendo <b>BAJA</b> se retira el consentimiento y con <b>ALTA</b> se vuelve a dar.</li>
</ul>
<p>No vendemos ni compartimos los datos con terceros para publicidad. Los mensajes se transmiten mediante la WhatsApp Business Platform de Meta y, si está activado, un proveedor de IA puede procesar el texto únicamente para extraer los datos del registro.</p>
<h2>3. Conservación y seguridad</h2>
<p>Los datos se guardan en la base de datos del sistema con acceso restringido por roles, contraseñas cifradas y conexiones HTTPS. Las fichas públicas de trazabilidad (QR) no muestran datos personales.</p>
<h2>4. Tus derechos y eliminación de datos</h2>
<p>Puedes pedir el acceso, la corrección o la eliminación de tus datos. Consulta <a href="/eliminacion-datos">cómo solicitar la eliminación</a>.</p>
<h2>5. Contacto</h2>
<p>Responsable: Beymar Emilio Poma Queso (Grupo Los Pasankallas), por WhatsApp al número del asistente escribiendo "privacidad", o a través del docente de la asignatura.</p>`);

const ELIMINACION = pagina('Eliminación de datos', `
<h1>Cómo solicitar la eliminación de tus datos</h1>
<ol>
<li>Escribe <b>BAJA</b> al asistente de WhatsApp para dejar de recibir mensajes y alertas.</li>
<li>Escribe "eliminar mis datos" al mismo número, o pide al encargado de la finca que te elimine en <i>Configuración → Usuarios</i> o en <i>Clientes</i>.</li>
<li>Los datos se eliminan en un plazo máximo de 30 días. Los registros agrícolas anonimizados pueden conservarse por trazabilidad.</li>
</ol>
<p><a href="/privacidad">Volver a la política de privacidad</a></p>`);

export const legalRouter = Router();
legalRouter.get(['/privacidad', '/api/privacidad'], (_req, res) => res.type('html').send(PRIVACIDAD));
legalRouter.get(['/eliminacion-datos', '/api/eliminacion-datos'], (_req, res) => res.type('html').send(ELIMINACION));
