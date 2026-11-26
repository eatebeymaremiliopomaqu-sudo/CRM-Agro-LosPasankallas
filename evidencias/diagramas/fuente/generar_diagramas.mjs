// Genera los diagramas del proyecto como SVG (fuente editable) y PNG (para el informe y las diapositivas).
// Uso (desde la raíz):  node evidencias/diagramas/fuente/generar_diagramas.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const salida = path.resolve(aqui, '..');
const C = { bosque: '#1F3A2B', hoja: '#3E7B4F', brote: '#E7F2DC', tierra: '#C8823A', tierraSuave: '#F6E7D4', papel: '#FFFDF8', linea: '#9AA59E', tinta: '#1D2420', azul: '#1F78B4', azulSuave: '#E1EEF6', gris: '#F1EEE6', rojo: '#C0392B', rojoSuave: '#FBE4E1' };
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function lienzo(ancho, alto, titulo, cuerpo) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}" viewBox="0 0 ${ancho} ${alto}" font-family="Segoe UI, Inter, system-ui, sans-serif">
<defs><marker id="f" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${C.linea}"/></marker>
<marker id="fr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${C.rojo}"/></marker></defs>
<rect width="100%" height="100%" fill="${C.papel}"/>
<text x="24" y="38" font-size="22" font-weight="700" fill="${C.bosque}">${esc(titulo)}</text>
${cuerpo}</svg>`;
}
/** Caja con título y líneas opcionales. */
function caja(x, y, w, h, titulo, lineas = [], { fondo = C.brote, borde = C.hoja, colorTitulo = C.bosque, tam = 13, radio = 10 } = {}) {
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radio}" fill="${fondo}" stroke="${borde}" stroke-width="1.5"/>`;
  s += `<text x="${x + w / 2}" y="${y + 22}" text-anchor="middle" font-size="${tam + 1}" font-weight="700" fill="${colorTitulo}">${esc(titulo)}</text>`;
  lineas.forEach((l, i) => (s += `<text x="${x + w / 2}" y="${y + 42 + i * 17}" text-anchor="middle" font-size="${tam - 1}" fill="${C.tinta}">${esc(l)}</text>`));
  return s;
}
const flecha = (x1, y1, x2, y2, etiqueta = '', { color = C.linea, marca = 'f', guiones = false } = {}) =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="1.8" marker-end="url(#${marca})"${guiones ? ' stroke-dasharray="5 4"' : ''}/>` +
  (etiqueta ? `<text x="${(x1 + x2) / 2 + 6}" y="${(y1 + y2) / 2 - 5}" font-size="11.5" fill="#4B564F">${esc(etiqueta)}</text>` : '');
const poli = (puntos, etiqueta = '', ex = 0, ey = 0) =>
  `<polyline points="${puntos.map((p) => p.join(',')).join(' ')}" fill="none" stroke="${C.linea}" stroke-width="1.8" marker-end="url(#f)"/>` + (etiqueta ? `<text x="${ex}" y="${ey}" font-size="11.5" fill="#4B564F">${esc(etiqueta)}</text>` : '');

// ───────────── 1. Arquitectura modular ─────────────
function arquitectura() {
  let s = '';
  s += caja(30, 70, 220, 80, 'Celular / navegador', ['PWA instalable · sin conexión', 'Propietario · Encargado · Trabajador'], { fondo: C.gris, borde: C.linea });
  s += caja(30, 180, 220, 70, 'WhatsApp', ['Personal de la finca y clientes'], { fondo: C.gris, borde: C.linea });
  s += caja(30, 280, 220, 70, 'Consumidor', ['Escanea el QR del producto'], { fondo: C.gris, borde: C.linea });
  s += caja(300, 70, 230, 80, 'Frontend · Vercel', ['Vue 3 + Vite + Pinia + Router', 'PWA · Leaflet · Chart.js · HTTPS + JWT'], { fondo: C.azulSuave, borde: C.azul });
  s += caja(300, 180, 230, 70, 'Twilio / Meta Cloud API', ['Webhook firmado (HMAC)'], { fondo: C.azulSuave, borde: C.azul });
  // API
  s += `<rect x="580" y="60" width="560" height="470" rx="14" fill="#FFFFFF" stroke="${C.bosque}" stroke-width="2"/>`;
  s += `<text x="860" y="86" text-anchor="middle" font-size="16" font-weight="700" fill="${C.bosque}">Backend · Render (Node.js + Express)</text>`;
  s += caja(600, 100, 520, 50, 'Middleware: Helmet · JWT · RBAC (roles) · requiereModulo() · Zod · auditoría', [], { fondo: C.tierraSuave, borde: C.tierra, tam: 12 });
  const mods = [
    ['M0 Núcleo', 'finca · usuarios · lotes'], ['M1 Campo', 'calendario · carencia'], ['M2 Trazabilidad', 'QR · ficha pública'], ['M3 Trabajadores', 'tareas · jornales'],
    ['M4 Inventarios', 'insumos · productos'], ['M5 Ventas', 'pedidos · cobros'], ['M6 Vivero', 'plantines'], ['M7 Finanzas', 'costos · margen'],
  ];
  mods.forEach(([t, d], i) => (s += caja(600 + (i % 4) * 130, 165 + Math.floor(i / 4) * 80, 120, 68, t, [d], { tam: 12 })));
  s += caja(600, 335, 250, 100, 'Agente IA (transversal)', ['reglas + LLM (Claude/Groq)', 'guardrails: no dosis', 'confirmación SI/NO'], { fondo: C.rojoSuave, borde: C.rojo, tam: 12 });
  s += caja(870, 335, 250, 100, 'Alertas programadas', ['riego · labores · stock mínimo', 'fin de carencia · cobros', 'solo con consentimiento'], { fondo: C.tierraSuave, borde: C.tierra, tam: 12 });
  s += caja(600, 450, 520, 60, 'Prisma ORM · Swagger /api/docs · CI (GitHub Actions)', [], { fondo: C.gris, borde: C.linea, tam: 12 });
  s += caja(1190, 230, 190, 90, 'SQLite', ['30 tablas (3FN)', 'disco de Render'], { fondo: C.tierraSuave, borde: C.tierra });
  s += caja(1190, 360, 190, 70, 'LLM (opcional)', ['Claude o Groq', 'solo extrae datos'], { fondo: C.gris, borde: C.linea });
  s += flecha(250, 110, 298, 110);
  s += flecha(250, 215, 298, 215);
  s += flecha(530, 110, 578, 110);
  s += flecha(530, 215, 578, 215);
  s += poli([[250, 315], [560, 315], [560, 270], [578, 270]], '/t/:token (público)', 300, 308);
  s += flecha(1140, 275, 1188, 275);
  s += flecha(1140, 395, 1188, 395);
  return lienzo(1410, 560, 'Arquitectura modular de CRM-Agro', s);
}

// ───────────── 2. Modelo entidad-relación ─────────────
function modeloER() {
  const W = 168, H = 30;
  const E = {
    Finca: [40, 70], ModuloFinca: [40, 150], Usuario: [40, 230], Auditoria: [40, 310], MensajeWhatsApp: [40, 390], AccionPendiente: [40, 450], BitacoraAlerta: [40, 510],
    Lote: [290, 70], Campania: [290, 170], LaborProgramada: [290, 290], Observacion: [540, 70], Labor: [540, 230], Aplicacion: [540, 310],
    LoteCosecha: [790, 170], EventoTrazabilidad: [790, 70], Insumo: [540, 390], MovimientoInsumo: [540, 470],
    Trabajador: [290, 470], Asistencia: [290, 550], Pago: [100, 600], Tarea: [540, 570],
    ProductoCosechado: [1040, 70], MovimientoProducto: [1040, 150], Cliente: [1040, 270], Pedido: [1040, 370], DetallePedido: [1040, 450],
    Venta: [790, 370], DetalleVenta: [790, 270], Cobro: [790, 470], LotePlantin: [1040, 560],
  };
  const PK = { LoteCosecha: 'codigo, tokenPublico (QR)', Aplicacion: 'producto, motivo, carencia', DetalleVenta: 'loteCosechaId, lotePlantinId', Venta: 'total, pagado, saldo, estado', Tarea: 'trabajador, estado, prioridad' };
  let s = '';
  const centro = (n) => [E[n][0] + W / 2, E[n][1] + H / 2];
  const rel = (a, b, via = []) => {
    const pts = [centro(a), ...via, centro(b)];
    s += `<polyline points="${pts.map((q) => q.join(',')).join(' ')}" fill="none" stroke="${C.linea}" stroke-width="1.3"/>`;
    const [x1, y1] = pts[pts.length - 2], [x2, y2] = pts[pts.length - 1];
    const k = via.length ? 0.35 : 0.3;
    s += `<circle cx="${x2 - (x2 - x1) * k}" cy="${y2 - (y2 - y1) * k}" r="3.2" fill="${C.linea}"/>`;
  };
  [['Finca', 'ModuloFinca'], ['Finca', 'Usuario'], ['Usuario', 'Auditoria'], ['Lote', 'Campania'], ['Lote', 'Observacion'], ['Campania', 'Labor'], ['Labor', 'Aplicacion'], ['Insumo', 'Aplicacion'], ['Insumo', 'MovimientoInsumo'],
    ['LoteCosecha', 'EventoTrazabilidad'], ['LoteCosecha', 'DetalleVenta'], ['Trabajador', 'Asistencia'], ['Trabajador', 'Pago'], ['Trabajador', 'Tarea'], ['Trabajador', 'LaborProgramada'],
    ['ProductoCosechado', 'MovimientoProducto'], ['Cliente', 'Pedido'], ['Pedido', 'DetallePedido'], ['Cliente', 'Venta'], ['Venta', 'DetalleVenta'], ['Venta', 'Cobro'], ['LotePlantin', 'DetalleVenta'], ['MensajeWhatsApp', 'AccionPendiente']].forEach(([a, b]) => rel(a, b));
  rel('Lote', 'LaborProgramada', [[275, 85], [275, 305]]);
  rel('Campania', 'LoteCosecha', [[374, 152], [874, 152]]);
  const RAIZ = ['ModuloFinca', 'Usuario', 'Lote', 'Trabajador', 'Insumo', 'ProductoCosechado', 'Cliente', 'MensajeWhatsApp', 'AccionPendiente', 'BitacoraAlerta', 'LotePlantin'];
  const grupo = { Finca: C.tierraSuave, ModuloFinca: C.tierraSuave, Usuario: C.tierraSuave, Auditoria: C.tierraSuave, MensajeWhatsApp: C.rojoSuave, AccionPendiente: C.rojoSuave, BitacoraAlerta: C.rojoSuave, Insumo: C.azulSuave, MovimientoInsumo: C.azulSuave, ProductoCosechado: C.azulSuave, MovimientoProducto: C.azulSuave, Cliente: '#EDE4F7', Pedido: '#EDE4F7', DetallePedido: '#EDE4F7', Venta: '#EDE4F7', DetalleVenta: '#EDE4F7', Cobro: '#EDE4F7', Trabajador: C.gris, Asistencia: C.gris, Pago: C.gris, Tarea: C.gris, LotePlantin: '#FFF4CC' };
  for (const [n, [x, y]] of Object.entries(E)) {
    s += `<rect x="${x}" y="${y}" width="${W}" height="${H + (PK[n] ? 16 : 0)}" rx="6" fill="${grupo[n] || C.brote}" stroke="${C.bosque}" stroke-width="1.2"/>`;
    s += `<text x="${x + W / 2}" y="${y + 20}" text-anchor="middle" font-size="13" font-weight="700" fill="${C.bosque}">${n}</text>`;
    if (RAIZ.includes(n)) s += `<text x="${x + W - 4}" y="${y - 4}" text-anchor="end" font-size="9.5" fill="${C.tierra}">fincaId</text>`;
    if (PK[n]) s += `<text x="${x + W / 2}" y="${y + 39}" text-anchor="middle" font-size="10.5" fill="#4B564F">${esc(PK[n])}</text>`;
  }
  const ley = [[C.tierraSuave, 'M0 núcleo'], [C.brote, 'M1/M2 campo y trazabilidad'], [C.gris, 'M3 trabajadores'], [C.azulSuave, 'M4 inventarios'], ['#EDE4F7', 'M5 ventas'], ['#FFF4CC', 'M6 vivero'], [C.rojoSuave, 'WhatsApp / agente']];
  ley.forEach(([c, t], i) => (s += `<rect x="${1250}" y="${80 + i * 26}" width="16" height="16" rx="3" fill="${c}" stroke="${C.bosque}"/><text x="${1274}" y="${93 + i * 26}" font-size="12" fill="${C.tinta}">${t}</text>`));
  s += `<text x="1250" y="${290}" font-size="12" fill="#4B564F">Línea con punto = 1 : N</text><text x="1250" y="${308}" font-size="12" fill="#4B564F">(el punto marca el lado N)</text>`;
  s += `<text x="1250" y="${336}" font-size="12" fill="${C.tierra}">"fincaId": pertenece a una</text><text x="1250" y="${354}" font-size="12" fill="${C.tierra}">Finca (1 : N); esas 11 relaciones</text><text x="1250" y="${372}" font-size="12" fill="${C.tierra}">no se dibujan.</text>`;
  return lienzo(1440, 660, 'Modelo entidad-relación (SQLite · Prisma)', s);
}

// ───────────── 3. Flujo del agente ─────────────
function flujoAgente() {
  let s = '';
  const pasos = [
    ['Mensaje entrante', 'WhatsApp (Twilio/Meta) · simulador · chat web', C.gris, C.linea],
    ['¿Quién escribe?', 'usuario (rol) · trabajador · cliente · desconocido', C.azulSuave, C.azul],
    ['ALTA / BAJA', 'consentimiento con fecha (si corresponde)', C.azulSuave, C.azul],
    ['Interpretar', 'reglas en español de campo + LLM opcional (solo extrae JSON)', C.brote, C.hoja],
    ['Límites', 'no dosis · pregunta agronómica → agrónomo · anti-inyección', C.rojoSuave, C.rojo],
    ['Política del perfil', 'trabajador y cliente limitados', C.tierraSuave, C.tierra],
    ['Preparar', 'lote existe · CARENCIA · tarea propia · producto y precio', C.tierraSuave, C.tierra],
    ['Resumen + "¿Confirmas? SI / NO"', 'acción pendiente 10 minutos por remitente', C.brote, C.hoja],
    ['Guardar y responder', 'labor · cosecha (QR + inventario) · tarea · pedido · auditoría', C.brote, C.hoja],
  ];
  pasos.forEach(([t, d, f, b], i) => {
    s += caja(330, 60 + i * 72, 440, 56, t, [d], { fondo: f, borde: b, tam: 13 });
    if (i < pasos.length - 1) s += flecha(550, 116 + i * 72, 550, 130 + i * 72);
  });
  const lado = (i, texto, color = C.rojo) => {
    const y = 88 + i * 72;
    s += flecha(770, y, 840, y, '', { color, marca: 'fr' }) + `<text x="848" y="${y + 4}" font-size="12.5" fill="${color}">${esc(texto)}</text>`;
  };
  lado(1, 'desconocido → mensaje de registro');
  lado(4, 'rechazo: "No puedo recomendar dosis…"');
  lado(5, 'rechazo: acción no permitida');
  lado(6, 'rechazo: "L-05 en carencia hasta…"');
  s += `<text x="70" y="${88 + 7 * 72}" font-size="12.5" fill="${C.bosque}">NO → cancelado,</text><text x="70" y="${104 + 7 * 72}" font-size="12.5" fill="${C.bosque}">no se guarda nada</text>`;
  s += flecha(330, 88 + 7 * 72, 200, 88 + 7 * 72);
  s += `<text x="70" y="${88 + 3 * 72}" font-size="12.5" fill="${C.bosque}">Consultas → solo datos</text><text x="70" y="${104 + 3 * 72}" font-size="12.5" fill="${C.bosque}">registrados (sin SI/NO)</text>`;
  s += flecha(330, 88 + 3 * 72, 236, 88 + 3 * 72);
  return lienzo(1180, 720, 'Flujo del agente de IA (WhatsApp y web)', s);
}

// ───────────── 4. Flujo de la demo: labor → cosecha → QR → inventario → venta ─────────────
function flujoVenta() {
  let s = '';
  const etapas = [
    ['1 · Labor por WhatsApp', ['"regué el lote 2 por 2 h"', '→ SI → Labor (origen WhatsApp)'], 'M1'],
    ['2 · Cosecha', ['"cosechamos 40 kg de tomate', 'del lote 2" → valida carencia'], 'M1/M2'],
    ['3 · Lote de cosecha + QR', ['código FLM-2026-0007', 'token público · eventos'], 'M2'],
    ['4 · Inventario', ['ENTRADA +40 kg', 'producto "Tomate"'], 'M4'],
    ['5 · Venta', ['detalle con loteCosechaId', 'SALIDA −25 kg · cobro / saldo'], 'M5'],
    ['6 · Ficha pública', ['lote → labores → carencia', '→ cosecha → venta (anónima)'], 'M2'],
  ];
  etapas.forEach(([t, l, m], i) => {
    const x = 30 + i * 215;
    s += caja(x, 80, 195, 100, t, l, { tam: 12.5 });
    s += `<text x="${x + 97}" y="200" text-anchor="middle" font-size="12" font-weight="700" fill="${C.tierra}">${m}</text>`;
    if (i < etapas.length - 1) s += flecha(x + 195, 130, x + 213, 130);
  });
  s += caja(245, 240, 410, 70, '✋ Bloqueo por carencia (409)', ['L-05 con aplicación hace 3 días y 14 d de carencia', 'solo el PROPIETARIO puede forzar con justificación'], { fondo: C.rojoSuave, borde: C.rojo, tam: 12.5 });
  s += flecha(300, 182, 380, 238, '', { color: C.rojo, marca: 'fr', guiones: true });
  s += caja(690, 240, 400, 70, '🔒 Privacidad del QR', ['sin nombres, teléfonos, precios ni responsables', 'solo tipo de cliente, fecha y cantidad'], { fondo: C.azulSuave, borde: C.azul, tam: 12.5 });
  s += flecha(1167, 180, 1000, 238, '', { color: C.azul, guiones: true });
  return lienzo(1330, 340, 'Flujo de la demo: labor → cosecha → QR → inventario → venta', s);
}

const diagramas = { arquitectura: arquitectura(), modelo_er: modeloER(), flujo_agente: flujoAgente(), flujo_venta_trazabilidad: flujoVenta() };
const nav = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((n) => fs.existsSync(n));
for (const [nombre, svg] of Object.entries(diagramas)) {
  const svgPath = path.join(aqui, `${nombre}.svg`);
  fs.writeFileSync(svgPath, svg);
  const [, w, h] = svg.match(/width="(\d+)" height="(\d+)"/);
  const html = path.join(aqui, `_${nombre}.html`);
  fs.writeFileSync(html, `<!doctype html><meta charset="utf-8"><style>body{margin:0}</style>${svg}`);
  if (nav) execFileSync(nav, ['--headless=new', '--disable-gpu', '--force-device-scale-factor=2', `--screenshot=${path.join(salida, `${nombre}.png`)}`, `--window-size=${w},${h}`, '--hide-scrollbars', `file:///${html.replace(/\\/g, '/')}`], { stdio: 'ignore' });
  fs.unlinkSync(html);
  console.log(`✓ ${nombre}.svg / .png`);
}
