import QRCode from 'qrcode';
import { prisma } from '../db.js';
import { config } from '../config.js';
import { codigoLote, tokenPublico } from '../utils/codigos.js';

export const urlPublicaLote = (token) => `${config.frontendUrl.replace(/\/$/, '')}/t/${token}`;

/** Crea un lote de cosecha con código correlativo por finca/año y su primer evento. */
export async function crearLote({ fincaId, siembraId, fechaCosecha, cantidadKg, calidad = 'PRIMERA', destino = null }) {
  const siembra = await prisma.siembra.findFirst({
    where: { id: siembraId, parcela: { fincaId } },
    include: { parcela: { include: { finca: true } } },
  });
  if (!siembra) throw Object.assign(new Error('Siembra no encontrada en esta finca'), { status: 404 });

  const fecha = new Date(fechaCosecha);
  const anio = fecha.getUTCFullYear();
  return prisma.$transaction(async (tx) => {
    const cantidadAnio = await tx.loteCosecha.count({
      where: { siembra: { parcela: { fincaId } }, codigo: { contains: `-${anio}-` } },
    });
    const lote = await tx.loteCosecha.create({
      data: {
        codigo: codigoLote(siembra.parcela.finca.nombre, anio, cantidadAnio + 1),
        siembraId,
        fechaCosecha: fecha,
        cantidadKg,
        calidad,
        destino,
        tokenPublico: tokenPublico(),
        eventos: { create: { tipo: 'COSECHA', fecha, detalle: `Cosecha de ${cantidadKg} kg en ${siembra.parcela.codigo}` } },
      },
    });
    return lote;
  });
}

export async function qrDeLote(lote, formato = 'dataurl') {
  const url = urlPublicaLote(lote.tokenPublico);
  if (formato === 'svg') return QRCode.toString(url, { type: 'svg', margin: 1, color: { dark: '#1F3A2B' } });
  return QRCode.toDataURL(url, { margin: 1, width: 320, color: { dark: '#1F3A2B', light: '#FFFFFF' } });
}
