// Genera ../Diapositivas_Grupo##.pptx (14 láminas, notas del orador para los 3 integrantes).
// Uso:  cd diapositivas/fuente ; npm install ; node generar_diapositivas.js
const fs = require('fs');
const path = require('path');
const pptxgen = require('pptxgenjs');

const RAIZ = path.resolve(__dirname, '..', '..');
const SALIDA = path.resolve(__dirname, '..', 'Diapositivas_Grupo##.pptx');
const IMG = (rel) => path.join(RAIZ, rel);
const tamPNG = (archivo) => { const b = fs.readFileSync(archivo); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }; };
/** Imagen que cabe en la caja (x, y, w, h) manteniendo proporción, centrada. */
function imagen(slide, rel, x, y, w, h, alt) {
  const { w: pw, h: ph } = tamPNG(IMG(rel));
  const k = Math.min(w / pw, h / ph);
  const iw = pw * k, ih = ph * k;
  slide.addImage({ path: IMG(rel), x: x + (w - iw) / 2, y: y + (h - ih) / 2, w: iw, h: ih, altText: alt, objectName: alt });
}

const THEME = {
  name: 'CRM-Agro Tierra y hoja',
  headFontFace: 'Cambria',
  bodyFontFace: 'Calibri',
  colors: { dk1: '1D2420', lt1: 'FFFFFF', dk2: '1F3A2B', lt2: 'EEF4E8', accent1: '3E7B4F', accent2: 'C8823A', accent3: '1F78B4', accent4: '8E5FC2', accent5: 'C0392B', accent6: '8BC34A', hlink: '1F78B4', folHlink: '8E5FC2' },
};
const HEX = { bosque: '1F3A2B', hoja: '3E7B4F', tierra: 'C8823A', azul: '1F78B4', violeta: '8E5FC2', rojo: 'C0392B', gris: '4B564F', grilla: 'E4DFD2', claro: 'EEF4E8' };

const pres = new pptxgen();
pres.layout = 'LAYOUT_16x9'; // 10 × 5.625 in
pres.title = 'CRM-Agro · Exposición final';
pres.author = 'Grupo [NÚMERO]';
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
const C = pres.SchemeColor;

// ── Layouts ──
pres.defineSlideMaster({
  title: 'PORTADA',
  background: { color: C.text2 },
  objects: [
    { placeholder: { options: { name: 'title', type: 'title', x: 0.6, y: 1.5, w: 8.8, h: 1.2, fontSize: 44, bold: true, color: C.background1, align: 'left', valign: 'bottom' }, text: '' } },
    { placeholder: { options: { name: 'body', type: 'body', x: 0.6, y: 2.8, w: 8.8, h: 1.6, fontSize: 18, color: C.background2, align: 'left', valign: 'top' }, text: '' } },
  ],
});
pres.defineSlideMaster({
  title: 'OSCURO',
  background: { color: C.text2 },
  objects: [
    { placeholder: { options: { name: 'title', type: 'title', x: 0.6, y: 0.35, w: 8.8, h: 0.8, fontSize: 34, bold: true, color: C.background1, align: 'left', valign: 'middle' }, text: '' } },
    { text: { text: 'CRM-Agro · Grupo [NÚMERO]', options: { x: 0.6, y: 5.2, w: 5, h: 0.3, fontSize: 10, color: C.background2 } } },
  ],
  slideNumber: { x: 9.1, y: 5.2, w: 0.5, h: 0.3, fontSize: 10, color: 'EEF4E8' },
});
pres.defineSlideMaster({
  title: 'CONTENIDO',
  background: { color: C.background1 },
  objects: [
    { placeholder: { options: { name: 'title', type: 'title', x: 0.5, y: 0.25, w: 9, h: 0.7, fontSize: 30, bold: true, color: C.text2, align: 'left', valign: 'middle' }, text: '' } },
    { text: { text: 'CRM-Agro · Grupo [NÚMERO]', options: { x: 0.5, y: 5.25, w: 5, h: 0.28, fontSize: 10, color: C.text1 } } },
  ],
  slideNumber: { x: 9.1, y: 5.25, w: 0.5, h: 0.28, fontSize: 10, color: '4B564F' },
});

