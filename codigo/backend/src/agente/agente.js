// Orquestador del agente. No depende de la base de datos: recibe por inyección
// el intérprete, el almacén de acciones pendientes y el ejecutor. Así se prueba fácil.
import { INTENCIONES, normalizarCodigoLote } from './parser.js';
import { MENSAJE_SIN_DOSIS, pideRecomendacionDosis, pareceInyeccion, sanitizarEntrada } from './guardrails.js';

export const ESTADOS = Object.freeze({
  PENDIENTE: 'PENDIENTE',
  REGISTRADO: 'REGISTRADO',
  CANCELADO: 'CANCELADO',
  RECHAZADO: 'RECHAZADO',
  FALTAN_DATOS: 'FALTAN_DATOS',
  INFO: 'INFO',
  ERROR: 'ERROR',
});

export const TEXTO_AYUDA =
  '🌱 *Asistente CRM-Agro*. Puedo registrar (siempre te pido confirmación antes de guardar):\n' +
  '• Labores: "regué el lote 2 por 3 horas"\n' +
  '• Aplicaciones ya hechas: "fumigué L-03 con Producto X, 2 litros"\n' +
  '• Asistencia: "Juan Pérez trabajó 8 horas en L-01"\n' +
  '• Observaciones: "hay pulgón en el lote 4, severidad 3"\n' +
  '• Cosechas: "cosechamos 12 qq de papa en L-01"\n' +
  '• Consultas: "resumen de hoy"\n' +
  'No recomiendo dosis ni productos agroquímicos.';

const ETIQUETAS_FALTANTES = {
  lote: 'el lote (ej.: L-02 o "lote 2")',
  trabajador: 'el nombre del trabajador',
  producto: 'el nombre del producto aplicado',
  cantidadKg: 'la cantidad cosechada (kg o qq)',
};

const INTENCIONES_REGISTRO = [
  INTENCIONES.REGISTRAR_LABOR,
  INTENCIONES.REGISTRAR_ASISTENCIA,
  INTENCIONES.REGISTRAR_OBSERVACION,
  INTENCIONES.REGISTRAR_COSECHA,
];

const fmtFecha = (f) => {
  const [a, m, d] = String(f).split('-');
  return d ? `${d}/${m}/${a}` : String(f);
};

/** Resumen legible de lo que se va a guardar (se genera en código, no por el LLM). */
export function describirAccion(intencion, d) {
  switch (intencion) {
    case INTENCIONES.REGISTRAR_LABOR: {
      let s = `Labor *${d.tipo}* en ${d.lote} el ${fmtFecha(d.fecha)}`;
      if (d.horas) s += `, ${d.horas} h`;
      if (d.producto) s += `. Producto aplicado: ${d.producto}`;
      if (d.cantidadUsada) s += ` (${d.cantidadUsada} ${d.unidad || ''} usados, según lo informado)`;
      return s;
    }
    case INTENCIONES.REGISTRAR_ASISTENCIA:
      return `Asistencia de *${d.trabajador}* el ${fmtFecha(d.fecha)}: ${d.horas} h${d.lote ? ` en ${d.lote}` : ''}`;
    case INTENCIONES.REGISTRAR_OBSERVACION:
      return `Observación de *${d.tipo}* en ${d.lote}, severidad ${d.severidad}/5: "${d.nota}"`;
    case INTENCIONES.REGISTRAR_COSECHA:
      return `Cosecha de *${d.cantidadKg} kg*${d.cultivo ? ` de ${d.cultivo}` : ''} en ${d.lote} (${d.calidad}) el ${fmtFecha(d.fecha)}. Se generará un lote de cosecha con código QR`;
    default:
      return '';
  }
}

/**
 * @param {object} deps
 * @param {(texto:string, ahora:Date)=>Promise<{intencion,datos,faltantes,motor?}>} deps.interpretar
 * @param {{obtenerPendiente, crearPendiente, marcar}} deps.almacen
 * @param {{ejecutar:(tipo,datos,ctx)=>Promise<string>, consultar:(tema,ctx)=>Promise<string>}} deps.ejecutor
 * @param {()=>Date} [deps.reloj]
 * @param {number} [deps.minutosConfirmacion]
 */
