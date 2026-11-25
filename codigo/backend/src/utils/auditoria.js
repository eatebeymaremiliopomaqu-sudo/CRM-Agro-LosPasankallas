import { prisma } from '../db.js';

/** Registra una acción en la bitácora. Nunca rompe el flujo principal si falla. */
export async function auditar({ usuarioId = null, fincaId = null, accion, entidad, entidadId = null, detalle = null }) {
  try {
    await prisma.auditoria.create({
      data: {
        usuarioId,
        fincaId,
        accion,
        entidad,
        entidadId,
        detalle: detalle ? String(detalle).slice(0, 500) : null,
      },
    });
  } catch (e) {
    console.warn('Auditoría no registrada:', e.message);
  }
}
