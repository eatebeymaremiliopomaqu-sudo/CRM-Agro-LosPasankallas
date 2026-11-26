// Orquestador del agente. No depende de la base de datos: recibe por inyección
// el intérprete, el almacén de acciones pendientes y el ejecutor. Así se prueba fácil.
import { INTENCIONES, TEMAS, normalizarCodigoLote, fechaLocalISO } from './parser.js';
import { MENSAJE_AGRONOMO, MENSAJE_SIN_DOSIS, esPreguntaAgronomica, pideRecomendacionDosis, pareceInyeccion, sanitizarEntrada } from './guardrails.js';
import { aplicarPolitica, PERFILES } from './politicas.js';

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
  '• Cosechas: "hoy cosechamos 40 kg de tomate del lote 2"\n' +
  '• Tareas: "tarea hecha" o "terminé la tarea 12"\n' +
  '• Consultas: "labores pendientes", "¿qué se aplicó en el lote 2?", "stock de urea", "ventas de la semana", "cuentas por cobrar", "resumen de hoy"\n' +
  'No recomiendo dosis ni productos agroquímicos.';

export const TEXTO_AYUDA_TRABAJADOR =
  '🌱 *Asistente CRM-Agro* (trabajador). Puedo:\n' +
  '• Ver tus tareas: "mis tareas"\n' +
  '• Marcar una tarea: "tarea hecha" o "terminé la tarea 12"\n' +
  '• Registrar labores: "regué el lote 2 por 3 horas"\n' +
  '• Registrar observaciones: "hay pulgón en el lote 4"\n' +
  '• Saber si un lote está en carencia: "¿hay carencia en el lote 5?"\n' +
  'Siempre te pido confirmación (SI/NO) antes de guardar.';

export const TEXTO_AYUDA_CLIENTE =
  '🍓 Hola, soy el asistente de pedidos de la finca. Puedes:\n' +
  '• Ver precios y productos disponibles: "precios"\n' +
  '• Hacer un pedido: "quiero 3 cajas de frutilla para el viernes"\n' +
  'Te pediré confirmación (SI/NO) antes de registrarlo. Escribe BAJA si ya no quieres recibir mensajes.';

export function ayudaPara(perfil) {
  if (perfil === PERFILES.CLIENTE) return TEXTO_AYUDA_CLIENTE;
  if (perfil === PERFILES.TRABAJADOR) return TEXTO_AYUDA_TRABAJADOR;
  return TEXTO_AYUDA;
}

const ETIQUETAS_FALTANTES = {
  lote: 'el lote (ej.: L-02 o "lote 2")',
  trabajador: 'el nombre del trabajador',
  producto: 'el nombre del producto',
  cantidadKg: 'la cantidad cosechada (kg o qq)',
  cantidad: 'la cantidad',
};

const INTENCIONES_REGISTRO = [
  INTENCIONES.REGISTRAR_LABOR,
  INTENCIONES.REGISTRAR_ASISTENCIA,
  INTENCIONES.REGISTRAR_OBSERVACION,
  INTENCIONES.REGISTRAR_COSECHA,
  INTENCIONES.MARCAR_TAREA_HECHA,
  INTENCIONES.PEDIDO_CLIENTE,
];

const fmtFecha = (f) => {
  const [a, m, d] = String(f).slice(0, 10).split('-');
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
      return `Cosecha de *${d.cantidadKg} kg*${d.cultivo ? ` de ${d.cultivo}` : ''} en ${d.lote} (${d.calidad}) el ${fmtFecha(d.fecha)}. Se generará un lote de cosecha con código QR y entrará al inventario`;
    case INTENCIONES.MARCAR_TAREA_HECHA:
      return `Marcar como hecha la tarea #${d.tareaId}: "${d.titulo || ''}"`;
    case INTENCIONES.PEDIDO_CLIENTE: {
      let s = `Pedido de *${d.cantidad} ${d.unidad} de ${d.producto}*`;
      s += d.subtotal ? ` (aprox. Bs ${Number(d.subtotal).toFixed(2)})` : ' (precio a confirmar por la finca)';
      if (d.fechaEntrega) s += ` para el ${fmtFecha(d.fechaEntrega)}`;
      return s + '. La finca te confirmará la entrega';
    }
    default:
      return '';
  }
}

/** Error "amigable" que el ejecutor puede lanzar al preparar: se muestra tal cual al usuario. */
export class RechazoAgente extends Error {
  constructor(mensaje, estado = ESTADOS.RECHAZADO) {
    super(mensaje);
    this.estado = estado;
  }
}

