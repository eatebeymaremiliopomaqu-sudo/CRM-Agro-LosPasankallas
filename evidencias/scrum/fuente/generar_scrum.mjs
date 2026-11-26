// Genera product_backlog.csv (importable en Jira/Trello), sprint_backlog_N.md, burndown_sprintN.png y velocidad.png.
// Uso (desde la raíz):  node evidencias/scrum/fuente/generar_scrum.mjs
// IMPORTANTE: los avances diarios del burndown son una PLANTILLA reconstruida a partir del orden de los bloques;
// reemplácenlos con su registro real (columna "real" de AVANCE) antes de entregar.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const dir = path.resolve(aqui, '..');

// [id, módulo, historia, criterios, puntos, prioridad, sprint, épica]
const HISTORIAS = [
  ['HU-01', 'M0', 'Como propietario quiero iniciar sesión con correo y contraseña para acceder de forma segura.', 'JWT de 8 h; mensaje genérico ante error; máx. 10 intentos cada 15 min.', 3, 'Alta', 1, 'Núcleo'],
  ['HU-02', 'M0', 'Como propietario quiero asignar los roles propietario, encargado y trabajador para que cada uno vea solo lo suyo.', 'La API responde 403 sin permiso; la UI oculta menús.', 5, 'Alta', 1, 'Núcleo'],
  ['HU-03', 'M0', 'Como propietario quiero activar o desactivar módulos de mi finca para pagar y usar solo lo que necesito.', 'Tabla ModuloFinca; 403 en rutas de módulos apagados; dependencias M2→M1, M5→M4, M7→M1+M4.', 5, 'Alta', 1, 'Núcleo'],
  ['HU-04', 'M0', 'Como encargado quiero registrar los lotes de la finca en un mapa con su campaña actual.', 'Código único por finca; mapa Leaflet; campaña con cultivo y fecha de siembra.', 5, 'Alta', 1, 'Núcleo'],
  ['HU-05', 'M0', 'Como propietario quiero una bitácora de auditoría para saber quién hizo cada cambio.', 'Se registran altas, cambios, login, agente y cosechas forzadas.', 2, 'Media', 1, 'Núcleo'],
  ['HU-06', 'M1', 'Como encargado quiero un calendario de labores con responsable para organizar la semana.', 'Estados PENDIENTE/HECHA/CANCELADA; al marcar HECHA se crea la labor real.', 5, 'Alta', 1, 'Campo'],
  ['HU-07', 'M1', 'Como encargado quiero registrar aplicaciones con producto, motivo y período de carencia.', 'Se muestra la fecha de fin de carencia; dosis solo como texto de etiqueta.', 5, 'Alta', 1, 'Campo'],
  ['HU-08', 'M1', 'Como propietario quiero que el sistema impida cosechar un lote en carencia.', 'HTTP 409 con mensaje claro; solo el propietario fuerza con justificación (auditada).', 8, 'Alta', 1, 'Campo'],
  ['HU-09', 'M1', 'Como trabajador quiero registrar labores y observaciones desde el celular aunque no tenga señal.', 'Cola offline que sincroniza al volver la red.', 5, 'Media', 1, 'Campo'],
  ['HU-10', 'M4', 'Como encargado quiero que la cosecha sume stock de producto y la venta lo descuente.', 'Movimientos ENTRADA/SALIDA con referencia al lote o a la venta.', 5, 'Alta', 2, 'Inventarios'],
  ['HU-11', 'M4', 'Como encargado quiero ver alertas de stock mínimo de insumos y productos.', 'Insignia en inventario y alerta diaria por WhatsApp.', 3, 'Media', 2, 'Inventarios'],
  ['HU-12', 'M5', 'Como encargado quiero registrar clientes con su consentimiento de WhatsApp.', 'Fecha de consentimiento; baja lógica.', 3, 'Alta', 2, 'Ventas'],
  ['HU-13', 'M5', 'Como encargado quiero registrar pedidos y convertirlos en ventas vinculadas al lote de cosecha.', 'Estados del pedido; detalle con loteCosechaId; valida stock.', 8, 'Alta', 2, 'Ventas'],
  ['HU-14', 'M5', 'Como propietario quiero ver cuentas por cobrar con cobros parciales y vencidos.', 'Saldo por venta y por cliente; vencida a los 7 días.', 5, 'Alta', 2, 'Ventas'],
  ['HU-15', 'M2', 'Como consumidor quiero escanear el QR y ver el origen del producto hasta la venta.', 'Lote → labores → carencia → cosecha → venta; sin datos personales.', 8, 'Alta', 2, 'Trazabilidad'],
  ['HU-16', 'M2', 'Como docente quiero ver la consulta SQL de trazabilidad documentada.', 'Consulta real con parámetro enlazado; misma que en el informe.', 3, 'Media', 2, 'Trazabilidad'],
  ['HU-17', 'M3', 'Como encargado quiero asignar tareas a los trabajadores y avisarles por WhatsApp si aceptaron.', 'Prioridad, lote, fecha límite; aviso solo con consentimiento.', 5, 'Alta', 2, 'Trabajadores'],
  ['HU-18', 'M3', 'Como trabajador quiero ver "Mis tareas" en el celular y marcarlas hechas.', 'Solo sus tareas; funciona sin señal.', 5, 'Alta', 2, 'Trabajadores'],
  ['HU-19', 'WA', 'Como encargado quiero escribir "hoy cosechamos 40 kg de tomate del lote 2" por WhatsApp y que se registre tras mi SI.', 'Twilio o Meta; firma del webhook; carencia validada; QR en la respuesta.', 8, 'Alta', 3, 'WhatsApp + IA'],
  ['HU-20', 'WA', 'Como encargado quiero consultar por WhatsApp pendientes, carencias, stock, ventas y cuentas por cobrar.', 'Solo datos registrados; sin recomendaciones.', 5, 'Alta', 3, 'WhatsApp + IA'],
  ['HU-21', 'WA', 'Como cliente quiero hacer un pedido por WhatsApp ("quiero 3 cajas de frutilla para el viernes").', 'Solo con consentimiento; confirmación SI/NO; aparece en Pedidos.', 5, 'Alta', 3, 'WhatsApp + IA'],
  ['HU-22', 'WA', 'Como trabajador o cliente quiero dar o quitar mi consentimiento con ALTA / BAJA.', 'Se guarda la fecha; nunca se envían alertas sin consentimiento.', 3, 'Alta', 3, 'WhatsApp + IA'],
  ['HU-23', 'WA', 'Como encargado quiero recibir cada mañana alertas de riego, aplicaciones, stock, carencia y cobros.', 'Hora configurable; botón "Enviar ahora"; bitácora.', 5, 'Media', 3, 'WhatsApp + IA'],
  ['HU-24', 'IA', 'Como propietario quiero que el agente nunca recomiende dosis ni productos.', 'Pruebas automatizadas de rechazo; deriva al agrónomo.', 5, 'Alta', 3, 'WhatsApp + IA'],
  ['HU-25', 'M6', 'Como encargado quiero registrar lotes de plantines con germinación, merma y stock.', '% germinación; disponibles = germinadas − merma − vendidos.', 5, 'Media', 3, 'Vivero'],
  ['HU-26', 'M6', 'Como encargado quiero vender plantines desde el módulo de ventas.', 'Descuenta disponibles; AGOTADO al terminar.', 3, 'Media', 3, 'Vivero'],
  ['HU-27', 'M7', 'Como propietario quiero ver el costo, el ingreso y el margen por lote.', 'Labores + jornales + insumos; margen %; filtros por campaña y fechas.', 8, 'Media', 3, 'Finanzas'],
  ['HU-28', 'M7', 'Como propietario quiero exportar el reporte a CSV y verlo en gráficos.', 'CSV con ; para Excel; gráficos accesibles.', 3, 'Baja', 3, 'Finanzas'],
  ['HU-29', 'QA', 'Como equipo queremos pruebas automatizadas con cobertura y CI.', 'Vitest + supertest; ≥ 80 % global; CI en cada push.', 8, 'Alta', 3, 'Calidad'],
  ['HU-30', 'DEV', 'Como equipo queremos desplegar en Vercel y Render con costo mensual justificado.', 'URL pública; variables protegidas; guía paso a paso.', 5, 'Alta', 3, 'Despliegue'],
];

