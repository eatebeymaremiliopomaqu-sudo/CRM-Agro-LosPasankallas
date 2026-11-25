import { defineStore } from 'pinia';
import { cola, sincronizarCola } from '../api.js';

let siguiente = 1;

export const useUi = defineStore('ui', {
  state: () => ({ avisos: [], enLinea: navigator.onLine, pendientes: cola.cantidad(), sincronizando: false }),
  actions: {
    avisar(texto, tipo = 'ok', ms = 3800) {
      const id = siguiente++;
      this.avisos.push({ id, texto, tipo });
      setTimeout(() => (this.avisos = this.avisos.filter((a) => a.id !== id)), ms);
    },
    error(e) {
      this.avisar(e?.message || String(e), 'error', 5500);
    },
    actualizarPendientes() {
      this.pendientes = cola.cantidad();
    },
    async sincronizar() {
      if (this.sincronizando || !this.pendientes) return;
      this.sincronizando = true;
      try {
        const r = await sincronizarCola();
        if (r.enviados) this.avisar(`☁️ ${r.enviados} registro(s) sin conexión sincronizados`);
        for (const x of r.rechazados) this.avisar(`No se pudo sincronizar "${x.item.descripcion}": ${x.motivo}`, 'error', 7000);
      } finally {
        this.sincronizando = false;
        this.actualizarPendientes();
      }
    },
    escucharConexion() {
      window.addEventListener('online', () => { this.enLinea = true; this.sincronizar(); });
      window.addEventListener('offline', () => { this.enLinea = false; });
      window.addEventListener('crm-agro:cola-cambio', () => this.actualizarPendientes());
      if (this.enLinea) this.sincronizar();
    },
  },
});
