import QRCode from 'qrcode';
import { prisma } from '../db.js';
import { config } from '../config.js';
import { codigoLote, tokenPublico } from '../utils/codigos.js';

export const urlPublicaLote = (token) => `${config.frontendUrl.replace(/\/$/, '')}/t/${token}`;

/** Crea un lote de cosecha con código correlativo por finca/año y su primer evento. */
export async function crearLote({ fincaId, campaniaId, fechaCosecha, cantidadKg, calidad = 'PRIMERA', destino = null }) {
  const campania = await prisma.campania.findFirst({
    where: { id: campaniaId, lote: { fincaId } },
    include: { lote: { include: { finca: true } } },
  });
  if (!campania) throw Object.assign(new Error('Campaña no encontrada en esta finca'), { status: 404 });

  const fecha = new Date(fechaCosecha);
  const anio = fecha.getUTCFullYear();
  return prisma.$transaction(async (tx) => {
    const cantidadAnio = await tx.loteCosecha.count({
      where: { campania: { lote: { fincaId } }, codigo: { contains: `-${anio}-` } },
    });
    const loteCosecha = await tx.loteCosecha.create({
      data: {
        codigo: codigoLote(campania.lote.finca.nombre, anio, cantidadAnio + 1),
        campaniaId,
        fechaCosecha: fecha,
        cantidadKg,
        calidad,
        destino,
        tokenPublico: tokenPublico(),
        eventos: { create: { tipo: 'COSECHA', fecha, detalle: `Cosecha de ${cantidadKg} kg en ${campania.lote.codigo}` } },
      },
    });
    return loteCosecha;
  });
}

export async function qrDeLote(loteCosecha, formato = 'dataurl') {
  const url = urlPublicaLote(loteCosecha.tokenPublico);
  if (formato === 'svg') return QRCode.toString(url, { type: 'svg', margin: 1, color: { dark: '#1F3A2B' } });
  return QRCode.toDataURL(url, { margin: 1, width: 320, color: { dark: '#1F3A2B', light: '#FFFFFF' } });
}
