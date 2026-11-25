import { createRouter, createWebHistory } from 'vue-router';
import { useSesion } from './stores/sesion.js';

const rutas = [
  { path: '/login', name: 'login', component: () => import('./views/LoginView.vue'), meta: { publica: true } },
  { path: '/t/:token', name: 'lote-publico', component: () => import('./views/LotePublicoView.vue'), meta: { publica: true, sinMarco: true } },
  { path: '/', name: 'tablero', component: () => import('./views/TableroView.vue') },
  { path: '/parcelas', name: 'parcelas', component: () => import('./views/ParcelasView.vue'), meta: { modulo: 'M1' } },
  { path: '/campo', name: 'campo', component: () => import('./views/CampoView.vue'), meta: { modulo: 'M2' } },
  { path: '/trazabilidad', name: 'trazabilidad', component: () => import('./views/TrazabilidadView.vue'), meta: { modulo: 'M3' } },
  { path: '/trabajadores', name: 'trabajadores', component: () => import('./views/TrabajadoresView.vue'), meta: { modulo: 'M4', permiso: 'trabajadores:leer' } },
  { path: '/agente', name: 'agente', component: () => import('./views/AgenteView.vue'), meta: { modulo: 'M5', permiso: 'agente:usar' } },
  { path: '/insumos', name: 'insumos', component: () => import('./views/InsumosView.vue'), meta: { modulo: 'M6' } },
  { path: '/configuracion', name: 'configuracion', component: () => import('./views/ConfiguracionView.vue'), meta: { permiso: 'finca:configurar' } },
  { path: '/:pathMatch(.*)*', name: 'no-encontrado', component: () => import('./views/NoEncontradoView.vue'), meta: { publica: true } },
];

export const router = createRouter({ history: createWebHistory(), routes: rutas, scrollBehavior: () => ({ top: 0 }) });

router.beforeEach((to) => {
  const sesion = useSesion();
  if (!to.meta.publica && !sesion.autenticado) return { name: 'login', query: { volver: to.fullPath } };
  if (to.name === 'login' && sesion.autenticado) return { name: 'tablero' };
  if (to.meta.modulo && !sesion.tieneModulo(to.meta.modulo)) return { name: 'tablero' };
  if (to.meta.permiso && !sesion.puede(to.meta.permiso)) return { name: 'tablero' };
  return true;
});