const csvEsc = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
// Columnas compatibles con el importador CSV de Jira (Summary, Description, Story Points, Priority, Sprint, Labels) y Trello
const cab = ['Issue Key', 'Summary', 'Description', 'Issue Type', 'Story Points', 'Priority', 'Sprint', 'Labels', 'Epic', 'Status'];
const prioridadJira = { Alta: 'High', Media: 'Medium', Baja: 'Low' };
const filas = HISTORIAS.map(([id, m, h, c, p, pr, sp, ep]) => [id, h, `Criterios de aceptación: ${c}`, 'Story', p, prioridadJira[pr], `Sprint ${sp}`, m, ep, 'Done']);
fs.writeFileSync(path.join(dir, 'product_backlog.csv'), '\uFEFF' + [cab, ...filas].map((f) => f.map(csvEsc).join(',')).join('\n') + '\n');

// Sprint backlogs: cada historia se divide en tareas técnicas
const TAREAS = {
  1: ['Esquema Prisma: Lote, Campania, ModuloFinca, LaborProgramada, Aplicacion (motivo, dosisEtiqueta)', 'Middleware requiereModulo y matriz RBAC pura', 'Rutas de lotes, campo y calendario', 'utils/carencia.js + 409 y forzado auditado', 'Vistas Lotes, Campo (calendario) y aviso de carencia', 'Pruebas de carencia y RBAC'],
  2: ['Modelos de inventario de productos y ventas', 'Rutas productos, clientes, pedidos, ventas y cobros', 'Ficha pública con ventas anonimizadas y SQL documentada', 'Modelo Tarea, rutas y "Mis tareas"', 'Vistas Ventas (5 pestañas), Trabajadores → tareas', 'Entrada automática al inventario al cosechar'],
  3: ['Proveedor WhatsApp twilio|meta|simulado y webhook firmado', 'Agente: cosecha, tarea hecha, pedido, consultas, políticas por perfil', 'Alertas diarias + bitácora', 'Vivero y reportes de finanzas con CSV', 'Migración a Vitest, pruebas de API y CI', 'Seed de la demo, informe, diapositivas y despliegue'],
};
const AVANCE = {
  // puntos pendientes al final de cada día (10 días hábiles). PLANTILLA: reemplazar por el registro real del equipo.
  // fracción del compromiso que queda pendiente al final de cada día
  1: [1, 0.93, 0.84, 0.77, 0.65, 0.53, 0.42, 0.28, 0.14, 0],
  2: [0.95, 0.89, 0.85, 0.85, 0.7, 0.55, 0.4, 0.24, 0.09, 0],
  3: [0.96, 0.9, 0.82, 0.75, 0.66, 0.52, 0.41, 0.28, 0.15, 0],
};
const velocidad = [];
for (const sp of [1, 2, 3]) {
  const hs = HISTORIAS.filter((h) => h[6] === sp);
  const total = hs.reduce((s, h) => s + h[4], 0);
  velocidad.push({ sprint: sp, comprometido: total, completado: total });
  const md = `# Sprint ${sp} · Sprint backlog

> Fechas, responsables y horas son **plantilla**: complétenlos con su trabajo real (Jira/Trello).

**Objetivo del sprint:** ${['', 'Núcleo modular, roles y control de campo con bloqueo por carencia.', 'Inventario, ventas, cuentas por cobrar, trazabilidad hasta la venta y tareas.', 'WhatsApp real con agente ampliado, alertas, vivero, finanzas, calidad y entrega.'][sp]}
**Rama:** \`sprint-${sp}\` · **Duración:** 2 semanas (10 días hábiles) · **Compromiso:** ${total} puntos

## Historias

| ID | Historia | Puntos | Responsable | Estado |
|---|---|---|---|---|
${hs.map((h) => `| ${h[0]} | ${h[2]} | ${h[4]} | [Integrante] | Hecho |`).join('\n')}

## Tareas técnicas

| Tarea | Estimación (h) | Responsable | Estado |
|---|---|---|---|
${TAREAS[sp].map((t) => `| ${t} | [h] | [Integrante] | Hecho |`).join('\n')}

## Definición de terminado

- Pruebas en verde (backend y frontend) y build del frontend sin errores.
- Swagger actualizado; sin claves en el repositorio.
- Revisado por otro integrante y fusionado en \`sprint-${sp}\`.

![Burndown](burndown_sprint${sp}.png)
`;
  fs.writeFileSync(path.join(dir, `sprint_backlog_${sp}.md`), md);
}

