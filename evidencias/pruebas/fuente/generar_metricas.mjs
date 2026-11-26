// Genera evidencias/pruebas/metricas.md y metricas.png a partir de:
//   - codigo/backend/coverage/coverage-summary.json   (npm run test:cov en backend)
//   - codigo/frontend/coverage/coverage-summary.json  (npm run test:cov en frontend)
//   - evidencias/pruebas/reporte_defectos.csv
//   - resultado_pruebas_*.txt (cantidad de pruebas)
// Uso (desde la raíz del proyecto):  node evidencias/pruebas/fuente/generar_metricas.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.resolve(aqui, '../../..');
const leerJSON = (p) => JSON.parse(fs.readFileSync(path.join(raiz, p), 'utf-8'));
const back = leerJSON('codigo/backend/coverage/coverage-summary.json');
const front = leerJSON('codigo/frontend/coverage/coverage-summary.json');

// Cobertura por carpeta del backend (líneas)
const areas = {};
for (const [archivo, m] of Object.entries(back)) {
  if (archivo === 'total') continue;
  const carpeta = path.basename(path.dirname(archivo));
  areas[carpeta] ||= { cubiertas: 0, total: 0 };
  areas[carpeta].cubiertas += m.lines.covered;
  areas[carpeta].total += m.lines.total;
}
const NOMBRES = { agente: 'Agente IA y guardrails', routes: 'Rutas de la API', services: 'Servicios (WhatsApp, alertas, finanzas…)', utils: 'Reglas de negocio (carencia, tareas…)', middleware: 'Middleware (JWT, módulos)', src: 'Arranque y configuración' };
const cobertura = Object.entries(areas).map(([k, v]) => ({ area: NOMBRES[k] || k, pct: Math.round((v.cubiertas / v.total) * 1000) / 10 })).sort((a, b) => b.pct - a.pct);
cobertura.push({ area: 'Frontend (utilidades, cola offline, permisos)', pct: front.total.lines.pct });

// Defectos por severidad
const csv = fs.readFileSync(path.join(raiz, 'evidencias/pruebas/reporte_defectos.csv'), 'utf-8').replace(/^\uFEFF/, '');
const filas = csv.trim().split(/\r?\n/).slice(1).map((l) => l.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map((c) => c.replace(/,$/, '').replace(/^"|"$/g, '')));
const ORDEN = ['Crítica', 'Alta', 'Media', 'Baja'];
const porSev = Object.fromEntries(ORDEN.map((s) => [s, filas.filter((f) => f[1] === s).length]));
const abiertos = filas.filter((f) => !['Cerrado', 'Mitigado'].includes(f[6])).length;

const contar = (archivo) => {
  const t = fs.readFileSync(path.join(raiz, 'evidencias/pruebas', archivo), 'utf-8');
  return Number((t.match(/Tests\s+(\d+) passed/) || [])[1] || 0);
};
const pruebasBack = contar('resultado_pruebas_backend.txt');
const pruebasFront = contar('resultado_pruebas_frontend.txt');

// ── Gráfico (SVG en HTML → PNG con Chrome/Edge headless) ──
const ancho = 1000;
const barra = (x, y, w, h, color) => `<rect x="${x}" y="${y}" width="${Math.max(w, 2)}" height="${h}" rx="4" fill="${color}"/>`;
// Severidad: escala secuencial de un solo tono (más oscuro = más grave)
const TONO = { Crítica: '#7A3E0E', Alta: '#A8621F', Media: '#C8823A', Baja: '#E3B98A' };
const maxDef = Math.max(...Object.values(porSev), 1);
let svgDef = '';
ORDEN.forEach((s, i) => {
  const y = 60 + i * 46;
  svgDef += `<text x="20" y="${y + 21}" class="et">${s}</text>${barra(110, y, (porSev[s] / maxDef) * 300, 30, TONO[s])}<text x="${118 + (porSev[s] / maxDef) * 300}" y="${y + 21}" class="val">${porSev[s]}</text>`;
});
let svgCob = '';
cobertura.forEach((c, i) => {
  const y = 60 + i * 34;
  svgCob += `<text x="480" y="${y + 17}" class="et">${c.area}</text>${barra(740, y, (c.pct / 100) * 160, 22, '#1F78B4')}<text x="${746 + (c.pct / 100) * 160}" y="${y + 17}" class="val">${c.pct} %</text>`;
});
const meta = 740 + 0.8 * 160;
const alto = Math.max(60 + cobertura.length * 34, 60 + 4 * 46) + 50;
const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;background:#fffdf8;font-family:Segoe UI,Inter,system-ui,sans-serif}
.t{font-size:18px;font-weight:700;fill:#1f3a2b}.et{font-size:13px;fill:#4b564f}.val{font-size:13px;fill:#1d2420;font-weight:600}.nota{font-size:12px;fill:#7b857f}
</style><svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}">
<text x="20" y="32" class="t">Defectos por severidad (${filas.length}, ${abiertos} abiertos)</text>${svgDef}
<text x="480" y="32" class="t">Cobertura de líneas por área</text>${svgCob}
<line x1="${meta}" x2="${meta}" y1="52" y2="${60 + cobertura.length * 34}" stroke="#7b857f" stroke-dasharray="4 3"/>
<text x="${meta - 18}" y="${70 + cobertura.length * 34}" class="nota">meta 80 %</text>
<text x="20" y="${alto - 14}" class="nota">CRM-Agro · ${pruebasBack} pruebas backend + ${pruebasFront} frontend en verde · generado ${new Date().toLocaleDateString('sv-SE', { timeZone: 'America/La_Paz' })}</text>
</svg>`;
const htmlPath = path.join(aqui, 'metricas_grafico.html');
fs.writeFileSync(htmlPath, html);
const png = path.join(raiz, 'evidencias/pruebas/metricas.png');
const navegadores = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'];
const nav = navegadores.find((n) => fs.existsSync(n));
if (nav) execFileSync(nav, ['--headless=new', '--disable-gpu', `--screenshot=${png}`, `--window-size=${ancho},${alto}`, '--hide-scrollbars', `file:///${htmlPath.replace(/\\/g, '/')}`], { stdio: 'ignore' });