let seccionActual = '';
function lamina(seccion, layout, titulo, notas) {
  if (seccion !== seccionActual) { pres.addSection({ title: seccion }); seccionActual = seccion; }
  const s = pres.addSlide({ masterName: layout, sectionTitle: seccion });
  s.addText(titulo, { placeholder: 'title' });
  s.addNotes(notas);
  return s;
}
/** Tarjeta: rectángulo redondeado con título y texto. */
function tarjeta(s, x, y, w, h, titulo, texto, { fondo = C.background2, colorTitulo = C.text2, colorTexto = C.text1, tamTexto = 13, nombre } = {}) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.08, fill: { color: fondo }, line: { color: fondo }, objectName: `${nombre || titulo} (tarjeta)` });
  s.addText([
    { text: titulo, options: { bold: true, fontSize: tamTexto + 2, color: colorTitulo, breakLine: true } },
    { text: texto, options: { fontSize: tamTexto, color: colorTexto } },
  ], { x: x + 0.12, y: y + 0.08, w: w - 0.24, h: h - 0.16, valign: 'top', isTextBox: true, paraSpaceAfter: 4, objectName: `${nombre || titulo} (texto)` });
}
/** Número grande con rótulo. */
function cifra(s, x, y, w, valor, rotulo, color = C.accent1) {
  s.addText(valor, { x, y, w, h: 0.8, fontSize: 40, bold: true, color, isTextBox: true, margin: 0, fontFace: THEME.headFontFace, objectName: `Cifra ${rotulo}` });
  s.addText(rotulo, { x, y: y + 0.8, w, h: 0.6, fontSize: 13, color: C.text1, isTextBox: true, margin: 0, valign: 'top', objectName: `Rótulo ${rotulo}` });
}
const ejeGrafico = { catAxisLabelColor: HEX.gris, valAxisLabelColor: HEX.gris, catAxisLabelFontFace: '+mn-lt', valAxisLabelFontFace: '+mn-lt', dataLabelFontFace: '+mn-lt', titleFontFace: '+mn-lt', catAxisLabelFontSize: 11, valAxisLabelFontSize: 10, dataLabelFontSize: 11, dataLabelColor: HEX.bosque, valGridLine: { color: HEX.grilla, size: 0.75 }, catGridLine: { style: 'none' } };

// 1 · Portada
{
  pres.addSection({ title: 'Inicio' }); seccionActual = 'Inicio';
  const s = pres.addSlide({ masterName: 'PORTADA', sectionTitle: 'Inicio' });
  s.addText('CRM-Agro', { placeholder: 'title' });
  s.addText([
    { text: 'CRM modular y de bajo costo para fincas pequeñas, con agente de IA por WhatsApp', options: { breakLine: true } },
    { text: 'Grupo [NÚMERO] · [Nombre 1] · [Nombre 2] · [Nombre 3]', options: { fontSize: 14, breakLine: true } },
    { text: 'UNIFRANZ El Alto · [Asignatura] · Docente: [Nombre]', options: { fontSize: 14 } },
  ], { placeholder: 'body' });
  s.addNotes('[Integrante 1] (30 s): Buenos días. Somos el grupo [número]. Presentamos CRM-Agro, un CRM para fincas pequeñas de frutas, hortalizas y vivero, que se usa desde el celular y desde WhatsApp. Todos los datos que verán son ficticios.');
}

