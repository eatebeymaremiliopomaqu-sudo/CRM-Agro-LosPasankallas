// Se ejecuta una vez antes de todas las pruebas: crea prisma/test.db desde cero y carga los datos ficticios.
import { execSync } from 'node:child_process';
import { ENV_PRUEBAS } from '../../vitest.config.js';

export default function setup() {
  const env = { ...process.env, ...ENV_PRUEBAS };
  const opciones = { env, stdio: 'pipe', cwd: new URL('../..', import.meta.url) };
  execSync('npx prisma db push --force-reset --skip-generate --accept-data-loss', opciones);
  execSync('node prisma/seed.js', opciones);
}