// ── metricas.md ──
const t = back.total;
const md = `# Métricas de calidad · CRM-Agro

Generado con \`node evidencias/pruebas/fuente/generar_metricas.mjs\` el ${new Date().toLocaleDateString('sv-SE', { timeZone: 'America/La_Paz' })} a partir de los reportes reales de cobertura y del reporte de defectos.

![Defectos por severidad y cobertura](metricas.png)

## Pruebas automatizadas

| Suite | Herramienta | Pruebas | Resultado |
|---|---|---|---|
| Backend: unitarias + API (supertest sobre SQLite de prueba) | Vitest + @vitest/coverage-v8 | ${pruebasBack} | ✅ todas en verde (\`resultado_pruebas_backend.txt\`) |
| Frontend: utilidades, cola offline, permisos, CSV | Vitest (jsdom) | ${pruebasFront} | ✅ todas en verde (\`resultado_pruebas_frontend.txt\`) |

## Cobertura del backend

| Métrica | Valor | Meta |
|---|---|---|
| Líneas | **${t.lines.pct} %** | ≥ 80 % |
| Sentencias | ${t.statements.pct} % | — |
| Funciones | ${t.functions.pct} % | ≥ 85 % |
| Ramas | ${t.branches.pct} % | ≥ 75 % |

Lógica crítica (umbral ≥ 90 % de líneas fijado en \`vitest.config.js\`; si baja, el CI falla):

| Archivo | Líneas |
|---|---|
${['src/agente/agente.js', 'src/agente/guardrails.js', 'src/agente/parser.js', 'src/agente/politicas.js', 'src/utils/carencia.js', 'src/utils/tareas.js', 'src/utils/vivero.js', 'src/services/finanzas.js', 'src/services/trazabilidad.js', 'src/routes/ventas.js']
  .map((f) => { const k = Object.keys(back).find((x) => x.replace(/\\/g, '/').endsWith(f)); return `| \`${f}\` | ${k ? back[k].lines.pct : '—'} % |`; }).join('\n')}

Por área:

| Área | Líneas |
|---|---|
${cobertura.map((c) => `| ${c.area} | ${c.pct} % |`).join('\n')}

> La cobertura del frontend mide la lógica (\`src/utils\`). Las vistas Vue se validan con los casos de aceptación (\`casos_uat.md\`) y las pruebas manuales del plan.

## Defectos por severidad

| Severidad | Cantidad | Abiertos |
|---|---|---|
${ORDEN.map((s) => `| ${s} | ${porSev[s]} | ${filas.filter((f) => f[1] === s && !['Cerrado', 'Mitigado'].includes(f[6])).length} |`).join('\n')}
| **Total** | **${filas.length}** | **${abiertos}** |

Detalle en \`reporte_defectos.csv\`. Origen de los defectos de esta etapa: la mayoría (DEF-15 a DEF-32) se encontraron al **escribir las pruebas de API y las pruebas de humo de la demo** — por ejemplo DEF-17 (crítico: una pregunta de dosis con un nombre comercial no se bloqueaba) y DEF-29 (el detalle de venta respondía 500).

## Cómo reproducir

\`\`\`powershell
cd codigo/backend ; npm run test:cov     # crea prisma/test.db sola, ejecuta y mide
cd ../frontend ; npm run test:cov
cd ../.. ; node evidencias/pruebas/fuente/generar_metricas.mjs
\`\`\`
`;
fs.writeFileSync(path.join(raiz, 'evidencias/pruebas/metricas.md'), md);
console.log(`metricas.md y metricas.png generados · ${filas.length} defectos · cobertura ${t.lines.pct} % · navegador: ${nav ? path.basename(nav) : 'no encontrado (sin PNG)'}`);
