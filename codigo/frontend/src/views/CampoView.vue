<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '../api.js';
import { useSesion } from '../stores/sesion.js';
import { useUi } from '../stores/ui.js';
import Icono from '../components/Icono.vue';
import Modal from '../components/Modal.vue';
import { COLORES_LABOR, ETIQUETAS_LABOR, ETIQUETAS_OBS, claseSeveridad, fecha, hoyISO, bs } from '../utils/formato.js';

const sesion = useSesion();
const ui = useUi();
const ruta = useRoute();
const pestana = ref('labores');
const labores = ref([]);
const observaciones = ref([]);
const lotes = ref([]);
const trabajadores = ref([]);
const filtro = reactive({ loteId: '', tipo: '' });
const modal = ref(null);
const f = reactive({});

const conAplicacion = computed(() => ['FUMIGACION', 'FERTILIZACION'].includes(f.tipo) && sesion.puede('aplicaciones:escribir'));
const laboresFiltradas = computed(() => labores.value.filter((l) => (!filtro.loteId || l.loteId === Number(filtro.loteId)) && (!filtro.tipo || l.tipo === filtro.tipo)));
const ORIGEN = { WEB: ['gris', 'Web'], WHATSAPP: ['', 'WhatsApp'], AGENTE: ['azul', 'Agente IA'], OFFLINE: ['tierra', 'Sin conexión'] };

async function cargar() {
  try {
    const [l, o, p] = await Promise.all([api.get('/campo/labores'), api.get('/campo/observaciones'), api.get('/lotes')]);
    labores.value = l;
    observaciones.value = o;
    lotes.value = p.filter((x) => x.activo);
    if (sesion.tieneModulo('M3') && sesion.puede('trabajadores:leer')) trabajadores.value = await api.get('/trabajadores').catch(() => []);
  } catch (e) {
    ui.error(e);
  }
}

function nuevaLabor() {
  Object.keys(f).forEach((k) => delete f[k]);
  Object.assign(f, { loteId: lotes.value[0]?.id, tipo: 'RIEGO', fecha: hoyISO(), horas: 2, costoBs: 0, descripcion: '', trabajadorId: '', producto: '', ingredienteActivo: '', cantidadUsada: '', unidad: 'L', periodoCarenciaDias: '', responsableTecnico: sesion.usuario?.nombre || '' });
  modal.value = 'labor';
}
function nuevaObs() {
  Object.keys(f).forEach((k) => delete f[k]);
  Object.assign(f, { loteId: lotes.value[0]?.id, tipo: 'PLAGA', severidad: 2, nota: '', fecha: hoyISO() });
  modal.value = 'obs';
}

async function guardarLabor() {
  const cuerpo = {
    loteId: Number(f.loteId), tipo: f.tipo, fecha: f.fecha, horas: Number(f.horas) || 0, costoBs: Number(f.costoBs) || 0,
    descripcion: f.descripcion || null, trabajadorId: f.trabajadorId ? Number(f.trabajadorId) : null, origen: 'WEB',
  };
  if (conAplicacion.value && f.producto) {
    cuerpo.aplicacion = {
      producto: f.producto, ingredienteActivo: f.ingredienteActivo || null,
      cantidadUsada: f.cantidadUsada === '' ? null : Number(f.cantidadUsada), unidad: f.unidad || null,
      periodoCarenciaDias: f.periodoCarenciaDias === '' ? null : Number(f.periodoCarenciaDias), responsableTecnico: f.responsableTecnico,
    };
  }
  try {
    const r = await api.postOffline('/campo/labores', cuerpo, `Labor ${ETIQUETAS_LABOR[f.tipo]}`);
    ui.avisar(r?.encolado ? '📴 Sin señal: la labor se guardó en el dispositivo y se enviará luego' : 'Labor registrada ✔');
    modal.value = null;
    if (!r?.encolado) cargar();
  } catch (e) {
    ui.error(e);
  }
}
async function guardarObs() {
  try {
    const r = await api.postOffline('/campo/observaciones', { loteId: Number(f.loteId), tipo: f.tipo, severidad: Number(f.severidad), nota: f.nota, fecha: f.fecha }, `Observación ${ETIQUETAS_OBS[f.tipo]}`);
    ui.avisar(r?.encolado ? '📴 Observación guardada sin conexión' : 'Observación registrada ✔');
    modal.value = null;
    if (!r?.encolado) cargar();
  } catch (e) {
    ui.error(e);
  }
}

