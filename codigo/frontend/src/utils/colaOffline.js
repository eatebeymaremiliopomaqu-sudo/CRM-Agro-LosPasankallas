// Cola de escrituras sin conexión. Cuando no hay señal en el campo, los registros
// (labores, observaciones, asistencia) se guardan en el dispositivo y se envían
// automáticamente al volver la conexión. El almacenamiento se inyecta para poder probarlo.
const CLAVE = 'crm-agro:cola';

export function crearCola(almacen = globalThis.localStorage) {
  const leer = () => {
    try {
      return JSON.parse(almacen.getItem(CLAVE) || '[]');
    } catch {
      return [];
    }
  };
  const guardar = (lista) => almacen.setItem(CLAVE, JSON.stringify(lista));

  return {
    listar: leer,
    cantidad: () => leer().length,
    encolar({ metodo, ruta, cuerpo, descripcion }) {
      const item = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, metodo, ruta, cuerpo, descripcion: descripcion || ruta, creado: new Date().toISOString(), intentos: 0 };
      guardar([...leer(), item]);
      return item;
    },
    quitar(id) {
      guardar(leer().filter((i) => i.id !== id));
    },
    /**
     * Envía en orden. Si falla por red, se detiene (sigue sin conexión).
     * Si el servidor rechaza (4xx), se descarta el item y se reporta.
     */
    async sincronizar(enviar) {
      const resultado = { enviados: 0, rechazados: [], pendientes: 0 };
      for (const item of leer()) {
        try {
          await enviar(item);
          this.quitar(item.id);
          resultado.enviados++;
        } catch (e) {
          if (e && e.status >= 400 && e.status < 500) {
            this.quitar(item.id);
            resultado.rechazados.push({ item, motivo: e.message });
          } else {
            const lista = leer().map((i) => (i.id === item.id ? { ...i, intentos: i.intentos + 1 } : i));
            guardar(lista);
            break;
          }
        }
      }
      resultado.pendientes = leer().length;
      return resultado;
    },
  };
}
