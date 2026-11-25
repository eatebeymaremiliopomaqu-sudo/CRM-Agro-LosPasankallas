<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { api } from '../api.js';
import { useSesion } from '../stores/sesion.js';
import { useUi } from '../stores/ui.js';
import Icono from '../components/Icono.vue';
import Modal from '../components/Modal.vue';
import { ETIQUETAS_EVENTO, fecha, fechaHora, hoyISO, numero } from '../utils/formato.js';

const sesion = useSesion();
const ui = useUi();
const lotes = ref([]);
const parcelas = ref([]);
const detalle = ref(null);
const modal = ref(null);
const f = reactive({});
const ev = reactive({ tipo: 'DESPACHO', detalle: '' });
const busqueda = ref('');

const siembrasActivas = computed(() => parcelas.value.filter((p) => p.siembraActual).map((p) => ({ id: p.siembraActual.id, texto: `${p.codigo} · ${p.siembraActual.cultivo} ${p.siembraActual.variedad ? `(${p.siembraActual.variedad})` : ''}` })));
const filtrados = computed(() => {
  const q = busqueda.value.toLowerCase();
  return lotes.value.filter((l) => !q || l.codigo.toLowerCase().includes(q) || l.siembra.cultivo.toLowerCase().includes(q) || (l.destino || '').toLowerCase().includes(q));
});
const ultimoEvento = (l) => l.eventos[l.eventos.length - 1]?.tipo;

async function cargar() {
  try {
    [lotes.value, parcelas.value] = await Promise.all([api.get('/trazabilidad/lotes'), api.get('/parcelas')]);
  } catch (e) {
    ui.error(e);
  }
}
async function abrir(l) {
  try {
    detalle.value = await api.get(`/trazabilidad/lotes/${l.id}`);
  } catch (e) {
    ui.error(e);
  }
}
function nuevoLote() {
  Object.assign(f, { siembraId: siembrasActivas.value[0]?.id, fechaCosecha: hoyISO(), cantidadKg: '', calidad: 'PRIMERA', destino: '' });
  modal.value = 'lote';
}
async function crearLote() {
  try {
    const l = await api.post('/trazabilidad/lotes', { siembraId: Number(f.siembraId), fechaCosecha: f.fechaCosecha, cantidadKg: Number(f.cantidadKg), calidad: f.calidad, destino: f.destino || null });
    ui.avisar(`Lote ${l.codigo} creado con su código QR`);
    modal.value = null;
    await cargar();
    abrir(l);
  } catch (e) {
    ui.error(e);
  }
}
async function agregarEvento() {
  try {
    await api.post(`/trazabilidad/lotes/${detalle.value.id}/eventos`, { tipo: ev.tipo, detalle: ev.detalle || null });
    ev.detalle = '';
    await abrir(detalle.value);
    cargar();
    ui.avisar('Evento agregado a la cadena');
  } catch (e) {
    ui.error(e);
  }
}
async function copiar(t) {
  try {
    await navigator.clipboard.writeText(t);
    ui.avisar('Enlace copiado');
  } catch {
    ui.avisar(t, 'ok', 8000);
  }
}
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
function imprimirEtiqueta() {
  const d = detalle.value;
  const w = window.open('', '_blank', 'width=420,height=560');
  if (!w) return ui.avisar('Permite las ventanas emergentes para imprimir', 'alerta');
  w.document.write(`<html><head><title>${esc(d.codigo)}</title></head><body style="font-family:Inter,Arial;text-align:center;padding:20px">
    <h2 style="margin:0">${esc(sesion.finca?.nombre)}</h2><p style="margin:4px 0 10px">${esc(d.siembra.cultivo)} · ${numero(d.cantidadKg)} kg · ${esc(d.calidad)}</p>
    <img src="${d.qr}" style="width:240px"><h3 style="letter-spacing:2px">${esc(d.codigo)}</h3><small>Escanee para conocer el origen</small>
    <script>window.onload=()=>window.print()<\/script></body></html>`);
  w.document.close();
}

onMounted(cargar);
</script>

