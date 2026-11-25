<script setup>
import { nextTick, onMounted, ref } from 'vue';
import { api } from '../api.js';
import { useSesion } from '../stores/sesion.js';
import { useUi } from '../stores/ui.js';
import Icono from '../components/Icono.vue';
import { fechaHora } from '../utils/formato.js';

const sesion = useSesion();
const ui = useUi();
const canal = ref('WEB'); // WEB | WHATSAPP
const telefono = ref(sesion.usuario?.telefono || '59170000003');
const texto = ref('');
const enviando = ref(false);
const caja = ref(null);
const mensajes = ref([
  { de: 'bot', texto: '¡Hola! Soy el asistente de registro de la finca 🌱\nCuéntame qué se hizo en el campo y lo anoto. Siempre te pediré confirmación antes de guardar.', hora: new Date() },
]);
const bitacora = ref({ modo: '', mensajes: [] });
const acciones = ref([]);

const sugerencias = [
  'regué la parcela 1 por 3 horas',
  'fumigué P-03 con FitoVerde, 2 litros',
  'hay pulgón en la parcela 4, severidad 4',
  'Juan Pérez trabajó 8 horas en P-02',
  'cosechamos 6 qq de papa en P-04',
  '¿qué dosis de fungicida le pongo?',
  'resumen de hoy',
];
const ESTADO = { PENDIENTE: ['ambar', 'Por confirmar'], CONFIRMADA: ['', 'Guardada'], CANCELADA: ['gris', 'Cancelada'], EXPIRADA: ['gris', 'Expirada'] };

async function bajar() {
  await nextTick();
  caja.value?.scrollTo({ top: caja.value.scrollHeight, behavior: 'smooth' });
}

async function enviar(t = texto.value) {
  const contenido = t.trim();
  if (!contenido || enviando.value) return;
  mensajes.value.push({ de: 'yo', texto: contenido, hora: new Date() });
  texto.value = '';
  enviando.value = true;
  bajar();
  try {
    const r = canal.value === 'WEB'
      ? await api.post('/agente/mensaje', { texto: contenido })
      : await api.post('/agente/whatsapp/simular', { telefono: telefono.value, texto: contenido });
    mensajes.value.push({ de: 'bot', texto: r.respuesta, estado: r.estado, hora: new Date() });
    if (['REGISTRADO', 'PENDIENTE', 'CANCELADO'].includes(r.estado)) cargarPanel();
  } catch (e) {
    mensajes.value.push({ de: 'bot', texto: `⚠️ ${e.message}`, estado: 'ERROR', hora: new Date() });
  } finally {
    enviando.value = false;
    bajar();
  }
}

async function cargarPanel() {
  try {
    [bitacora.value, acciones.value] = await Promise.all([api.get('/agente/whatsapp/mensajes'), api.get('/agente/acciones')]);
  } catch (e) {
    ui.error(e);
  }
}
// Negritas estilo WhatsApp (*texto*) sin usar v-html con datos del usuario
const partes = (t) => String(t).split(/(\*[^*\n]+\*)/g).map((p) => (p.startsWith('*') && p.endsWith('*') && p.length > 2 ? { b: true, t: p.slice(1, -1) } : { b: false, t: p }));

onMounted(cargarPanel);
</script>

<template>
  <div class="encabezado">
    <div>
      <h1>Agente de IA y WhatsApp</h1>
      <p>Registro conversacional con confirmación previa. El agente <strong>no recomienda dosis</strong>. <span class="insignia tierra">M5</span></p>
    </div>
  </div>

  <div class="rejilla r-2-1">
    <div>
      <div class="filtros">
        <div class="pestanas" style="margin: 0; border: 0">
          <button :class="{ activa: canal === 'WEB' }" @click="canal = 'WEB'"><Icono nombre="chat" :tam="16" /> Chat web</button>
          <button :class="{ activa: canal === 'WHATSAPP' }" @click="canal = 'WHATSAPP'"><Icono nombre="whatsapp" :tam="16" /> Simular WhatsApp</button>
        </div>
        <input v-if="canal === 'WHATSAPP'" v-model="telefono" class="entrada" style="max-width: 170px" aria-label="Teléfono remitente" placeholder="59170000003" />
      </div>
      <div class="chat">
        <div ref="caja" class="chat-mensajes" aria-live="polite">
          <div v-for="(m, i) in mensajes" :key="i" class="burbuja" :class="[m.de, { rechazo: m.estado === 'RECHAZADO' }]">
            <template v-for="(p, j) in partes(m.texto)" :key="j"><strong v-if="p.b">{{ p.t }}</strong><template v-else>{{ p.t }}</template></template>
            <span class="hora">{{ m.hora.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' }) }}</span>
          </div>
          <div v-if="enviando" class="burbuja bot apagado">escribiendo…</div>
        </div>
        <form class="chat-entrada" @submit.prevent="enviar()">
          <input v-model="texto" class="entrada" placeholder="Ej.: regué la parcela 2 por 3 horas" maxlength="800" aria-label="Mensaje" />
          <button class="btn" :disabled="enviando || !texto.trim()" aria-label="Enviar"><Icono nombre="enviar" :tam="18" /></button>
        </form>
      </div>
      <div class="sugerencias">
        <button v-for="s in sugerencias" :key="s" type="button" @click="enviar(s)">{{ s }}</button>
        <button type="button" @click="enviar('SI')">✅ SI</button>
        <button type="button" @click="enviar('NO')">🚫 NO</button>
      </div>
    </div>

    <div>
      <div class="tarjeta">
        <div class="tarjeta-titulo">
          <h3>Acciones del agente</h3>
          <button class="btn fantasma chico" @click="cargarPanel">Actualizar</button>
        </div>
        <div v-if="!acciones.length" class="apagado">Sin acciones aún.</div>
        <div v-for="a in acciones.slice(0, 8)" :key="a.id" style="padding: 8px 0; border-bottom: 1px solid #f0ece2">
          <div style="display: flex; justify-content: space-between; gap: 8px">
            <small>{{ a.canal }} · {{ fechaHora(a.creadoEn) }}</small>
            <span class="insignia" :class="ESTADO[a.estado]?.[0]">{{ ESTADO[a.estado]?.[1] }}</span>
          </div>
          <div style="font-size: 0.88rem">{{ a.resumen.replace(/\*/g, '') }}</div>
        </div>
      </div>
      <div class="tarjeta">
        <div class="tarjeta-titulo">
          <h3>Bitácora WhatsApp</h3>
          <span class="insignia" :class="bitacora.modo === 'CLOUD_API' ? '' : 'azul'">{{ bitacora.modo === 'CLOUD_API' ? 'Cloud API' : 'Simulado' }}</span>
        </div>
        <div v-for="m in bitacora.mensajes.slice(0, 10)" :key="m.id" style="padding: 6px 0; border-bottom: 1px solid #f0ece2; font-size: 0.86rem">
          <small>{{ m.direccion === 'ENTRANTE' ? '⬅️' : '➡️' }} {{ m.telefono }} · {{ fechaHora(m.fecha) }}</small>
          <div style="white-space: pre-wrap">{{ m.texto.replace(/\*/g, '').slice(0, 160) }}</div>
        </div>
      </div>
    </div>
  </div>
</template>
