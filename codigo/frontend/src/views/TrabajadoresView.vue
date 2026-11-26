<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { api } from '../api.js';
import { useSesion } from '../stores/sesion.js';
import { useUi } from '../stores/ui.js';
import Icono from '../components/Icono.vue';
import Modal from '../components/Modal.vue';
import { bs, fecha, haceDiasISO, hoyISO, iniciales, numero } from '../utils/formato.js';
import { CLASE_ESTADO_TAREA, CLASE_PRIORIDAD, ETIQUETAS_ESTADO_TAREA, ETIQUETAS_PRIORIDAD, tareaVencida } from '../utils/tareas.js';

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
// Tareas asignadas
const tareas = ref([]);
const filtroTareas = ref('ACTIVAS');
const modalTarea = ref(false);
const ft = reactive({});
const tareasFiltradas = computed(() =>
  filtroTareas.value === 'ACTIVAS' ? tareas.value.filter((t) => ['PENDIENTE', 'EN_CURSO'].includes(t.estado)) : tareas.value
);
const trabajadorTarea = computed(() => trabajadores.value.find((t) => t.id === Number(ft.trabajadorId)));

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

async function cargarTareas() {
  try {
    tareas.value = await api.get('/tareas');
  } catch (e) {
    ui.error(e);
  }
}
function abrirTarea(t = null) {
  Object.assign(ft, { trabajadorId: t?.id ?? trabajadores.value[0]?.id, titulo: '', descripcion: '', loteId: '', prioridad: 'MEDIA', fechaVencimiento: hoyISO() });
  modalTarea.value = true;
}
async function guardarTarea() {
  const cuerpo = {
    trabajadorId: Number(ft.trabajadorId),
    titulo: ft.titulo,
    descripcion: ft.descripcion || null,
    loteId: ft.loteId ? Number(ft.loteId) : null,
    prioridad: ft.prioridad,
    fechaVencimiento: ft.fechaVencimiento || null,
  };
  try {
    const r = await api.post('/tareas', cuerpo);
    ui.avisar(r.notificada ? 'Tarea asignada y avisada por WhatsApp' : 'Tarea asignada (sin aviso por WhatsApp: el trabajador no dio consentimiento)');
    modalTarea.value = false;
    pestana.value = 'tareas';
    cargarTareas();
  } catch (e) {
    ui.error(e);
  }
}
async function accionTarea(t, accion) {
  try {
    await api.put(`/tareas/${t.id}/${accion}`);
    cargarTareas();
  } catch (e) {
    ui.error(e);
  }
}