<template>
  <div class="encabezado">
    <div>
      <h1>Trazabilidad</h1>
      <p>Cada lote de cosecha con su código QR: del surco al consumidor. <span class="insignia tierra">M3</span></p>
    </div>
    <button v-if="sesion.puede('trazabilidad:escribir')" class="btn tierra" :disabled="!siembrasActivas.length" @click="nuevoLote"><Icono nombre="mas" /> Nuevo lote de cosecha</button>
  </div>

  <div class="filtros"><input v-model="busqueda" class="entrada" placeholder="Buscar por código, cultivo o destino…" style="max-width: 360px" /></div>

  <div v-if="!lotes.length" class="tarjeta vacio"><Icono nombre="qr" :tam="44" /><p>Aún no hay lotes. Registra una cosecha para generar su QR.</p></div>
  <div class="rejilla r-3">
    <button v-for="l in filtrados" :key="l.id" class="tarjeta" style="text-align: left; cursor: pointer; font: inherit; margin: 0" @click="abrir(l)">
      <div style="display: flex; justify-content: space-between; align-items: start">
        <div>
          <div style="font-family: var(--titulo); font-size: 1.15rem; color: var(--bosque); font-weight: 700">{{ l.codigo }}</div>
          <small>{{ fecha(l.fechaCosecha) }} · {{ l.siembra.parcela.codigo }}</small>
        </div>
        <span class="insignia" :class="l.calidad === 'PRIMERA' ? '' : 'ambar'">{{ l.calidad }}</span>
      </div>
      <div style="display: flex; align-items: baseline; gap: 8px; margin: 12px 0 6px">
        <strong style="font-size: 1.5rem">{{ numero(l.cantidadKg) }}</strong><span>kg de {{ l.siembra.cultivo }}</span>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center">
        <small>{{ l.destino || 'Sin destino' }}</small>
        <span class="insignia azul">{{ ETIQUETAS_EVENTO[ultimoEvento(l)] }}</span>
      </div>
    </button>
  </div>

  <Modal v-if="modal === 'lote'" titulo="Nuevo lote de cosecha" @cerrar="modal = null">
    <form @submit.prevent="crearLote">
      <div class="campo"><label>Siembra (parcela y cultivo)</label><select v-model="f.siembraId" required><option v-for="s in siembrasActivas" :key="s.id" :value="s.id">{{ s.texto }}</option></select></div>
      <div class="fila-campos">
        <div class="campo"><label>Fecha de cosecha</label><input v-model="f.fechaCosecha" type="date" required :max="hoyISO()" /></div>
        <div class="campo"><label>Cantidad (kg)</label><input v-model="f.cantidadKg" type="number" min="0.1" step="0.1" required /><small>1 quintal = 46 kg</small></div>
        <div class="campo"><label>Calidad</label><select v-model="f.calidad"><option>PRIMERA</option><option>SEGUNDA</option><option>DESCARTE</option></select></div>
      </div>
      <div class="campo"><label>Destino</label><input v-model="f.destino" placeholder="Mercado Abasto, feria local…" /></div>
      <div class="acciones"><button type="button" class="btn secundario" @click="modal = null">Cancelar</button><button class="btn tierra">Crear lote y QR</button></div>
    </form>
  </Modal>

  <Modal v-if="detalle" :titulo="`Lote ${detalle.codigo}`" ancho="760px" @cerrar="detalle = null">
    <div class="rejilla r-2" style="align-items: start">
      <div style="text-align: center">
        <img :src="detalle.qr" alt="Código QR del lote" style="width: 220px; max-width: 100%; border: 1px solid var(--linea); border-radius: 12px; padding: 8px; background: #fff" />
        <div style="display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; margin-top: 10px">
          <button class="btn chico" @click="imprimirEtiqueta"><Icono nombre="descargar" :tam="16" /> Imprimir etiqueta</button>
          <button class="btn secundario chico" @click="copiar(detalle.urlPublica)">Copiar enlace</button>
          <a class="btn secundario chico" :href="detalle.urlPublica" target="_blank" rel="noopener">Ver página pública</a>
        </div>
      </div>
      <div>
        <p style="margin-top: 0">
          <strong>{{ numero(detalle.cantidadKg) }} kg</strong> de {{ detalle.siembra.cultivo }} <small>{{ detalle.siembra.variedad }}</small><br />
          Parcela {{ detalle.siembra.parcela.codigo }} · {{ detalle.siembra.parcela.nombre }}<br />
          Calidad {{ detalle.calidad }} · {{ detalle.destino || 'sin destino' }}
        </p>
        <h3>Cadena del lote</h3>
        <ul class="linea-tiempo">
          <li v-for="e in detalle.eventos" :key="e.id" :class="{ tierra: e.tipo === 'DESPACHO' || e.tipo === 'VENTA' }">
            <span class="hito" />
            <strong>{{ ETIQUETAS_EVENTO[e.tipo] }}</strong> <small>{{ fechaHora(e.fecha) }}</small>
            <div class="apagado" style="font-size: 0.88rem">{{ e.detalle }}</div>
          </li>
        </ul>
        <form v-if="sesion.puede('trazabilidad:escribir')" style="display: flex; gap: 8px; flex-wrap: wrap" @submit.prevent="agregarEvento">
          <select v-model="ev.tipo" class="entrada" style="width: auto"><option v-for="(t, k) in ETIQUETAS_EVENTO" :key="k" :value="k">{{ t }}</option></select>
          <input v-model="ev.detalle" class="entrada" style="flex: 1; min-width: 160px" placeholder="Detalle (opcional)" maxlength="300" />
          <button class="btn chico">Agregar</button>
        </form>
      </div>
    </div>
  </Modal>
</template>
