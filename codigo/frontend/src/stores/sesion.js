import { defineStore } from 'pinia';
import { api } from '../api.js';
import { puede as puedeRol } from '../utils/permisos.js';

export const useSesion = defineStore('sesion', {
  state: () => ({
    token: localStorage.getItem('crm-agro:token'),
    usuario: JSON.parse(localStorage.getItem('crm-agro:usuario') || 'null'),
    finca: JSON.parse(localStorage.getItem('crm-agro:finca') || 'null'),
  }),
  getters: {
    autenticado: (s) => Boolean(s.token),
    modulos: (s) => s.finca?.modulos || ['M0'],
    rol: (s) => s.usuario?.rol,
  },
  actions: {
    tieneModulo(m) {
      return this.modulos.includes(m);
    },
    puede(permiso) {
      return puedeRol(this.rol, permiso);
    },
    guardar() {
      localStorage.setItem('crm-agro:usuario', JSON.stringify(this.usuario));
      localStorage.setItem('crm-agro:finca', JSON.stringify(this.finca));
    },
    async iniciar(email, password) {
      const r = await api.post('/auth/login', { email, password });
      this.token = r.token;
      localStorage.setItem('crm-agro:token', r.token);
      this.usuario = r.usuario;
      this.finca = r.finca;
      this.guardar();
    },
    async refrescar() {
      if (!this.token) return;
      const r = await api.get('/auth/yo');
      this.usuario = r.usuario;
      this.finca = r.finca;
      this.guardar();
    },
    actualizarModulos(modulos) {
      this.finca = { ...this.finca, modulos };
      this.guardar();
    },
    salir() {
      this.token = null;
      this.usuario = null;
      this.finca = null;
      for (const k of Object.keys(localStorage)) if (k.startsWith('crm-agro:') && k !== 'crm-agro:cola') localStorage.removeItem(k);
    },
  },
});