function abrir(t = null) {
  Object.assign(f, t ? { id: t.id, nombre: t.nombre, documento: t.documento, telefono: t.telefono, cargo: t.cargo, jornalBs: t.jornalBs, activo: t.activo, consentimientoWhatsapp: t.consentimientoWhatsapp } : { id: null, nombre: '', documento: '', telefono: '', cargo: 'JORNALERO', jornalBs: 110, activo: true, consentimientoWhatsapp: false });
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

watch(pestana, (p) => {
  if (p === 'planilla') cargarPlanilla();
  if (p === 'tareas') cargarTareas();
});
onMounted(cargar);
</script>

<template>
  <div class="encabezado">
    <div>
      <h1>Trabajadores</h1>
      <p>Personal, asistencia diaria y planilla de jornales. <span class="insignia tierra">M3</span></p>
    </div>
    <div class="acciones" style="margin: 0">
      <button v-if="sesion.puede('tareas:escribir')" class="btn secundario" @click="abrirTarea()"><Icono nombre="tarea" /> Asignar tarea</button>
      <button v-if="sesion.puede('trabajadores:escribir')" class="btn" @click="abrir()"><Icono nombre="mas" /> Nuevo trabajador</button>
    </div>
  </div>

  <div class="tarjeta">
    <div class="pestanas">
      <button :class="{ activa: pestana === 'lista' }" @click="pestana = 'lista'">Personal ({{ trabajadores.length }})</button>
      <button v-if="sesion.puede('trabajadores:escribir')" :class="{ activa: pestana === 'asistencia' }" @click="pestana = 'asistencia'">Pasar lista</button>
      <button v-if="sesion.puede('tareas:escribir')" :class="{ activa: pestana === 'tareas' }" @click="pestana = 'tareas'">Tareas asignadas</button>
      <button :class="{ activa: pestana === 'planilla' }" @click="pestana = 'planilla'">Planilla y pagos</button>
    </div>

    <div v-if="pestana === 'lista'" class="tabla-envoltura">
      <table>
        <thead><tr><th>Trabajador</th><th>Cargo</th><th>Teléfono</th><th>WhatsApp</th><th class="num">Jornal</th><th class="num">Días registrados</th><th /></tr></thead>
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
            <td><span class="insignia" :class="t.consentimientoWhatsapp ? '' : 'gris'" :title="t.fechaConsentimiento ? `Desde ${fecha(t.fechaConsentimiento)}` : ''">{{ t.consentimientoWhatsapp ? 'Acepta avisos' : 'Sin consentimiento' }}</span></td>
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

    <div v-else-if="pestana === 'tareas'">
      <div class="filtros">
        <select v-model="filtroTareas" class="entrada" aria-label="Filtro de tareas"><option value="ACTIVAS">Solo activas</option><option value="TODAS">Todas</option></select>
        <span class="insignia">{{ tareasFiltradas.length }} tarea(s)</span>
      </div>
      <div v-if="!tareasFiltradas.length" class="apagado">No hay tareas para mostrar.</div>
      <div v-else class="tabla-envoltura">
        <table>
          <thead><tr><th>Tarea</th><th>Trabajador</th><th>Lote</th><th>Prioridad</th><th>Estado</th><th>Para</th><th>Aviso</th><th /></tr></thead>
          <tbody>
            <tr v-for="t in tareasFiltradas" :key="t.id">
              <td><strong>{{ t.titulo }}</strong><br /><small>{{ t.descripcion }}</small></td>
              <td>{{ t.trabajador?.nombre }}</td>
              <td>{{ t.lote?.codigo || '—' }}</td>
              <td><span class="insignia" :class="CLASE_PRIORIDAD[t.prioridad]">{{ ETIQUETAS_PRIORIDAD[t.prioridad] }}</span></td>
              <td><span class="insignia" :class="CLASE_ESTADO_TAREA[t.estado]">{{ ETIQUETAS_ESTADO_TAREA[t.estado] }}</span> <span v-if="tareaVencida(t)" class="insignia rojo">Vencida</span></td>
              <td>{{ fecha(t.fechaVencimiento) }}</td>
              <td><small>{{ t.notificada ? 'WhatsApp ✓' : '—' }}</small></td>
              <td style="text-align: right; white-space: nowrap">
                <template v-if="['PENDIENTE', 'EN_CURSO'].includes(t.estado)">
                  <button class="btn fantasma chico" @click="accionTarea(t, 'completar')">Hecha</button>
                  <button class="btn fantasma chico" @click="accionTarea(t, 'cancelar')">Cancelar</button>
                </template>
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
      <label style="display: flex; gap: 10px; align-items: center; margin-bottom: 12px"><span class="interruptor"><input v-model="f.consentimientoWhatsapp" type="checkbox" /><span /></span> Aceptó recibir avisos de tareas por WhatsApp (consentimiento informado)</label>
      <label v-if="f.id" style="display: flex; gap: 10px; align-items: center; margin-bottom: 12px"><span class="interruptor"><input v-model="f.activo" type="checkbox" /><span /></span> Activo</label>
      <div class="acciones"><button type="button" class="btn secundario" @click="modal = false">Cancelar</button><button class="btn">Guardar</button></div>
    </form>
  </Modal>

  <Modal v-if="modalTarea" titulo="Asignar tarea" @cerrar="modalTarea = false">
    <form @submit.prevent="guardarTarea">
      <div class="campo"><label>Trabajador</label><select v-model="ft.trabajadorId" required><option v-for="t in trabajadores" :key="t.id" :value="t.id">{{ t.nombre }}</option></select></div>
      <p v-if="trabajadorTarea && !trabajadorTarea.consentimientoWhatsapp" class="nota-alerta">
        {{ trabajadorTarea.nombre }} no dio consentimiento para WhatsApp: la tarea se asigna, pero no se le enviará aviso.
      </p>
      <div class="campo"><label>Tarea</label><input v-model="ft.titulo" required minlength="3" maxlength="120" placeholder="Ej.: Revisar goteros del L-01" /></div>
      <div class="campo"><label>Detalle (opcional)</label><textarea v-model="ft.descripcion" rows="2" maxlength="500" /></div>
      <div class="fila-campos">
        <div class="campo"><label>Lote (opcional)</label><select v-model="ft.loteId"><option value="">— Sin lote —</option><option v-for="l in lotes" :key="l.id" :value="l.id">{{ l.codigo }} · {{ l.nombre }}</option></select></div>
        <div class="campo"><label>Prioridad</label><select v-model="ft.prioridad"><option v-for="(t, k) in ETIQUETAS_PRIORIDAD" :key="k" :value="k">{{ t }}</option></select></div>
      </div>
      <div class="campo"><label>Fecha límite</label><input v-model="ft.fechaVencimiento" type="date" /></div>
      <div class="acciones"><button type="button" class="btn secundario" @click="modalTarea = false">Cancelar</button><button class="btn">Asignar</button></div>
    </form>
  </Modal>
</template>
