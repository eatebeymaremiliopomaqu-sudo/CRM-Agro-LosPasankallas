// En el plan gratuito de Render el disco es efímero: si la BD está vacía al arrancar,
// se cargan los datos ficticios de demostración. Si ya tiene datos, no se toca nada.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const fincas = await prisma.finca.count().catch(() => 0);
await prisma.$disconnect();
if (fincas === 0) {
  console.log('Base de datos vacía: cargando datos de demostración…');
  await import('./seed.js');
} else {
  console.log(`Base de datos con ${fincas} finca(s): no se cargan datos de demostración.`);
}
