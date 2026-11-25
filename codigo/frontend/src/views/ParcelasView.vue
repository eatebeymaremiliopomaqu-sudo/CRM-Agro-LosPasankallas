<script setup>
import { onMounted, reactive, ref } from 'vue';
import { api } from '../api.js';
import { useSesion } from '../stores/sesion.js';
import { useUi } from '../stores/ui.js';
import Icono from '../components/Icono.vue';
import Modal from '../components/Modal.vue';
import MapaParcelas from '../components/MapaParcelas.vue';
import { ETIQUETAS_LABOR, fecha, hoyISO } from '../utils/formato.js';

const sesion = useSesion();
const ui = useUi();
const parcelas = ref([]);
const cargando = ref(true);
const detalle = ref(null);
const modal = ref(null); // 'parcela' | 'siembra'
const form = reactive({});

async function cargar() {
  cargando.value = true;
  try {
    parcelas.value = await api.get('/parcelas');
  } catch (e) {
    ui.error(e);
  } finally {
    cargando.value = false;
  }
}

async function verDetalle(p) {
  try {
    detalle.value = await api.get(`/parcelas/${p.id}`);
  } catch (e) {
    ui.error(e);
  }
}

function nuevaParcela() {
  const n = parcelas.value.length + 1;
  Object.assign(form, { id: null, codigo: `P-${String(n).padStart(2, '0')}`, nombre: '', areaHa: 1, tipoSuelo: '', riego: 'GOTEO', lat: sesion.finca?.lat ?? null, lng: sesion.finca?.lng ?? null });
  modal.value = 'parcela';
}
function editarParcela(p) {
  Object.assign(form, { id: p.id, codigo: p.codigo, nombre: p.nombre, areaHa: p.areaHa, tipoSuelo: p.tipoSuelo, riego: p.riego, lat: p.lat, lng: p.lng });
  modal.value = 'parcela';
}
function nuevaSiembra(p) {
  Object.assign(form, { parcelaId: p.id, codigo: p.codigo, cultivo: '', variedad: '', fechaSiembra: hoyISO(), fechaCosechaEst: '' });
  modal.value = 'siembra';
}
function usarUbicacion() {
  navigator.geolocation?.getCurrentPosition(
    (pos) => Object.assign(form, { lat: +pos.coords.latitude.toFixed(6), lng: +pos.coords.longitude.toFixed(6) }),
    () => ui.avisar('No se pudo obtener la ubicación GPS', 'alerta')
  );
}

async function guardarParcela() {
  const { id, ...datos } = form;
  const cuerpo = { codigo: datos.codigo, nombre: datos.nombre, areaHa: Number(datos.areaHa), tipoSuelo: datos.tipoSuelo || null, riego: datos.riego || null, lat: datos.lat === '' || datos.lat == null ? null : Number(datos.lat), lng: datos.lng === '' || datos.lng == null ? null : Number(datos.lng) };
  try {
    if (id) await api.patch(`/parcelas/${id}`, cuerpo);
    else await api.post('/parcelas', cuerpo);
    ui.avisar(id ? 'Parcela actualizada' : 'Parcela creada');
    modal.value = null;
    cargar();
  } catch (e) {
    ui.error(e);
  }
}
async function guardarSiembra() {
  try {
    await api.post(`/parcelas/${form.parcelaId}/siembras`, { cultivo: form.cultivo, variedad: form.variedad || null, fechaSiembra: form.fechaSiembra, fechaCosechaEst: form.fechaCosechaEst || null });
    ui.avisar('Siembra registrada 🌱');
    modal.value = null;
    cargar();
  } catch (e) {
    ui.error(e);
  }
}

const diasDesde = (f) => Math.max(0, Math.floor((Date.now() - new Date(f)) / 86400000));
onMounted(cargar);
</script>