export function crearAgente({ interpretar, almacen, ejecutor, reloj = () => new Date(), minutosConfirmacion = 10 }) {
  return async function procesarMensaje({ fincaId, canal = 'WEB', remitente, texto, usuario = null }) {
    const ahora = reloj();
    const limpio = sanitizarEntrada(texto);
    const ctx = { fincaId, canal, remitente, usuario, ahora };
    if (!limpio) return { estado: ESTADOS.INFO, respuesta: TEXTO_AYUDA };

    const interpretado = await interpretar(limpio, ahora);
    const pendiente = await almacen.obtenerPendiente(fincaId, remitente, ahora);

    // 1) Confirmación o cancelación de una acción pendiente
    if (interpretado.intencion === INTENCIONES.CONFIRMAR) {
      if (!pendiente) return { estado: ESTADOS.INFO, respuesta: 'No tengo nada pendiente por confirmar. Escribe "ayuda" para ver ejemplos.' };
      try {
        const resultado = await ejecutor.ejecutar(pendiente.tipo, pendiente.datos, ctx);
        await almacen.marcar(pendiente.id, 'CONFIRMADA');
        return { estado: ESTADOS.REGISTRADO, respuesta: `✅ Registrado. ${resultado}`, accionId: pendiente.id };
      } catch (e) {
        await almacen.marcar(pendiente.id, 'CANCELADA');
        return { estado: ESTADOS.ERROR, respuesta: `❌ No se pudo registrar: ${e.message}. Corrige el dato y vuelve a enviarlo.` };
      }
    }
    if (interpretado.intencion === INTENCIONES.CANCELAR) {
      if (!pendiente) return { estado: ESTADOS.INFO, respuesta: 'No hay ninguna acción pendiente.' };
      await almacen.marcar(pendiente.id, 'CANCELADA');
      return { estado: ESTADOS.CANCELADO, respuesta: '🚫 Cancelado. No se guardó nada.' };
    }

    // 2) Límites: dosis/recomendaciones y manipulación
    if (pideRecomendacionDosis(limpio)) return { estado: ESTADOS.RECHAZADO, respuesta: MENSAJE_SIN_DOSIS };
    if (pareceInyeccion(limpio)) {
      return { estado: ESTADOS.RECHAZADO, respuesta: 'Sólo puedo ayudarte a registrar datos de la finca. ' + TEXTO_AYUDA };
    }

    // 3) Registro con confirmación previa
    if (INTENCIONES_REGISTRO.includes(interpretado.intencion)) {
      const faltantes = interpretado.faltantes || [];
      if (faltantes.length) {
        const lista = faltantes.map((f) => ETIQUETAS_FALTANTES[f] || f).join(' y ');
        return { estado: ESTADOS.FALTAN_DATOS, respuesta: `Para registrarlo me falta ${lista}. Envía el mensaje completo de nuevo, por favor.` };
      }
      const datos = { ...interpretado.datos, fecha: interpretado.datos.fecha || ahora.toISOString().slice(0, 10) };
      if (datos.lote) datos.lote = normalizarCodigoLote(datos.lote);
      const resumen = describirAccion(interpretado.intencion, datos);
      const expiraEn = new Date(ahora.getTime() + minutosConfirmacion * 60000);
      const id = await almacen.crearPendiente({
        fincaId, canal, remitente, tipo: interpretado.intencion, datos, resumen, expiraEn,
      });
      return {
        estado: ESTADOS.PENDIENTE,
        accionId: id,
        resumen,
        respuesta: `📝 Voy a registrar:\n${resumen}.\n¿Confirmas? Responde *SI* para guardar o *NO* para cancelar (vence en ${minutosConfirmacion} min).`,
      };
    }

    // 4) Consultas
    if (interpretado.intencion === INTENCIONES.CONSULTA) {
      const texto = await ejecutor.consultar(interpretado.datos?.tema || 'GENERAL', ctx);
      return { estado: ESTADOS.INFO, respuesta: texto };
    }

    if (interpretado.intencion === INTENCIONES.AYUDA) return { estado: ESTADOS.INFO, respuesta: TEXTO_AYUDA };
    return { estado: ESTADOS.INFO, respuesta: 'No entendí el mensaje. ' + TEXTO_AYUDA };
  };
}

/** Almacén en memoria (útil para pruebas y modo demo). */
export function crearAlmacenMemoria() {
  const items = [];
  let secuencia = 0;
  return {
    items,
    async obtenerPendiente(fincaId, remitente, ahora) {
      return items.find((i) => i.fincaId === fincaId && i.remitente === remitente && i.estado === 'PENDIENTE' && i.expiraEn > ahora) || null;
    },
    async crearPendiente(a) {
      // Sólo una pendiente por remitente: la anterior se reemplaza
      items.filter((i) => i.fincaId === a.fincaId && i.remitente === a.remitente && i.estado === 'PENDIENTE').forEach((i) => (i.estado = 'CANCELADA'));
      const item = { ...a, id: ++secuencia, estado: 'PENDIENTE' };
      items.push(item);
      return item.id;
    },
    async marcar(id, estado) {
      const i = items.find((x) => x.id === id);
      if (i) i.estado = estado;
    },
  };
}