// ── Gráficos (SVG → PNG con Chrome/Edge) ──
const nav = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((n) => fs.existsSync(n));
function png(nombre, svg, w, h) {
  const html = path.join(aqui, `_${nombre}.html`);
  fs.writeFileSync(html, `<!doctype html><meta charset="utf-8"><style>body{margin:0}</style>${svg}`);
  if (nav) execFileSync(nav, ['--headless=new', '--disable-gpu', '--force-device-scale-factor=2', `--screenshot=${path.join(dir, `${nombre}.png`)}`, `--window-size=${w},${h}`, '--hide-scrollbars', `file:///${html.replace(/\\/g, '/')}`], { stdio: 'ignore' });
  fs.unlinkSync(html);
}
const W = 720, H = 380, x0 = 60, y0 = 320, ancho = 620, alto = 250;
for (const sp of [1, 2, 3]) {
  const total = velocidad[sp - 1].comprometido;
  const dias = AVANCE[sp].length;
  const px = (d) => x0 + (d / dias) * ancho;
  const py = (v) => y0 - (v / total) * alto;
  const real = [[0, total], ...AVANCE[sp].map((f, i) => [i + 1, Math.round(f * total)])];
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="Segoe UI, Inter, sans-serif"><rect width="100%" height="100%" fill="#FFFDF8"/>`;
  s += `<text x="20" y="30" font-size="18" font-weight="700" fill="#1F3A2B">Burndown · Sprint ${sp} (${total} puntos)</text>`;
  for (let v = 0; v <= total; v += 10) s += `<line x1="${x0}" x2="${x0 + ancho}" y1="${py(v)}" y2="${py(v)}" stroke="#EFEBE0"/><text x="${x0 - 8}" y="${py(v) + 4}" text-anchor="end" font-size="11" fill="#7B857F">${v}</text>`;
  for (let d = 0; d <= dias; d++) s += `<text x="${px(d)}" y="${y0 + 18}" text-anchor="middle" font-size="11" fill="#7B857F">${d}</text>`;
  s += `<text x="${x0 + ancho / 2}" y="${y0 + 38}" text-anchor="middle" font-size="11.5" fill="#4B564F">día hábil</text>`;
  s += `<line x1="${px(0)}" y1="${py(total)}" x2="${px(dias)}" y2="${py(0)}" stroke="#7B857F" stroke-width="2" stroke-dasharray="6 5"/>`;
  s += `<polyline points="${real.map(([d, v]) => `${px(d)},${py(v)}`).join(' ')}" fill="none" stroke="#1F78B4" stroke-width="2.5"/>`;
  s += real.map(([d, v]) => `<circle cx="${px(d)}" cy="${py(v)}" r="4" fill="#1F78B4" stroke="#FFFDF8" stroke-width="2"/>`).join('');
  s += `<line x1="${x0 + 400}" x2="${x0 + 430}" y1="52" y2="52" stroke="#7B857F" stroke-width="2" stroke-dasharray="6 5"/><text x="${x0 + 436}" y="56" font-size="12" fill="#1D2420">ideal</text>`;
  s += `<line x1="${x0 + 490}" x2="${x0 + 520}" y1="52" y2="52" stroke="#1F78B4" stroke-width="2.5"/><text x="${x0 + 526}" y="56" font-size="12" fill="#1D2420">real (plantilla)</text></svg>`;
  png(`burndown_sprint${sp}`, s, W, H);
}
{
  const max = Math.max(...velocidad.map((v) => v.comprometido));
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="Segoe UI, Inter, sans-serif"><rect width="100%" height="100%" fill="#FFFDF8"/>`;
  s += `<text x="20" y="30" font-size="18" font-weight="700" fill="#1F3A2B">Velocidad del equipo (puntos completados por sprint)</text>`;
  velocidad.forEach((v, i) => {
    const h = (v.completado / max) * 230, x = 120 + i * 190;
    s += `<rect x="${x}" y="${y0 - h}" width="90" height="${h}" rx="4" fill="#1F78B4"/><text x="${x + 45}" y="${y0 - h - 8}" text-anchor="middle" font-size="14" font-weight="700" fill="#1D2420">${v.completado}</text><text x="${x + 45}" y="${y0 + 20}" text-anchor="middle" font-size="12.5" fill="#4B564F">Sprint ${v.sprint}</text>`;
  });
  s += `<line x1="80" x2="680" y1="${y0}" y2="${y0}" stroke="#9AA59E"/><text x="20" y="${H - 14}" font-size="11.5" fill="#7B857F">Promedio: ${Math.round(velocidad.reduce((a, v) => a + v.completado, 0) / 3)} puntos por sprint · Sprint 0 = análisis (sin puntos)</text></svg>`;
  png('velocidad', s, W, H);
}
console.log(`Backlog: ${HISTORIAS.length} historias · ${HISTORIAS.reduce((s, h) => s + h[4], 0)} puntos · velocidad ${velocidad.map((v) => v.completado).join('/')}`);