// 2 · Problema
{
  const s = lamina('Problema y solución', 'CONTENIDO', 'El problema: la finca se maneja en cuadernos', '[Integrante 1] (1 min): Entrevistamos (de forma simulada) a Don Hilario, encargado de una finca de 6,5 ha en Comarapa. Anota todo en cuadernos y en el grupo de WhatsApp; la información se pierde. A veces se cosechó antes de que termine la carencia de un fungicida. El supermercado le pide una etiqueta de origen, y no sabe si cada lote le deja ganancia.');
  cifra(s, 0.6, 1.3, 2.7, '6,5 ha', 'finca ficticia de Comarapa con 8 trabajadores y vivero');
  cifra(s, 3.65, 1.3, 2.7, '0', 'registros digitales: cuadernos y chats que se pierden', C.accent2);
  cifra(s, 6.7, 1.3, 2.7, '1 jornal', 'es lo máximo que pagaría al mes por un sistema', C.accent3);
  tarjeta(s, 0.6, 3.3, 2.7, 1.25, 'Carencia', 'Cosechas dentro del período de carencia de un agroquímico', { nombre: 'Problema carencia' });
  tarjeta(s, 3.65, 3.3, 2.7, 1.25, 'Trazabilidad', 'Compradores piden saber el origen del producto', { nombre: 'Problema trazabilidad' });
  tarjeta(s, 6.7, 3.3, 2.7, 1.25, 'Rentabilidad', 'No se sabe qué lote deja ganancia', { nombre: 'Problema rentabilidad' });
}

// 3 · Solución
{
  const s = lamina('Problema y solución', 'CONTENIDO', 'La solución: un CRM que crece por módulos', '[Integrante 1] (1 min): CRM-Agro empieza con lo esencial y la finca activa módulos cuando los necesita. Se usa en el celular aun sin señal y por WhatsApp. El agente de IA convierte mensajes en registros, pero siempre pide confirmación y nunca recomienda dosis: eso lo decide el agrónomo.');
  tarjeta(s, 0.5, 1.2, 2.85, 2.55, 'Modular', 'Ocho módulos (M0–M7) que se encienden por finca. Si un módulo está apagado, la API responde 403.\n\nPagas y usas solo lo que necesitas.', { nombre: 'Solución modular' });
  tarjeta(s, 3.575, 1.2, 2.85, 2.55, 'En el celular', 'PWA instalable que funciona sin señal: las labores, tareas y cosechas se guardan y se envían al volver la conexión.', { nombre: 'Solución celular' });
  s.addText([{ text: 'Un solo flujo: ', options: { bold: true, color: C.text2 } }, { text: 'labor → cosecha → QR → inventario → venta, con la carencia respetada en cada paso.' }], { x: 0.5, y: 4.05, w: 9, h: 0.7, fontSize: 16, color: C.text1, isTextBox: true, objectName: 'Flujo único' });
  tarjeta(s, 6.65, 1.2, 2.85, 2.55, 'Por WhatsApp', '"hoy cosechamos 40 kg de tomate del lote 2" → resumen → SI → registrado con QR.\n\nNunca recomienda dosis.', { nombre: 'Solución WhatsApp' });
}

// 4 · Arquitectura
{
  const s = lamina('Arquitectura', 'CONTENIDO', 'Arquitectura modular de bajo costo', '[Integrante 2] (1 min): El frontend es Vue 3 como PWA en Vercel; el backend es Node.js con Express y Prisma en Render, con SQLite para no pagar un servidor de base de datos. Cada módulo es un router protegido por JWT, roles y el middleware requiereModulo. WhatsApp entra por Twilio o Meta con firma verificada. El agente y las alertas son transversales.');
  imagen(s, 'evidencias/diagramas/arquitectura.png', 0.5, 1.05, 9, 3.95, 'Diagrama de arquitectura');
}

