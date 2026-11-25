import { PrismaClient } from '@prisma/client';

// Una sola instancia de Prisma para toda la aplicación.
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

// SQLite: activamos WAL para mejores lecturas concurrentes y claves foráneas.
export async function prepararSqlite() {
  try {
    await prisma.$queryRawUnsafe('PRAGMA journal_mode = WAL;');
    await prisma.$queryRawUnsafe('PRAGMA foreign_keys = ON;');
  } catch (e) {
    console.warn('No se pudieron aplicar PRAGMAs de SQLite:', e.message);
  }
}
