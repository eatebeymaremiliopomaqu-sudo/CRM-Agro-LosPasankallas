<script setup>
// Agente de IA (chat web) + simulador de WhatsApp + alertas automáticas.
import { computed, nextTick, onMounted, ref } from 'vue';
import { api } from '../api.js';
import { useSesion } from '../stores/sesion.js';
import { useUi } from '../stores/ui.js';
import Icono from '../components/Icono.vue';
import { fechaHora } from '../utils/formato.js';

const sesion = useSesion();
const ui = useUi();
const canal = ref('WEB'); // WEB | WHATSAPP
const contactos = ref([]);
const telefono = ref('59170000002');
const texto = ref('');
const enviando = ref(false);
const caja = ref(null);
const saludo = { de: 'bot', texto: '¡Hola! Soy el asistente de la finca 🌱\nCuéntame qué se hizo en el campo y lo anoto, o pregúntame por pendientes, carencias, stock o ventas. Siempre te pediré confirmación antes de guardar.', hora: new Date() };
const mensajes = ref([{ ...saludo }]);
const bitacora = ref({ modo: '', mensajes: [] });
const acciones = ref([]);
const alertas = ref(null);
const bitacoraAlertas = ref([]);
const enviandoAlertas = ref(false);
const puedeAlertas = computed(() => sesion.puede('alertas:ver'));

const remitente = computed(() => contactos.value.find((c) => c.telefono === telefono.value));
const esCliente = computed(() => canal.value === 'WHATSAPP' && remitente.value?.tipo === 'CLIENTE');

const SUGERENCIAS_EQUIPO = [
  'regué el lote 1 por 3 horas',
  'hoy cosechamos 40 kg de tomate del lote 2',
  'hoy cosechamos 20 kg de cebolla del lote 5',
  '¿qué se aplicó en el lote 5 y hasta cuándo es la carencia?',
  'labores pendientes',
  'mis tareas',
  'tarea hecha',
  'stock de frutilla',
  'ventas de la semana',
  'cuentas por cobrar',
  '¿qué dosis de fungicida le pongo?',
];
const SUGERENCIAS_CLIENTE = ['precios', 'quiero 3 cajas de frutilla para el viernes', 'quiero 10 kg de tomate para mañana', 'ALTA', 'BAJA'];
const sugerencias = computed(() => (esCliente.value ? SUGERENCIAS_CLIENTE : SUGERENCIAS_EQUIPO));

const ESTADO = { PENDIENTE: ['ambar', 'Por confirmar'], CONFIRMADA: ['', 'Guardada'], CANCELADA: ['gris', 'Cancelada'], EXPIRADA: ['gris', 'Expirada'] };
const TIPO_CONTACTO = { USUARIO: 'Usuario', TRABAJADOR: 'Trabajador', CLIENTE: 'Cliente' };

async function bajar() {
  await nextTick();
  caja.value?.scrollTo({ top: caja.value.scrollHeight, behavior: 'smooth' });
}

