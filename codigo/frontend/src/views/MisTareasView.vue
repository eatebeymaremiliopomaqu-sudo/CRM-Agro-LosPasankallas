<script setup>
// M3 · "Mis tareas" del rol TRABAJADOR. Móvil primero; marcar hecha funciona sin conexión (cola offline).
import { computed, onMounted, ref } from 'vue';
import { api } from '../api.js';
import { useSesion } from '../stores/sesion.js';
import { useUi } from '../stores/ui.js';
import Icono from '../components/Icono.vue';
import { fecha } from '../utils/formato.js';
import { CLASE_ESTADO_TAREA, CLASE_PRIORIDAD, ETIQUETAS_ESTADO_TAREA, ETIQUETAS_PRIORIDAD, tareaVencida } from '../utils/tareas.js';

const sesion = useSesion();
const ui = useUi();
const pestana = ref('activas');
const tareas = ref([]);
const cargando = ref(true);

const activas = computed(() => tareas.value.filter((t) => ['PENDIENTE', 'EN_CURSO'].includes(t.estado)));
const historial = computed(() => tareas.value.filter((t) => ['COMPLETADA', 'CANCELADA'].includes(t.estado)));
const lista = computed(() => (pestana.value === 'activas' ? activas.value : historial.value));

async function cargar() {
  try {
    tareas.value = await api.get('/tareas/mis-tareas');
  } catch (e) {
    ui.error(e);
  } finally {
    cargando.value = false;
  }
}

async function accion(t, que) {
  try {
    const r = await api.putOffline(`/tareas/${t.id}/${que}`, {}, `${que === 'completar' ? 'Completar' : 'Iniciar'} tarea: ${t.titulo}`);
    if (r?.encolado) {
      t.estado = que === 'completar' ? 'COMPLETADA' : 'EN_CURSO';
      ui.avisar('📴 Guardado sin conexión: se enviará al recuperar señal');
      return;
    }
    ui.avisar(que === 'completar' ? '✅ Tarea completada' : 'Tarea iniciada');
    cargar();
  } catch (e) {
    ui.error(e);
  }
}

onMounted(cargar);
</script>

<template>
  <div class="encabezado">
    <div>
      <h1>Mis tareas</h1>
      <p>Hola, {{ sesion.usuario?.nombre?.split(' ')[0] }}. Estas son las tareas que te asignaron. <span class="insignia tierra">M3</span></p>
    </div>
  </div>

  <div class="tarjeta">
    <div class="pestanas">
      <button :class="{ activa: pestana === 'activas' }" @click="pestana = 'activas'">Por hacer ({{ activas.length }})</button>
      <button :class="{ activa: pestana === 'historial' }" @click="pestana = 'historial'">Historial ({{ historial.length }})</button>
    </div>

    <div v-if="cargando" class="vacio">Cargando tareas…</div>
    <div v-else-if="!lista.length" class="vacio">
      <Icono nombre="tarea" :tam="40" />
      <p>{{ pestana === 'activas' ? '¡No tienes tareas pendientes!' : 'Todavía no completaste tareas.' }}</p>
    </div>

    <div class="lista-tareas">
      <article v-for="t in lista" :key="t.id" class="tarea" :class="{ vencida: tareaVencida(t) }">
        <div class="tarea-insignias">
          <span class="insignia" :class="CLASE_PRIORIDAD[t.prioridad]">{{ ETIQUETAS_PRIORIDAD[t.prioridad] }}</span>
          <span class="insignia" :class="CLASE_ESTADO_TAREA[t.estado]">{{ ETIQUETAS_ESTADO_TAREA[t.estado] }}</span>
          <span v-if="tareaVencida(t)" class="insignia rojo">Vencida</span>
        </div>
        <h3>{{ t.titulo }}</h3>
        <p v-if="t.descripcion" class="apagado" style="margin: 0 0 8px">{{ t.descripcion }}</p>
        <div class="tarea-datos">
          <span v-if="t.lote"><Icono nombre="ubicacion" :tam="15" /> Lote {{ t.lote.codigo }} · {{ t.lote.nombre }}</span>
          <span v-if="t.fechaVencimiento"><Icono nombre="calendario" :tam="15" /> Para el {{ fecha(t.fechaVencimiento) }}</span>
          <span v-if="t.fechaCompletada"><Icono nombre="check" :tam="15" /> Hecha el {{ fecha(t.fechaCompletada) }}</span>
          <span><Icono nombre="personas" :tam="15" /> Asignó: {{ t.asignadoPor?.nombre }}</span>
        </div>
        <div v-if="pestana === 'activas'" class="acciones" style="margin-top: 12px">
          <button v-if="t.estado === 'PENDIENTE'" class="btn secundario" @click="accion(t, 'iniciar')"><Icono nombre="play" :tam="16" /> Empezar</button>
          <button class="btn" @click="accion(t, 'completar')"><Icono nombre="check" :tam="16" /> Marcar hecha</button>
        </div>
      </article>
    </div>
  </div>
</template>

<style scoped>
.lista-tareas { display: grid; gap: 12px; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); }
.tarea { border: 1px solid var(--linea); border-radius: var(--radio-sm); padding: 14px; background: #fff; }
.tarea.vencida { border-color: var(--rojo); box-shadow: inset 4px 0 0 var(--rojo); }
.tarea h3 { margin: 6px 0 4px; }
.tarea-insignias { display: flex; gap: 6px; flex-wrap: wrap; }
.tarea-datos { display: grid; gap: 4px; font-size: 0.88rem; color: var(--tinta-2); }
.tarea-datos span { display: flex; align-items: center; gap: 6px; }
.tarea .acciones .btn { flex: 1; justify-content: center; min-height: 44px; }
</style>