// 5 · Módulos
{
  const s = lamina('Arquitectura', 'CONTENIDO', 'Ocho módulos, activables por finca', '[Integrante 2] (1 min): M0 es el núcleo con roles propietario, encargado y trabajador. M1 controla el campo con calendario y bloqueo por carencia. M2 genera el QR con la historia hasta la venta. M3 gestiona trabajadores y sus tareas. M4 inventarios, M5 ventas y cuentas por cobrar. Implementamos los dos opcionales: M6 vivero y M7 finanzas con margen por lote.');
  const mods = [
    ['M0 Núcleo', 'Roles, lotes, campañas, módulos'], ['M1 Campo', 'Calendario, carencia, cosecha'], ['M2 Trazabilidad', 'QR hasta la venta'], ['M3 Trabajadores', 'Tareas, asistencia, jornales'],
    ['M4 Inventarios', 'Insumos y productos'], ['M5 Ventas', 'Pedidos, cobros, cuentas'], ['M6 Vivero', 'Germinación y plantines'], ['M7 Finanzas', 'Costo, margen, CSV'],
  ];
  mods.forEach(([t, d], i) => tarjeta(s, 0.5 + (i % 4) * 2.3, 1.25 + Math.floor(i / 4) * 1.75, 2.1, 1.5, t, d, { fondo: i >= 6 ? 'F6E7D4' : C.background2, nombre: t }));
}

// 6 · Demo
{
  const s = lamina('Demo', 'CONTENIDO', 'Demo: de WhatsApp a la venta', '[Integrante 3] (2,5 min, demo en vivo): 1) Desde el celular escribimos "regué el lote 2 por 2 horas" y respondemos SI. 2) "hoy cosechamos 40 kg de tomate del lote 2": el sistema verifica la carencia, genera el lote de cosecha con QR y suma 40 kg al inventario. 3) Abrimos el QR: labores, aplicaciones y carencia respetada. 4) En Inventarios vemos el stock. 5) Registramos la venta vinculada al lote y el QR ya la muestra, sin datos del cliente. 6) Intentamos cosechar el lote 5: bloqueado por carencia. Si falla internet, usamos el simulador de WhatsApp.');
  imagen(s, 'evidencias/diagramas/flujo_venta_trazabilidad.png', 0.5, 1.05, 9, 2.5, 'Flujo de la demo');
  s.addText([
    { text: 'Plan B sin internet: ', options: { bold: true, color: C.text2 } },
    { text: 'el mismo flujo con "Simular WhatsApp" y los datos de demostración (npm run db:seed).', options: { color: C.text1 } },
  ], { x: 0.5, y: 3.8, w: 9, h: 0.6, fontSize: 14, isTextBox: true, objectName: 'Plan B demo' });
  s.addText('Usuarios: encargado@finca.test · propietario@finca.test · trabajador@finca.test (clave Agro2026!)', { x: 0.5, y: 4.4, w: 9, h: 0.45, fontSize: 12, color: C.text1, isTextBox: true, objectName: 'Usuarios demo' });
}

// 7 · Agente
{
  const s = lamina('Agente y WhatsApp', 'CONTENIDO', 'Agente de IA con límites que se prueban', '[Integrante 3] (1,5 min): Cada mensaje pasa por: identificar quién escribe, consentimiento ALTA o BAJA, interpretar con reglas y opcionalmente un LLM que solo extrae datos, límites, política del perfil y una preparación que valida carencia y tareas. Recién entonces muestra el resumen y pide SI o NO. Si alguien pregunta qué dosis echar, responde que eso lo decide el agrónomo. Hay pruebas automáticas de cada límite.');
  imagen(s, 'evidencias/diagramas/flujo_agente.png', 0.4, 1.0, 4.9, 4.1, 'Flujo del agente');
  tarjeta(s, 5.5, 1.05, 4.0, 1.25, 'Siempre confirma', 'Resumen + "¿Confirmas? SI / NO". Vence a los 10 minutos.', { nombre: 'Agente confirma' });
  tarjeta(s, 5.5, 2.45, 4.0, 1.25, 'Nunca recomienda dosis', 'Solo muestra la dosis de etiqueta registrada; deriva al agrónomo.', { fondo: 'FBE4E1', colorTitulo: C.accent5, nombre: 'Agente no dosis' });
  tarjeta(s, 5.5, 3.85, 4.0, 1.25, 'Según quién escribe', 'Trabajador: sus tareas. Cliente: precios y pedidos. Desconocido: nada.', { nombre: 'Agente perfiles' });
}