onMounted(async () => {
  await cargar();
  if (ruta.query.nuevo) nuevaLabor();
});
</script>

<template>
  <div class="encabezado">
    <div>
      <h1>Control técnico de campo</h1>
      <p>Labores, aplicaciones registradas y monitoreo fitosanitario. <span class="insignia tierra">M1</span></p>
    </div>
    <div v-if="sesion.puede('labores:escribir')" style="display: flex; gap: 8px">
      <button class="btn secundario" @click="nuevaObs"><Icono nombre="alerta" /> Observación</button>
      <button class="btn" @click="nuevaLabor"><Icono nombre="mas" /> Labor</button>
    </div>
  </div>

  <div class="tarjeta">
    <div class="pestanas">
      <button :class="{ activa: pestana === 'labores' }" @click="pestana = 'labores'">Labores ({{ labores.length }})</button>
      <button :class="{ activa: pestana === 'obs' }" @click="pestana = 'obs'">Observaciones ({{ observaciones.length }})</button>
    </div>

    <template v-if="pestana === 'labores'">
      <div class="filtros">
        <select v-model="filtro.loteId" class="entrada" aria-label="Filtrar por lote"><option value="">Todos los lotes</option><option v-for="l in lotes" :key="l.id" :value="l.id">{{ l.codigo }} · {{ l.nombre }}</option></select>
        <select v-model="filtro.tipo" class="entrada" aria-label="Filtrar por tipo"><option value="">Todos los tipos</option><option v-for="(t, k) in ETIQUETAS_LABOR" :key="k" :value="k">{{ t }}</option></select>
        <small style="margin-left: auto">{{ laboresFiltradas.length }} registros</small>
      </div>
      <div class="tabla-envoltura">
        <table>
          <thead><tr><th>Fecha</th><th>Labor</th><th>Lote</th><th>Aplicación registrada</th><th class="num">Horas</th><th class="num">Costo</th><th>Origen</th></tr></thead>
          <tbody>
            <tr v-for="l in laboresFiltradas" :key="l.id">
              <td style="white-space: nowrap">{{ fecha(l.fecha) }}</td>
              <td><span class="punto" :style="{ color: COLORES_LABOR[l.tipo] }" /> <strong>{{ ETIQUETAS_LABOR[l.tipo] }}</strong><br /><small>{{ l.trabajador?.nombre || l.registradoPor?.nombre || '' }}</small></td>
              <td>{{ l.lote.codigo }}</td>
              <td>
                <template v-if="l.aplicacion">
                  {{ l.aplicacion.producto }}<br />
                  <small>{{ l.aplicacion.cantidadUsada ?? '—' }} {{ l.aplicacion.unidad }} · carencia {{ l.aplicacion.periodoCarenciaDias ?? '—' }} d · {{ l.aplicacion.responsableTecnico }}</small>
                </template>
                <span v-else class="apagado">—</span>
              </td>
              <td class="num">{{ l.horas }}</td>
              <td class="num">{{ l.costoBs ? bs(l.costoBs) : '—' }}</td>
              <td><span class="insignia" :class="ORIGEN[l.origen]?.[0]">{{ ORIGEN[l.origen]?.[1] || l.origen }}</span></td>
            </tr>
          </tbody>
        </table>
        <div v-if="!laboresFiltradas.length" class="vacio">No hay labores con esos filtros.</div>
      </div>
    </template>

    <template v-else>
      <div class="tabla-envoltura">
        <table>
          <thead><tr><th>Fecha</th><th>Lote</th><th>Tipo</th><th>Severidad</th><th>Nota</th></tr></thead>
          <tbody>
            <tr v-for="o in observaciones" :key="o.id">
              <td style="white-space: nowrap">{{ fecha(o.fecha) }}</td>
              <td>{{ o.lote.codigo }}</td>
              <td>{{ ETIQUETAS_OBS[o.tipo] }}</td>
              <td><span class="insignia" :class="claseSeveridad(o.severidad)">{{ '●'.repeat(o.severidad) }}{{ '○'.repeat(5 - o.severidad) }}</span></td>
              <td>{{ o.nota }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>

  <Modal v-if="modal === 'labor'" titulo="Registrar labor" ancho="640px" @cerrar="modal = null">
    <form @submit.prevent="guardarLabor">
      <div class="fila-campos">
        <div class="campo"><label>Lote</label><select v-model="f.loteId" required><option v-for="l in lotes" :key="l.id" :value="l.id">{{ l.codigo }} · {{ l.nombre }}</option></select></div>
        <div class="campo"><label>Tipo de labor</label><select v-model="f.tipo"><option v-for="(t, k) in ETIQUETAS_LABOR" :key="k" :value="k">{{ t }}</option></select></div>
        <div class="campo"><label>Fecha</label><input v-model="f.fecha" type="date" required :max="hoyISO()" /></div>
      </div>
      <div class="fila-campos">
        <div class="campo"><label>Horas</label><input v-model.number="f.horas" type="number" min="0" max="24" step="0.5" /></div>
        <div class="campo"><label>Costo (Bs)</label><input v-model.number="f.costoBs" type="number" min="0" step="0.5" /></div>
        <div v-if="trabajadores.length" class="campo"><label>Trabajador</label><select v-model="f.trabajadorId"><option value="">—</option><option v-for="t in trabajadores" :key="t.id" :value="t.id">{{ t.nombre }}</option></select></div>
      </div>
      <div class="campo"><label>Descripción</label><textarea v-model="f.descripcion" rows="2" maxlength="500" /></div>

      <div v-if="conAplicacion" class="tarjeta" style="background: var(--tierra-suave); border-color: #ecd3b4; box-shadow: none; padding: 16px">
        <h3 style="display: flex; align-items: center; gap: 6px"><Icono nombre="escudo" :tam="18" /> Registro de aplicación</h3>
        <p style="font-size: 0.85rem; margin-top: 0; color: #7a4e1d">
          Anota lo que <strong>efectivamente se aplicó</strong> por indicación del técnico responsable. El sistema no sugiere productos ni dosis.
        </p>
        <div class="fila-campos">
          <div class="campo"><label>Producto comercial</label><input v-model="f.producto" :required="f.tipo === 'FUMIGACION'" /></div>
          <div class="campo"><label>Ingrediente activo</label><input v-model="f.ingredienteActivo" /></div>
        </div>
        <div class="fila-campos">
          <div class="campo"><label>Cantidad usada</label><input v-model="f.cantidadUsada" type="number" min="0" step="any" /></div>
          <div class="campo"><label>Unidad</label><select v-model="f.unidad"><option>L</option><option>ml</option><option>kg</option><option>g</option><option>saco</option><option>bolsa</option></select></div>
          <div class="campo"><label>Carencia (días)</label><input v-model="f.periodoCarenciaDias" type="number" min="0" max="365" /></div>
        </div>
        <div class="campo" style="margin-bottom: 0"><label>Responsable técnico</label><input v-model="f.responsableTecnico" required minlength="3" /></div>
      </div>
      <p v-else-if="['FUMIGACION', 'FERTILIZACION'].includes(f.tipo)" class="apagado" style="font-size: 0.85rem">Sólo un técnico puede registrar el detalle de productos aplicados.</p>

      <div class="acciones"><button type="button" class="btn secundario" @click="modal = null">Cancelar</button><button class="btn">Guardar labor</button></div>
    </form>
  </Modal>

  <Modal v-if="modal === 'obs'" titulo="Registrar observación" @cerrar="modal = null">
    <form @submit.prevent="guardarObs">
      <div class="fila-campos">
        <div class="campo"><label>Lote</label><select v-model="f.loteId" required><option v-for="l in lotes" :key="l.id" :value="l.id">{{ l.codigo }} · {{ l.nombre }}</option></select></div>
        <div class="campo"><label>Tipo</label><select v-model="f.tipo"><option v-for="(t, k) in ETIQUETAS_OBS" :key="k" :value="k">{{ t }}</option></select></div>
      </div>
      <div class="campo">
        <label>Severidad: {{ f.severidad }}/5</label>
        <input v-model.number="f.severidad" type="range" min="1" max="5" style="accent-color: var(--hoja); padding: 0" />
      </div>
      <div class="campo"><label>¿Qué se observó?</label><textarea v-model="f.nota" rows="3" required minlength="3" maxlength="500" placeholder="Presencia de pulgón en el envés de las hojas…" /></div>
      <div class="acciones"><button type="button" class="btn secundario" @click="modal = null">Cancelar</button><button class="btn">Guardar</button></div>
    </form>
  </Modal>
</template>
