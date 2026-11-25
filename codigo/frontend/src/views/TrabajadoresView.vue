<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { api } from '../api.js';
import { useSesion } from '../stores/sesion.js';
import { useUi } from '../stores/ui.js';
import Icono from '../components/Icono.vue';
import Modal from '../components/Modal.vue';
import { bs, fecha, haceDiasISO, hoyISO, iniciales, numero } from '../utils/formato.js';

const sesion = useSesion();
const ui = useUi();
const pestana = ref('lista');
const trabajadores = ref([]);
const lotes = ref([]);
const modal = ref(false);
const f = reactive({});

// Pasar lista
const diaLista = ref(hoyISO());
const lista = ref([]);
// Planilla
const rango = reactive({ desde: haceDiasISO(14), hasta: hoyISO() });
const planilla = ref(null);
const pagos = ref([]);

const CARGOS = { JORNALERO: 'Jornalero', CAPATAZ: 'Capataz', TRACTORISTA: 'Tractorista', REGADOR: 'Regador', OTRO: 'Otro' };
const presentes = computed(() => lista.value.filter((x) => x.presente).length);

async function cargar() {
  try {
    trabajadores.value = await api.get('/trabajadores');
    if (sesion.tieneModulo('M0')) lotes.value = await api.get('/lotes').catch(() => []);
    prepararLista();
  } catch (e) {
    ui.error(e);
  }
}
async function prepararLista() {
  let existentes = [];
  try {
    existentes = await api.get(`/trabajadores/asistencias?desde=${diaLista.value}&hasta=${diaLista.value}T23:59:59Z`);
  } catch { /* sin conexión: lista vacía */ }
  lista.value = trabajadores.value.map((t) => {
    const a = existentes.find((x) => x.trabajadorId === t.id);
    return { trabajadorId: t.id, nombre: t.nombre, presente: Boolean(a) || !existentes.length, horas: a?.horas ?? 8, tarea: a?.tarea ?? '', loteId: a?.loteId ?? '' };
  });
}
watch(diaLista, prepararLista);

async function guardarLista() {
  const registros = lista.value.filter((x) => x.presente).map((x) => ({ trabajadorId: x.trabajadorId, fecha: diaLista.value, horas: Number(x.horas), tarea: x.tarea || null, loteId: x.loteId ? Number(x.loteId) : null }));
  if (!registros.length) return ui.avisar('Marca al menos un trabajador presente', 'alerta');
  try {
    const r = await api.postOffline('/trabajadores/asistencias', { registros }, `Asistencia ${diaLista.value}`);
    ui.avisar(r?.encolado ? '📴 Asistencia guardada sin conexión' : `Asistencia guardada: ${r.guardados} trabajadores`);
  } catch (e) {
    ui.error(e);
  }
}

async function cargarPlanilla() {
  try {
    planilla.value = await api.get(`/trabajadores/planilla?desde=${rango.desde}&hasta=${rango.hasta}T23:59:59Z`);
    pagos.value = await api.get('/trabajadores/pagos');
  } catch (e) {
    ui.error(e);
  }
}
async function generarPago(fila) {
  try {
    await api.post(`/trabajadores/${fila.trabajadorId}/pagos`, { desde: rango.desde, hasta: `${rango.hasta}T23:59:59Z` });
    ui.avisar(`Pago de ${fila.nombre} generado: ${bs(fila.montoBs)}`);
    cargarPlanilla();
  } catch (e) {
    ui.error(e);
  }
}
async function marcarPagado(p) {
  try {
    await api.patch(`/trabajadores/pagos/${p.id}`, { estado: 'PAGADO' });
    cargarPlanilla();
  } catch (e) {
    ui.error(e);
  }
}