// 8 · Seguridad y ética
{
  const s = lamina('Agente y WhatsApp', 'CONTENIDO', 'Seguridad y ética desde el diseño', '[Integrante 2] (1 min): La carencia se respeta en la web, en WhatsApp y al vender; solo el propietario puede forzar, con justificación que queda en auditoría. El QR es público, por eso no muestra nombres, teléfonos ni precios. Nadie recibe mensajes automáticos sin haber aceptado con ALTA. Y los webhooks verifican la firma de Twilio y de Meta.');
  const filas = [
    ['Carencia', 'Bloqueo 409 al cosechar o vender; forzado auditado del propietario'],
    ['Consentimiento', 'ALTA / BAJA con fecha para trabajadores, usuarios y clientes'],
    ['Privacidad del QR', 'Solo tipo de cliente, fecha y cantidad; token aleatorio'],
    ['Acceso', 'JWT, roles en la API, límite de intentos, auditoría'],
    ['Webhooks', 'Firma X-Twilio-Signature y X-Hub-Signature-256'],
  ];
  s.addTable(filas.map(([a, b]) => [{ text: a, options: { bold: true, color: HEX.bosque } }, { text: b }]), { x: 0.5, y: 1.2, w: 9, colW: [2.4, 6.6], fontSize: 15, rowH: 0.6, border: { type: 'solid', pt: 0.75, color: HEX.grilla }, fill: { color: 'FFFFFF' }, valign: 'middle', objectName: 'Tabla seguridad' });
}

// 9 · Base de datos
{
  const s = lamina('Datos', 'CONTENIDO', 'Base de datos: 30 tablas en 3FN', '[Integrante 2] (1 min): Usamos SQLite con Prisma. La jerarquía principal es finca, lote, campaña, labor y aplicación; y del otro lado lote de cosecha, detalle de venta y venta. Normalizamos hasta tercera forma normal: por ejemplo, los módulos activos pasaron de un JSON a la tabla ModuloFinca. La consulta clave de trazabilidad se ejecuta de verdad con parámetros y está documentada en el informe.');
  imagen(s, 'evidencias/diagramas/modelo_er.png', 0.4, 1.0, 6.3, 4.1, 'Modelo entidad-relación');
  s.addText([
    { text: '1FN: módulos en filas (ModuloFinca), detalles de pedido y venta', options: { bullet: true, breakLine: true } },
    { text: '3FN: cultivo en Campania, jornal en Trabajador, costo en Insumo', options: { bullet: true, breakLine: true } },
    { text: 'Consulta de trazabilidad con parámetro "?"', options: { bullet: true } },
  ], { x: 6.85, y: 1.2, w: 2.75, h: 3.8, fontSize: 14, color: C.text1, valign: 'top', paraSpaceAfter: 8, isTextBox: true, objectName: 'Normalización' });
}

