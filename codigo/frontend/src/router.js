import { createRouter, createWebHistory } from 'vue-router';
import { useSesion } from './stores/sesion.js';

const rutas = [
  { path: '/login', name: 'login', component: () => import('./views/LoginView.vue'), meta: { publica: true } },
  { path: '/t/:token', name: 'lote-publico', component: () => import('./views/LotePublicoView.vue'), meta: { publica: true, sinMarco: true } },
  { path: '/', name: 'tablero', component: () => import('./views/TableroView.vue') },
  { path: '/lotes', name: 'lotes', component: () => import('./views/LotesView.vue'), meta: { modulo: 'M0' } },
  { path: '/campo', name: 'campo', component: () => import('./views/CampoView.vue'), meta: { modulo: 'M1' } },
  { path: '/trazabilidad', name: 'trazabilidad', component: () => import('./views/TrazabilidadView.vue'), meta: { modulo: 'M2' } },
  { path: '/trabajadores', name: 'trabajadores', component: () => import('./views/TrabajadoresView.vue'), meta: { modulo: 'M3', permiso: 'trabajadores:leer' } },
  { path: '/insumos', name: 'insumos', component: () => import('./views/InsumosView.vue'), meta: { modulo: 'M4' } },
  // M5, M6, M7 pendientes de implementar en bloques posteriores
  // { path: '/ventas', name: 'ventas', component: () => import('./views/VentasView.vue'), meta: { modulo: 'M5', permiso: 'ventas:leer' } },
  // { path: '/vivero', name: 'vivero', component: () => import('./views/ViveroView.vue'), meta: { modulo: 'M6' } },
  // { path: '/reportes', name: 'reportes', component: () => import('./views/ReportesView.vue'), meta: { modulo: 'M7' } },
  { path: '/agente', name: 'agente', component: () => import('./views/AgenteView.vue'), meta: { permiso: 'agente:usar' } },
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
