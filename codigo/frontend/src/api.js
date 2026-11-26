// Cliente HTTP único: agrega el JWT, maneja errores y la cola sin conexión.
import { crearCola } from './utils/colaOffline.js';

export const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
export const cola = crearCola();

export class ErrorApi extends Error {
  constructor(status, mensaje, detalles) {
    super(mensaje);
    this.status = status;
    this.detalles = detalles;
  }
}

const token = () => localStorage.getItem('crm-agro:token');

async function enviar(metodo, ruta, cuerpo) {
  let res;
  try {
    res = await fetch(`${API_URL}/api${ruta}`, {
      method: metodo,
      headers: { 'Content-Type': 'application/json', ...(token() ? { Authorization: `Bearer ${token()}` } : {}) },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
  } catch {
    throw new ErrorApi(0, 'Sin conexión con el servidor');
  }
  if (res.status === 401 && token()) {
    localStorage.removeItem('crm-agro:token');
    window.dispatchEvent(new CustomEvent('crm-agro:sesion-expirada'));
  }
  if (res.status === 204) return null;
  const datos = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detalle = Array.isArray(datos.detalles) ? `: ${datos.detalles.map((d) => (typeof d === 'string' ? d : `${d.campo} ${d.mensaje}`)).join(', ')}` : '';
    throw new ErrorApi(res.status, (datos.error || `Error ${res.status}`) + detalle, datos.detalles);
  }
  return datos;
}

/**
 * GET con respaldo local: si no hay red, devuelve la última respuesta guardada.
 */
async function get(ruta) {
  const clave = `crm-agro:cache:${ruta}`;
  try {
    const datos = await enviar('GET', ruta);
    try { localStorage.setItem(clave, JSON.stringify(datos)); } catch { /* almacenamiento lleno */ }
    return datos;
  } catch (e) {
    if (e.status === 0) {
      const guardado = localStorage.getItem(clave);
      if (guardado) return JSON.parse(guardado);
    }
    throw e;
  }
}

/**
 * Escritura que puede quedar en cola si no hay conexión (para registros de campo).
 */
async function escribirOffline(metodo, ruta, cuerpo, descripcion) {
  try {
    return await enviar(metodo, ruta, cuerpo);
  } catch (e) {
    if (e.status !== 0) throw e;
    cola.encolar({ metodo, ruta, cuerpo: { ...cuerpo, ...(cuerpo && 'origen' in cuerpo ? { origen: 'OFFLINE' } : {}) }, descripcion });
    window.dispatchEvent(new CustomEvent('crm-agro:cola-cambio'));
    return { encolado: true };
  }
}

export async function sincronizarCola() {
  const r = await cola.sincronizar((item) => enviar(item.metodo, item.ruta, item.cuerpo));
  window.dispatchEvent(new CustomEvent('crm-agro:cola-cambio'));
  return r;
}

export const api = {
  get,
  post: (ruta, cuerpo) => enviar('POST', ruta, cuerpo),
  patch: (ruta, cuerpo) => enviar('PATCH', ruta, cuerpo),
  put: (ruta, cuerpo) => enviar('PUT', ruta, cuerpo),
  delete: (ruta) => enviar('DELETE', ruta),
  postOffline: (ruta, cuerpo, descripcion) => escribirOffline('POST', ruta, cuerpo, descripcion),
  putOffline: (ruta, cuerpo, descripcion) => escribirOffline('PUT', ruta, cuerpo, descripcion),
};