// 10 · SCRUM
{
  const s = lamina('Proceso y calidad', 'CONTENIDO', 'SCRUM: Sprint 0 y tres sprints', '[Integrante 1] (1 min): Sprint 0 fue análisis: la entrevista, el backlog de 30 historias y el modelo de datos. Sprint 1 hizo el núcleo y el campo con carencia; Sprint 2 ventas, trazabilidad y tareas; Sprint 3 WhatsApp, agente, vivero, finanzas y calidad. Cada sprint tuvo su rama, dailies, review y retrospectiva. La velocidad creció porque el núcleo ya estaba listo.');
  s.addChart(pres.charts.BAR, [{ name: 'Puntos completados', labels: ['Sprint 1', 'Sprint 2', 'Sprint 3'], values: [43, 45, 63] }], {
    x: 0.5, y: 1.1, w: 5.2, h: 3.9, barDir: 'col', chartColors: [HEX.hoja], showValue: true, dataLabelPosition: 'outEnd', showLegend: false, showTitle: true, title: 'Velocidad (puntos por sprint)', titleFontSize: 13, titleColor: HEX.bosque, ...ejeGrafico, objectName: 'Gráfico velocidad',
  });
  s.addText([
    { text: 'Sprint 0: ', options: { bold: true } }, { text: 'entrevista, backlog, modelo ER', options: { breakLine: true } },
    { text: 'Sprint 1: ', options: { bold: true } }, { text: 'núcleo, roles, campo, carencia', options: { breakLine: true } },
    { text: 'Sprint 2: ', options: { bold: true } }, { text: 'inventario, ventas, QR, tareas', options: { breakLine: true } },
    { text: 'Sprint 3: ', options: { bold: true } }, { text: 'WhatsApp, agente, M6, M7, pruebas' },
  ], { x: 6.0, y: 1.2, w: 3.5, h: 3.7, fontSize: 14, color: C.text1, paraSpaceAfter: 10, valign: 'top', isTextBox: true, objectName: 'Resumen sprints' });
}

// 11 · Calidad
{
  const s = lamina('Proceso y calidad', 'CONTENIDO', 'Calidad medida, no supuesta', '[Integrante 3] (1,5 min): Tenemos 249 pruebas en el backend con Vitest, incluidas pruebas de API con supertest sobre una base de prueba que se crea sola, y 14 en el frontend. La cobertura de líneas es 96 %, y el CI exige al menos 90 % en la lógica crítica. Registramos 32 defectos; tres críticos, como una pregunta de dosis con nombre comercial que no se bloqueaba: lo encontraron las pruebas de API y lo corregimos. Además hicimos 8 pruebas de aceptación con Don Hilario, nuestro usuario simulado.');
  cifra(s, 0.5, 1.2, 2.2, '263', 'pruebas automatizadas (Vitest)');
  cifra(s, 0.5, 2.6, 2.2, '96 %', 'cobertura de líneas del backend', C.accent3);
  cifra(s, 0.5, 4.0, 2.2, '8 / 8', 'casos UAT aceptados', C.accent2);
  s.addChart(pres.charts.BAR, [{ name: 'Defectos', labels: ['Crítica', 'Alta', 'Media', 'Baja'], values: [3, 11, 11, 7] }], {
    x: 3.0, y: 1.1, w: 6.5, h: 3.9, barDir: 'bar', chartColors: [HEX.tierra], showValue: true, dataLabelPosition: 'outEnd', showLegend: false, showTitle: true, title: '32 defectos por severidad (todos cerrados o mitigados)', titleFontSize: 13, titleColor: HEX.bosque, catAxisOrientation: 'maxMin', ...ejeGrafico, objectName: 'Gráfico defectos',
  });
}

// 12 · Despliegue y costos
{
  const s = lamina('Proceso y calidad', 'CONTENIDO', 'Despliegue y costo mensual', '[Integrante 2] (1 min): El frontend está en Vercel y la API con SQLite en Render, con CI en GitHub Actions. Para la demo todo es gratis. En producción para una finca estimamos entre 11 y 16 dólares al mes, menos que un jornal: Render Starter con disco, WhatsApp por mensaje y el LLM es opcional porque el agente funciona con reglas.');
  const filas = [['Servicio', 'Demo', 'Producción'], ['Vercel (frontend PWA)', 'US$ 0', 'US$ 0'], ['Render (API + SQLite)', 'US$ 0', '≈ US$ 7,25'], ['WhatsApp (Twilio)', 'Sandbox US$ 0', '≈ US$ 3–6'], ['LLM (opcional)', 'US$ 0 (reglas)', 'US$ 0–2'], ['Total', 'US$ 0', '≈ US$ 11–16 / mes']];
  s.addTable(filas.map((f, i) => f.map((t) => ({ text: t, options: i === 0 || i === filas.length - 1 ? { bold: true, color: HEX.bosque, fill: { color: HEX.claro } } : {} }))), { x: 0.5, y: 1.2, w: 5.8, colW: [2.5, 1.5, 1.8], fontSize: 14, rowH: 0.52, border: { type: 'solid', pt: 0.75, color: HEX.grilla }, valign: 'middle', objectName: 'Tabla costos' });
  cifra(s, 6.7, 1.3, 2.8, '< 1 jornal', 'al mes en producción (≈ Bs 77–112)');
  s.addText('Guía paso a paso: codigo/docs/DESPLIEGUE.md', { x: 6.7, y: 3.0, w: 2.8, h: 0.9, fontSize: 13, color: C.text1, isTextBox: true, margin: 0, objectName: 'Guía despliegue' });
}