<template>
  <div class="encabezado">
    <div>
      <h1>Parcelas y cultivos</h1>
      <p>Mapa de la finca y ciclo de cultivo de cada parcela. <span class="insignia tierra">M1</span></p>
    </div>
    <button v-if="sesion.puede('parcelas:escribir')" class="btn" @click="nuevaParcela"><Icono nombre="mas" /> Nueva parcela</button>
  </div>

  <div class="tarjeta">
    <MapaParcelas :parcelas="parcelas.filter((p) => p.activa)" :centro="[sesion.finca?.lat ?? -17.9135, sesion.finca?.lng ?? -64.5312]" @seleccionar="verDetalle" />
  </div>

  <div class="tarjeta">
    <div v-if="cargando" class="esqueleto" style="height: 120px" />
    <div v-else-if="!parcelas.length" class="vacio"><Icono nombre="parcela" :tam="40" /><p>Todavía no hay parcelas. Crea la primera.</p></div>
    <div v-else class="tabla-envoltura">
      <table>
        <thead><tr><th>Código</th><th>Nombre</th><th class="num">Área</th><th>Cultivo actual</th><th>Riego</th><th class="num">Labores</th><th /></tr></thead>
        <tbody>
          <tr v-for="p in parcelas" :key="p.id" :style="{ opacity: p.activa ? 1 : 0.5 }">
            <td><strong>{{ p.codigo }}</strong></td>
            <td>{{ p.nombre }}</td>
            <td class="num">{{ p.areaHa }} ha</td>
            <td>
              <template v-if="p.siembraActual">
                <span class="insignia">{{ p.siembraActual.cultivo }}</span>
                <small> · día {{ diasDesde(p.siembraActual.fechaSiembra) }}</small>
              </template>
              <span v-else class="insignia gris">Sin siembra</span>
            </td>
            <td>{{ p.riego || '—' }}</td>
            <td class="num">{{ p._count?.labores ?? 0 }}</td>
            <td style="white-space: nowrap; text-align: right">
              <button class="btn fantasma chico" @click="verDetalle(p)">Ver</button>
              <template v-if="sesion.puede('parcelas:escribir')">
                <button class="btn fantasma chico" @click="nuevaSiembra(p)">+ Siembra</button>
                <button class="btn fantasma chico" @click="editarParcela(p)">Editar</button>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <Modal v-if="modal === 'parcela'" :titulo="form.id ? 'Editar parcela' : 'Nueva parcela'" @cerrar="modal = null">
    <form @submit.prevent="guardarParcela">
      <div class="fila-campos">
        <div class="campo"><label>Código</label><input v-model="form.codigo" required pattern="P-\d{2,3}" title="Formato P-01" /></div>
        <div class="campo"><label>Nombre</label><input v-model="form.nombre" required minlength="2" /></div>
        <div class="campo"><label>Área (ha)</label><input v-model.number="form.areaHa" type="number" step="0.01" min="0.01" required /></div>
      </div>
      <div class="fila-campos">
        <div class="campo"><label>Tipo de suelo</label><input v-model="form.tipoSuelo" placeholder="Franco arenoso" /></div>
        <div class="campo"><label>Riego</label>
          <select v-model="form.riego"><option value="GOTEO">Goteo</option><option value="ASPERSION">Aspersión</option><option value="GRAVEDAD">Gravedad</option><option value="SECANO">Secano</option></select>
        </div>
      </div>
      <div class="fila-campos">
        <div class="campo"><label>Latitud</label><input v-model="form.lat" type="number" step="any" /></div>
        <div class="campo"><label>Longitud</label><input v-model="form.lng" type="number" step="any" /></div>
      </div>
      <button type="button" class="btn secundario chico" @click="usarUbicacion"><Icono nombre="ubicacion" :tam="16" /> Usar mi ubicación GPS</button>
      <div class="acciones"><button type="button" class="btn secundario" @click="modal = null">Cancelar</button><button class="btn">Guardar</button></div>
    </form>
  </Modal>

  <Modal v-if="modal === 'siembra'" :titulo="`Nueva siembra en ${form.codigo}`" @cerrar="modal = null">
    <form @submit.prevent="guardarSiembra">
      <div class="fila-campos">
        <div class="campo"><label>Cultivo</label><input v-model="form.cultivo" required placeholder="Tomate" /></div>
        <div class="campo"><label>Variedad</label><input v-model="form.variedad" placeholder="Santa Cruz Kada" /></div>
      </div>
      <div class="fila-campos">
        <div class="campo"><label>Fecha de siembra</label><input v-model="form.fechaSiembra" type="date" required /></div>
        <div class="campo"><label>Cosecha estimada</label><input v-model="form.fechaCosechaEst" type="date" /></div>
      </div>
      <div class="acciones"><button type="button" class="btn secundario" @click="modal = null">Cancelar</button><button class="btn">Registrar siembra</button></div>
    </form>
  </Modal>

  <Modal v-if="detalle" :titulo="`${detalle.codigo} · ${detalle.nombre}`" ancho="720px" @cerrar="detalle = null">
    <div class="fila-campos" style="margin-bottom: 12px">
      <div><small>Área</small><div><strong>{{ detalle.areaHa }} ha</strong></div></div>
      <div><small>Suelo</small><div><strong>{{ detalle.tipoSuelo || '—' }}</strong></div></div>
      <div><small>Riego</small><div><strong>{{ detalle.riego || '—' }}</strong></div></div>
    </div>
    <h3>Ciclos de cultivo</h3>
    <div v-for="s in detalle.siembras" :key="s.id" style="display: flex; justify-content: space-between; padding: 6px 0">
      <span>{{ s.cultivo }} <small>{{ s.variedad }}</small></span>
      <span><small>{{ fecha(s.fechaSiembra) }}</small> <span class="insignia" :class="s.estado === 'EN_CURSO' ? '' : 'gris'">{{ s.estado.replace('_', ' ') }}</span></span>
    </div>
    <h3 style="margin-top: 14px">Últimas labores</h3>
    <div v-if="!detalle.labores.length" class="apagado">Sin labores.</div>
    <div v-for="l in detalle.labores" :key="l.id" style="display: flex; justify-content: space-between; gap: 10px; padding: 6px 0; border-bottom: 1px solid #f0ece2">
      <span><strong>{{ ETIQUETAS_LABOR[l.tipo] }}</strong> <small>{{ l.aplicacion ? `· ${l.aplicacion.producto}` : '' }}</small></span>
      <small>{{ fecha(l.fecha) }}</small>
    </div>
  </Modal>
</template>