function abrir(t = null) {
  Object.assign(f, t ? { id: t.id, nombre: t.nombre, documento: t.documento, telefono: t.telefono, cargo: t.cargo, jornalBs: t.jornalBs, activo: t.activo } : { id: null, nombre: '', documento: '', telefono: '', cargo: 'JORNALERO', jornalBs: 110, activo: true });
  modal.value = true;
}
async function guardar() {
  const { id, ...d } = f;
  const cuerpo = { ...d, jornalBs: Number(d.jornalBs), documento: d.documento || null, telefono: d.telefono || null };
  try {
    if (id) await api.patch(`/trabajadores/${id}`, cuerpo);
    else await api.post('/trabajadores', cuerpo);
    ui.avisar('Trabajador guardado');
    modal.value = false;
    cargar();
  } catch (e) {
    ui.error(e);
  }
}

watch(pestana, (p) => p === 'planilla' && cargarPlanilla());
onMounted(cargar);
</script>

<template>
  <div class="encabezado">
    <div>
      <h1>Trabajadores</h1>
      <p>Personal, asistencia diaria y planilla de jornales. <span class="insignia tierra">M3</span></p>
    </div>
    <button v-if="sesion.puede('trabajadores:escribir')" class="btn" @click="abrir()"><Icono nombre="mas" /> Nuevo trabajador</button>
  </div>

  <div class="tarjeta">
    <div class="pestanas">
      <button :class="{ activa: pestana === 'lista' }" @click="pestana = 'lista'">Personal ({{ trabajadores.length }})</button>
      <button v-if="sesion.puede('trabajadores:escribir')" :class="{ activa: pestana === 'asistencia' }" @click="pestana = 'asistencia'">Pasar lista</button>
      <button :class="{ activa: pestana === 'planilla' }" @click="pestana = 'planilla'">Planilla y pagos</button>
    </div>

    <div v-if="pestana === 'lista'" class="tabla-envoltura">
      <table>
        <thead><tr><th>Trabajador</th><th>Cargo</th><th>Teléfono</th><th class="num">Jornal</th><th class="num">Días registrados</th><th /></tr></thead>
        <tbody>
          <tr v-for="t in trabajadores" :key="t.id">
            <td>
              <div style="display: flex; align-items: center; gap: 10px">
                <span style="width: 34px; height: 34px; border-radius: 50%; background: var(--brote-suave); color: var(--bosque); display: grid; place-items: center; font-weight: 700; font-size: 0.8rem">{{ iniciales(t.nombre) }}</span>
                <div><strong>{{ t.nombre }}</strong><br /><small>{{ t.documento }}</small></div>
              </div>
            </td>
            <td><span class="insignia gris">{{ CARGOS[t.cargo] }}</span></td>
            <td>{{ t.telefono || '—' }}</td>
            <td class="num">{{ bs(t.jornalBs) }}</td>
            <td class="num">{{ t._count?.asistencias }}</td>
            <td style="text-align: right"><button v-if="sesion.puede('trabajadores:escribir')" class="btn fantasma chico" @click="abrir(t)">Editar</button></td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else-if="pestana === 'asistencia'">
      <div class="filtros">
        <label><strong>Día</strong></label>
        <input v-model="diaLista" type="date" class="entrada" :max="hoyISO()" />
        <span class="insignia">{{ presentes }} de {{ lista.length }} presentes</span>
        <button class="btn" style="margin-left: auto" @click="guardarLista"><Icono nombre="check" /> Guardar asistencia</button>
      </div>
      <div class="tabla-envoltura">
        <table>
          <thead><tr><th>Presente</th><th>Trabajador</th><th class="num">Horas</th><th>Tarea</th><th>Lote</th></tr></thead>
          <tbody>
            <tr v-for="x in lista" :key="x.trabajadorId" :style="{ opacity: x.presente ? 1 : 0.5 }">
              <td><label class="interruptor"><input v-model="x.presente" type="checkbox" :aria-label="`Presente ${x.nombre}`" /><span /></label></td>
              <td><strong>{{ x.nombre }}</strong></td>
              <td class="num"><input v-model.number="x.horas" type="number" min="0" max="24" step="0.5" class="entrada" style="width: 80px" :disabled="!x.presente" /></td>
              <td><input v-model="x.tarea" class="entrada" placeholder="Riego, cosecha…" :disabled="!x.presente" /></td>
              <td>
                <select v-model="x.loteId" class="entrada" :disabled="!x.presente"><option value="">—</option><option v-for="l in lotes" :key="l.id" :value="l.id">{{ l.codigo }}</option></select>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-else>
      <div class="filtros">
        <input v-model="rango.desde" type="date" class="entrada" aria-label="Desde" />
        <span>a</span>
        <input v-model="rango.hasta" type="date" class="entrada" aria-label="Hasta" />
        <button class="btn secundario" @click="cargarPlanilla">Calcular</button>
        <strong v-if="planilla" style="margin-left: auto; font-size: 1.1rem">Total: {{ bs(planilla.totalBs) }}</strong>
      </div>
      <div v-if="planilla" class="tabla-envoltura">
        <table>
          <thead><tr><th>Trabajador</th><th class="num">Registros</th><th class="num">Jornales (8 h)</th><th class="num">Jornal</th><th class="num">A pagar</th><th /></tr></thead>
          <tbody>
            <tr v-for="r in planilla.filas" :key="r.trabajadorId">
              <td><strong>{{ r.nombre }}</strong></td>
              <td class="num">{{ r.registros }}</td>
              <td class="num">{{ numero(r.dias, 2) }}</td>
              <td class="num">{{ bs(r.jornalBs) }}</td>
              <td class="num"><strong>{{ bs(r.montoBs) }}</strong></td>
              <td style="text-align: right"><button v-if="sesion.puede('pagos:gestionar')" class="btn fantasma chico" @click="generarPago(r)">Generar pago</button></td>
            </tr>
          </tbody>
        </table>
      </div>
      <h3 style="margin-top: 22px">Pagos generados</h3>
      <div v-if="!pagos.length" class="apagado">Aún no hay pagos.</div>
      <div v-for="p in pagos" :key="p.id" style="display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 9px 0; border-bottom: 1px solid #f0ece2; flex-wrap: wrap">
        <span><strong>{{ p.trabajador.nombre }}</strong> <small>{{ fecha(p.desde) }} – {{ fecha(p.hasta) }} · {{ p.dias }} jornales</small></span>
        <span style="display: flex; gap: 8px; align-items: center">
          <strong>{{ bs(p.montoBs) }}</strong>
          <span class="insignia" :class="p.estado === 'PAGADO' ? '' : 'ambar'">{{ p.estado }}</span>
          <button v-if="p.estado === 'PENDIENTE' && sesion.puede('pagos:gestionar')" class="btn chico" @click="marcarPagado(p)">Marcar pagado</button>
        </span>
      </div>
    </div>
  </div>

  <Modal v-if="modal" :titulo="f.id ? 'Editar trabajador' : 'Nuevo trabajador'" @cerrar="modal = false">
    <form @submit.prevent="guardar">
      <div class="campo"><label>Nombre completo</label><input v-model="f.nombre" required minlength="3" /></div>
      <div class="fila-campos">
        <div class="campo"><label>Documento</label><input v-model="f.documento" /></div>
        <div class="campo"><label>Teléfono</label><input v-model="f.telefono" inputmode="tel" /></div>
      </div>
      <div class="fila-campos">
        <div class="campo"><label>Cargo</label><select v-model="f.cargo"><option v-for="(t, k) in CARGOS" :key="k" :value="k">{{ t }}</option></select></div>
        <div class="campo"><label>Jornal (Bs/día)</label><input v-model.number="f.jornalBs" type="number" min="0" step="1" required /></div>
      </div>
      <label v-if="f.id" style="display: flex; gap: 10px; align-items: center; margin-bottom: 12px"><span class="interruptor"><input v-model="f.activo" type="checkbox" /><span /></span> Activo</label>
      <div class="acciones"><button type="button" class="btn secundario" @click="modal = false">Cancelar</button><button class="btn">Guardar</button></div>
    </form>
  </Modal>
</template>