function cambiarCanal(c) {
  canal.value = c;
  mensajes.value = [{ ...saludo, hora: new Date() }];
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
    cargarPanel();
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
async function cargarAlertas() {
  if (!puedeAlertas.value) return;
  try {
    [alertas.value, bitacoraAlertas.value] = await Promise.all([api.get('/alertas'), api.get('/alertas/bitacora?limite=10')]);
  } catch (e) {
    ui.error(e);
  }
}
async function enviarAlertas() {
  enviandoAlertas.value = true;
  try {
    const r = await api.post('/alertas/enviar');
    ui.avisar(`🔔 Alertas enviadas a ${r.enviados.length} persona(s)${r.omitidosSinConsentimiento ? ` · ${r.omitidosSinConsentimiento} sin consentimiento (no se les envió)` : ''}`);
    cargarAlertas();
    cargarPanel();
  } catch (e) {
    ui.error(e);
  } finally {
    enviandoAlertas.value = false;
  }
}
// Negritas estilo WhatsApp (*texto*) sin usar v-html con datos del usuario
const partes = (t) => String(t).split(/(\*[^*\n]+\*)/g).map((p) => (p.startsWith('*') && p.endsWith('*') && p.length > 2 ? { b: true, t: p.slice(1, -1) } : { b: false, t: p }));

onMounted(async () => {
  cargarPanel();
  cargarAlertas();
  try {
    contactos.value = await api.get('/agente/whatsapp/contactos');
    const propio = contactos.value.find((c) => c.tipo === 'USUARIO' && c.rol === sesion.rol);
    if (propio) telefono.value = propio.telefono;
  } catch { /* sin contactos */ }
});
</script>

<template>
  <div class="encabezado">
    <div>
      <h1>Agente de IA y WhatsApp</h1>
      <p>Registro conversacional con confirmación previa (SI/NO). El agente <strong>no recomienda dosis</strong> y solo muestra lo registrado.</p>
    </div>
    <span class="insignia" :class="bitacora.modo === 'SIMULADO' ? 'azul' : ''">
      <Icono nombre="whatsapp" :tam="14" /> {{ bitacora.modo === 'SIMULADO' ? 'WhatsApp simulado' : `WhatsApp: ${bitacora.proveedor}` }}
    </span>
  </div>

  <div class="rejilla r-2-1">
    <div>
      <div class="filtros">
        <div class="pestanas" style="margin: 0; border: 0">
          <button :class="{ activa: canal === 'WEB' }" @click="cambiarCanal('WEB')"><Icono nombre="chat" :tam="16" /> Chat web</button>
          <button :class="{ activa: canal === 'WHATSAPP' }" @click="cambiarCanal('WHATSAPP')"><Icono nombre="whatsapp" :tam="16" /> Simular WhatsApp</button>
        </div>
        <template v-if="canal === 'WHATSAPP'">
          <select v-model="telefono" class="entrada" style="max-width: 260px" aria-label="Remitente simulado" @change="mensajes = [{ ...saludo, hora: new Date() }]">
            <option v-for="c in contactos" :key="c.telefono" :value="c.telefono">{{ TIPO_CONTACTO[c.tipo] }} · {{ c.nombre }}{{ c.consentimientoWhatsapp ? '' : ' (sin consentimiento)' }}</option>
            <option value="59179999999">Número desconocido</option>
          </select>
          <small class="apagado">{{ telefono }}</small>
        </template>
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
          <input v-model="texto" class="entrada" :placeholder="esCliente ? 'Ej.: quiero 3 cajas de frutilla para el viernes' : 'Ej.: regué el lote 2 por 3 horas'" maxlength="800" aria-label="Mensaje" />
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
      <div v-if="puedeAlertas && alertas" class="tarjeta">
        <div class="tarjeta-titulo">
          <h3><Icono nombre="campana" :tam="18" /> Alertas de hoy</h3>
          <button class="btn chico" :disabled="enviandoAlertas" @click="enviarAlertas">{{ enviandoAlertas ? 'Enviando…' : 'Enviar ahora' }}</button>
        </div>
        <small class="apagado">Automáticas a las {{ alertas.horaAlertas }} {{ alertas.alertasActivas ? '' : '(desactivadas)' }} · solo a quien dio consentimiento</small>
        <div v-if="!alertas.items.length" class="apagado" style="margin-top: 8px">Sin alertas para hoy ✅</div>
        <ul style="padding-left: 18px; margin: 8px 0 0; font-size: 0.86rem">
          <li v-for="(a, i) in alertas.items.slice(0, 10)" :key="i"><strong>{{ alertas.tipos[a.tipo] }}:</strong> {{ a.texto }}</li>
        </ul>
        <details v-if="bitacoraAlertas.length" style="margin-top: 10px">
          <summary class="apagado" style="cursor: pointer">Bitácora de alertas ({{ bitacoraAlertas.length }})</summary>
          <div v-for="b in bitacoraAlertas" :key="b.id" style="padding: 6px 0; border-bottom: 1px solid #f0ece2; font-size: 0.84rem">
            <small>{{ fechaHora(b.fecha) }} · {{ b.disparo }} · {{ b.destinatario }}</small>
            <span class="insignia" :class="b.estado === 'FALLIDO' ? 'rojo' : b.estado === 'SIMULADO' ? 'azul' : ''" style="margin-left: 6px">{{ b.estado }}</span>
          </div>
        </details>
      </div>
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
          <span class="insignia" :class="bitacora.modo === 'SIMULADO' ? 'azul' : ''">{{ bitacora.modo }}</span>
        </div>
        <small v-if="bitacora.motivoSimulado" class="apagado">{{ bitacora.motivoSimulado }}</small>
        <div v-for="m in bitacora.mensajes.slice(0, 12)" :key="m.id" style="padding: 6px 0; border-bottom: 1px solid #f0ece2; font-size: 0.86rem">
          <small>{{ m.direccion === 'ENTRANTE' ? '⬅️' : '➡️' }} {{ m.telefono }} · {{ fechaHora(m.fecha) }}</small>
          <div style="white-space: pre-wrap">{{ m.texto.replace(/\*/g, '').slice(0, 160) }}</div>
        </div>
      </div>
    </div>
  </div>
</template>
