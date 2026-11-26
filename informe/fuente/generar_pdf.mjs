// Genera informe/Informe_Grupo_LosPasankallas.pdf desde la fuente HTML con Chrome/Edge en modo headless.
// Uso (desde la raíz):  node informe/fuente/generar_pdf.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const fuente = path.join(aqui, 'Informe_Grupo_LosPasankallas.html');
const pdf = path.resolve(aqui, '..', 'Informe_Grupo_LosPasankallas.pdf');
const nav = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((n) => fs.existsSync(n));
if (!nav) throw new Error('No se encontró Chrome ni Edge');
// pathToFileURL codifica el "#" del nombre (%23), si no el navegador lo tomaría como ancla
execFileSync(nav, ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', `--print-to-pdf=${pdf}`, pathToFileURL(fuente).href], { stdio: 'ignore' });
console.log(`PDF generado: ${pdf} (${Math.round(fs.statSync(pdf).size / 1024)} KB)`);