// 13 · Aprendizajes
{
  const s = lamina('Cierre', 'OSCURO', 'Aprendizajes', '[Integrante 1, 2 y 3] (1 min, una idea cada uno): Primero, un agente seguro es más diseño que IA: el LLM solo extrae datos; la confirmación, la carencia y los permisos los controla el código. Segundo, las pruebas de API encontraron defectos críticos que las unitarias no veían. Tercero, la privacidad se diseña: el QR es público. Cuarto, modularidad real es que la API responda 403, no solo esconder un menú.');
  const ideas = [
    ['Un agente seguro es más código que IA', 'El LLM solo extrae datos; confirmar, carencia y permisos los decide el sistema.'],
    ['Las pruebas de API encuentran lo que no ves', 'Detectaron 3 de los defectos más graves.'],
    ['La privacidad se diseña', 'El QR es público: nada personal entra en la ficha.'],
    ['Modular de verdad', 'Módulo apagado = API 403, no solo un menú oculto.'],
  ];
  ideas.forEach(([t, d], i) => tarjeta(s, 0.6 + (i % 2) * 4.5, 1.4 + Math.floor(i / 2) * 1.75, 4.2, 1.45, t, d, { fondo: '2B5039', colorTitulo: 'FFFFFF', colorTexto: 'EEF4E8', tamTexto: 14, nombre: `Aprendizaje ${i + 1}` }));
}

// 14 · Conclusión
{
  const s = lamina('Cierre', 'OSCURO', 'Conclusión y próximos pasos', '[Integrante 3] (45 s): CRM-Agro cubre M0 a M7, el flujo completo de la guía y un agente por WhatsApp que no recomienda dosis. Los próximos pasos son notas de voz, entender números escritos en letras y plantillas aprobadas de WhatsApp para alertas. Gracias; quedamos atentos a sus preguntas.');
  s.addText([
    { text: 'M0–M7 funcionando y activables por finca', options: { bullet: true, breakLine: true } },
    { text: 'Labor por WhatsApp → cosecha → QR → inventario → venta', options: { bullet: true, breakLine: true } },
    { text: 'Agente con confirmación SI/NO y sin recomendar dosis', options: { bullet: true, breakLine: true } },
    { text: 'Próximo: notas de voz, "lote dos" en letras, plantillas de WhatsApp', options: { bullet: true } },
  ], { x: 0.6, y: 1.35, w: 8.8, h: 2.6, fontSize: 18, color: 'FFFFFF', paraSpaceAfter: 10, valign: 'top', isTextBox: true, objectName: 'Conclusiones' });
  s.addText('¡Gracias! ¿Preguntas?', { x: 0.6, y: 4.1, w: 8.8, h: 0.8, fontSize: 30, bold: true, color: 'EEF4E8', fontFace: THEME.headFontFace, isTextBox: true, objectName: 'Gracias' });
}

(async () => {
  await pres.writeFile({ fileName: SALIDA });
  const { applyTheme } = require(process.env.APPLY_THEME || path.join(__dirname, 'apply_theme.js'));
  await applyTheme(SALIDA, THEME);
  console.log(`Generado: ${SALIDA}`);
})();
