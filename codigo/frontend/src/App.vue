<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useSesion } from './stores/sesion.js';
import { useUi } from './stores/ui.js';
import Icono from './components/Icono.vue';
import { iniciales } from './utils/formato.js';
import { ETIQUETAS_ROL } from './utils/permisos.js';

const sesion = useSesion();
const ui = useUi();
const ruta = useRoute();
const router = useRouter();
const menuAbierto = ref(false);

const enlaces = computed(() =>
  [
    { a: '/', texto: 'Tablero', icono: 'tablero' },
    { a: '/lotes', texto: 'Lotes de campo', corto: 'Lotes', icono: 'parcela', modulo: 'M0' },
    { a: '/campo', texto: 'Control de campo', corto: 'Campo', icono: 'campo', modulo: 'M1' },
    { a: '/trazabilidad', texto: 'Trazabilidad', corto: 'Cosecha', icono: 'qr', modulo: 'M2' },
    { a: '/trabajadores', texto: 'Trabajadores', corto: 'Personal', icono: 'personas', modulo: 'M3', permiso: 'trabajadores:leer' },
    { a: '/insumos', texto: 'Insumos', icono: 'caja', modulo: 'M4' },
    // M5, M6, M7 pendientes de implementar en bloques posteriores
    // { a: '/ventas', texto: 'Ventas', icono: 'dinero', modulo: 'M5', permiso: 'ventas:leer' },
    // { a: '/vivero', texto: 'Vivero', icono: 'planta', modulo: 'M6' },
    // { a: '/reportes', texto: 'Reportes', icono: 'grafico', modulo: 'M7' },
    { a: '/agente', texto: 'Agente y WhatsApp', corto: 'Agente', icono: 'chat', permiso: 'agente:usar' },
    { a: '/configuracion', texto: 'Configuración', icono: 'ajustes', permiso: 'finca:configurar' },
  ].filter((e) => (!e.modulo || sesion.tieneModulo(e.modulo)) && (!e.permiso || sesion.puede(e.permiso)))
);
const enlacesMovil = computed(() => enlaces.value.slice(0, 5));
const conMarco = computed(() => sesion.autenticado && !ruta.meta.publica);

function salir() {
  sesion.salir();
  router.push('/login');
}

onMounted(() => {
  ui.escucharConexion();
  window.addEventListener('crm-agro:sesion-expirada', () => {
    sesion.salir();
    ui.avisar('Tu sesión expiró. Ingresa de nuevo.', 'alerta');
    router.push('/login');
  });
  if (sesion.autenticado) sesion.refrescar().catch(() => {});
});
</script>

<template>
  <div v-if="conMarco" class="marco">
    <aside class="menu" :class="{ abierto: menuAbierto }">
      <div class="marca">
        <img src="/favicon.svg" width="38" height="38" alt="" />
        <div>
          <strong>CRM-Agro</strong>
          <small>{{ sesion.finca?.nombre }}</small>
        </div>
      </div>
      <RouterLink v-for="e in enlaces" :key="e.a" :to="e.a" @click="menuAbierto = false">
        <Icono :nombre="e.icono" /> {{ e.texto }}
        <span v-if="e.modulo" class="etiqueta-modulo">{{ e.modulo }}</span>
      </RouterLink>
      <div class="pie">
        <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 10px">
          <div style="width: 34px; height: 34px; border-radius: 50%; background: var(--tierra); display: grid; place-items: center; color: #fff; font-weight: 700; font-size: 0.8rem">
            {{ iniciales(sesion.usuario?.nombre) }}
          </div>
          <div style="line-height: 1.25">
            <div style="color: #fff; font-weight: 600">{{ sesion.usuario?.nombre?.split('(')[0] }}</div>
            <small style="color: #9fb6a5">{{ ETIQUETAS_ROL[sesion.rol] }}</small>
          </div>
        </div>
        <button class="btn fantasma" style="color: #cfdccf; padding-left: 0" @click="salir"><Icono nombre="salir" :tam="18" /> Cerrar sesión</button>
      </div>
    </aside>

    <div>
      <header class="barra-movil">
        <strong>🌱 CRM-Agro</strong>
        <span v-if="!ui.enLinea" class="insignia ambar">Sin conexión</span>
        <button class="btn fantasma" style="color: #fff" aria-label="Cerrar sesión" @click="salir"><Icono nombre="salir" /></button>
      </header>
      <main class="principal">
        <div v-if="!ui.enLinea || ui.pendientes" class="banda-offline">
          <Icono :nombre="ui.enLinea ? 'nube' : 'sinred'" />
          <span v-if="!ui.enLinea">Estás sin conexión. Puedes seguir registrando labores, observaciones y asistencia: se guardan en este dispositivo.</span>
          <span v-else>Hay registros guardados sin conexión.</span>
          <span v-if="ui.pendientes" class="insignia tierra" style="margin-left: auto">{{ ui.pendientes }} pendiente(s)</span>
          <button v-if="ui.enLinea && ui.pendientes" class="btn chico" :disabled="ui.sincronizando" @click="ui.sincronizar()">Sincronizar</button>
        </div>
        <RouterView />
      </main>
    </div>

    <nav class="nav-inferior" aria-label="Navegación principal">
      <RouterLink v-for="e in enlacesMovil" :key="e.a" :to="e.a">
        <Icono :nombre="e.icono" :tam="22" />{{ e.corto || e.texto }}
      </RouterLink>
    </nav>
  </div>
  <RouterView v-else />

  <div class="avisos" role="status" aria-live="polite">
    <div v-for="a in ui.avisos" :key="a.id" class="aviso" :class="a.tipo">{{ a.texto }}</div>
  </div>
</template>
