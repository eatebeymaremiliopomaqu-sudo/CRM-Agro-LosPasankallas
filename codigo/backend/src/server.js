import { crearApp } from './app.js';
import { config } from './config.js';
import { prisma, prepararSqlite } from './db.js';

await prepararSqlite();
const app = crearApp();

const servidor = app.listen(config.port, () => {
  console.log(`🌱 CRM-Agro API escuchando en http://localhost:${config.port}  ·  docs: /api/docs`);
});

// Cierre ordenado (Render envía SIGTERM al redeployar)
for (const senal of ['SIGINT', 'SIGTERM']) {
  process.on(senal, async () => {
    servidor.close();
    await prisma.$disconnect();
    process.exit(0);
  });
}