/**
 * @param {object} deps
 * @param {(texto:string, ahora:Date)=>Promise<{intencion,datos,faltantes,motor?}>} deps.interpretar
 * @param {{obtenerPendiente, crearPendiente, marcar}} deps.almacen
 * @param {{ejecutar, consultar, preparar?}} deps.ejecutor  preparar(tipo, datos, ctx) valida/enriquece antes de pedir confirmación
 * @param {()=>Date} [deps.reloj]
 * @param {number} [deps.minutosConfirmacion]
 */
export function crearAgente({ interpretar, almacen, ejecutor, reloj = () => new Date(), minutosConfirmacion = 10 }) {
  return async function procesarMensaje({ fincaId, canal = 'WEB', remitente, texto, usuario = null, perfil = null, cliente = null, trabajadorId = null }) {
    const ahora = reloj();
    const limpio = sanitizarEntrada(texto);
    const perfilEf = perfil || usuario?.rol || PERFILES.TRABAJADOR;
    const ctx = { fincaId, canal, remitente, usuario, perfil: perfilEf, cliente, trabajadorId: trabajadorId ?? usuario?.trabajadorId ?? null, ahora };
    const ayuda = ayudaPara(perfilEf);
    if (!limpio) return { estado: ESTADOS.INFO, respuesta: ayuda };

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

    // 2) Límites: dosis/recomendaciones, diagnósticos agronómicos y manipulación
    if (pideRecomendacionDosis(limpio)) return { estado: ESTADOS.RECHAZADO, respuesta: MENSAJE_SIN_DOSIS };
    if (esPreguntaAgronomica(limpio)) return { estado: ESTADOS.RECHAZADO, respuesta: MENSAJE_AGRONOMO };
    if (pareceInyeccion(limpio)) {
      return { estado: ESTADOS.RECHAZADO, respuesta: 'Sólo puedo ayudarte con los datos de la finca. ' + ayuda };
    }

    // 3) Política por perfil (trabajador, cliente…)
    const politica = aplicarPolitica(perfilEf, interpretado.intencion, interpretado.datos || {});
    if (!politica.ok) return { estado: ESTADOS.RECHAZADO, respuesta: `🔒 ${politica.motivo}` };
    const intencion = politica.intencion;

    // 4) Registro con confirmación previa
    if (INTENCIONES_REGISTRO.includes(intencion)) {
      const faltantes = interpretado.faltantes || [];
      if (faltantes.length) {
        const lista = faltantes.map((f) => ETIQUETAS_FALTANTES[f] || f).join(' y ');
        return { estado: ESTADOS.FALTAN_DATOS, respuesta: `Para registrarlo me falta ${lista}. Envía el mensaje completo de nuevo, por favor.` };
      }
      let datos = { ...politica.datos };
      if (intencion !== INTENCIONES.PEDIDO_CLIENTE && intencion !== INTENCIONES.MARCAR_TAREA_HECHA) datos.fecha = datos.fecha || fechaLocalISO(ahora);
      if (datos.lote) datos.lote = normalizarCodigoLote(datos.lote);
      if (ejecutor.preparar) {
        try {
          datos = (await ejecutor.preparar(intencion, datos, ctx)) || datos;
        } catch (e) {
          return { estado: e.estado || ESTADOS.FALTAN_DATOS, respuesta: e.message };
        }
      }
      const resumen = describirAccion(intencion, datos);
      const expiraEn = new Date(ahora.getTime() + minutosConfirmacion * 60000);
      const id = await almacen.crearPendiente({ fincaId, canal, remitente, tipo: intencion, datos, resumen, expiraEn });
      return {
        estado: ESTADOS.PENDIENTE,
        accionId: id,
        resumen,
        respuesta: `📝 Voy a registrar:\n${resumen}.\n¿Confirmas? Responde *SI* para guardar o *NO* para cancelar (vence en ${minutosConfirmacion} min).`,
      };
    }

    // 5) Consultas: solo datos registrados en la BD
    if (intencion === INTENCIONES.CONSULTA) {
      const datos = politica.datos || {};
      const texto = await ejecutor.consultar(datos.tema || TEMAS.GENERAL, ctx, datos);
      return { estado: ESTADOS.INFO, respuesta: texto };
    }

    if (intencion === INTENCIONES.AYUDA) return { estado: ESTADOS.INFO, respuesta: ayuda };
    return { estado: ESTADOS.INFO, respuesta: 'No entendí el mensaje. ' + ayuda };
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
