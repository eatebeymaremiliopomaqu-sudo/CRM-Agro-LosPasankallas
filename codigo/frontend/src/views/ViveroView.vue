<script setup>
// M6 · Vivero: lotes de plantines (siembra → germinación → crecimiento → listo) y venta por M5.
import { computed, onMounted, reactive, ref } from 'vue';
import { api } from '../api.js';
import { useSesion } from '../stores/sesion.js';
import { useUi } from '../stores/ui.js';
import Icono from '../components/Icono.vue';
import Modal from '../components/Modal.vue';
import { bs, fecha, hoyISO, numero } from '../utils/formato.js';

const sesion = useSesion();
const ui = useUi();
const lotes = ref([]);
const clientes = ref([]);
const modal = ref(null);
const f = reactive({});
const ETAPAS = { SIEMBRA: 'Siembra', GERMINACION: 'Germinación', CRECIMIENTO: 'Crecimiento', LISTO: 'Listo para venta', AGOTADO: 'Agotado' };
const CLASE_ETAPA = { SIEMBRA: 'gris', GERMINACION: 'azul', CRECIMIENTO: 'ambar', LISTO: '', AGOTADO: 'gris' };
const puedeEscribir = computed(() => sesion.puede('vivero:escribir'));
const puedeVender = computed(() => sesion.tieneModulo('M5') && sesion.puede('ventas:escribir'));
const totales = computed(() => ({
  disponibles: lotes.value.reduce((s, l) => s + l.disponibles, 0),
  vendidos: lotes.value.reduce((s, l) => s + l.vendidos, 0),
  germ: lotes.value.filter((l) => l.germinadas > 0),
}));
const germPromedio = computed(() => {
  const g = totales.value.germ;
  const sem = g.reduce((s, l) => s + l.semillasSembradas, 0);
  return sem ? Math.round((g.reduce((s, l) => s + l.germinadas, 0) / sem) * 1000) / 10 : 0;
});

async function cargar() {
  try {
    lotes.value = await api.get('/vivero');
  } catch (e) {
    ui.error(e);
  }
}
function nuevo() {
  Object.assign(f, { especie: '', variedad: '', fechaSiembra: hoyISO(), bandejas: 1, semillasSembradas: 200, precioBs: 0.8, costoBs: 0 });
  modal.value = 'nuevo';
}
function avance(l) {
  Object.assign(f, { lote: l, germinadas: l.germinadas, merma: l.merma, etapa: l.etapa === 'AGOTADO' ? 'LISTO' : l.etapa, precioBs: l.precioBs });
  modal.value = 'avance';
}
async function vender(l) {
  if (!clientes.value.length) clientes.value = await api.get('/clientes').catch(() => []);
  Object.assign(f, { lote: l, clienteId: clientes.value[0]?.id, cantidad: Math.min(100, l.disponibles), precioBs: l.precioBs, pagado: true });
  modal.value = 'venta';
}
async function guardarNuevo() {
  try {
    await api.post('/vivero', { especie: f.especie, variedad: f.variedad || null, fechaSiembra: f.fechaSiembra, bandejas: Number(f.bandejas), semillasSembradas: Number(f.semillasSembradas), precioBs: Number(f.precioBs), costoBs: Number(f.costoBs) });
    modal.value = null;
    ui.avisar('Lote de plantines registrado');
    cargar();
  } catch (e) {
    ui.error(e);
  }
}
async function guardarAvance() {
  try {
    await api.patch(`/vivero/${f.lote.id}`, { germinadas: Number(f.germinadas), merma: Number(f.merma), etapa: f.etapa, precioBs: Number(f.precioBs) });
    modal.value = null;
    ui.avisar('Avance guardado');
    cargar();
  } catch (e) {
    ui.error(e);
  }
}
async function guardarVenta() {
  const cantidad = Number(f.cantidad);
  const subtotal = Math.round(cantidad * Number(f.precioBs) * 100) / 100;
  try {
    const v = await api.post('/ventas', {
      clienteId: Number(f.clienteId),
      notas: `Venta de plantines ${f.lote.codigo}`,
      detalles: [{ producto: `Plantín de ${f.lote.especie.toLowerCase()} ${f.lote.variedad || ''}`.trim(), cantidad, unidad: 'plantin', precioBs: Number(f.precioBs), subtotal, lotePlantinId: f.lote.id }],
    });
    if (f.pagado && subtotal > 0) await api.post(`/ventas/${v.id}/cobros`, { montoBs: subtotal, metodo: 'EFECTIVO' });
    modal.value = null;
    ui.avisar(`Venta registrada en M5: ${numero(cantidad)} plantines por ${bs(subtotal)}`);
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
      <h1>Vivero</h1>
      <p>Producción de plantines: siembra, germinación, merma, stock y venta. <span class="insignia tierra">M6</span></p>
    </div>
    <button v-if="puedeEscribir" class="btn" @click="nuevo"><Icono nombre="mas" /> Nuevo lote de plantines</button>
  </div>

  <div class="rejilla r-kpi" style="margin-bottom: 18px">
    <div class="tarjeta kpi"><div class="rotulo">Lotes de plantines</div><div class="valor">{{ lotes.length }}</div></div>
    <div class="tarjeta kpi"><div class="rotulo">Plantines disponibles</div><div class="valor">{{ numero(totales.disponibles) }}</div></div>
    <div class="tarjeta kpi"><div class="rotulo">Germinación promedio</div><div class="valor">{{ numero(germPromedio, 1) }} %</div></div>
    <div class="tarjeta kpi"><div class="rotulo">Plantines vendidos</div><div class="valor">{{ numero(totales.vendidos) }}</div></div>
  </div>

  <div class="tarjeta tabla-envoltura">
    <table>
      <thead><tr><th>Lote</th><th>Especie</th><th>Siembra</th><th>Etapa</th><th class="num">Sembradas</th><th class="num">Germinadas</th><th class="num">% germ.</th><th class="num">Merma</th><th class="num">Vendidos</th><th class="num">Disponibles</th><th class="num">Precio</th><th class="num">Costo unit.</th><th /></tr></thead>
      <tbody>
        <tr v-for="l in lotes" :key="l.id">
          <td><strong>{{ l.codigo }}</strong><br /><small>{{ l.bandejas }} bandeja(s)</small></td>
          <td>{{ l.especie }}<br /><small>{{ l.variedad }}</small></td>
          <td>{{ fecha(l.fechaSiembra) }}</td>
          <td><span class="insignia" :class="CLASE_ETAPA[l.etapa]">{{ ETAPAS[l.etapa] }}</span></td>
          <td class="num">{{ numero(l.semillasSembradas) }}</td>
          <td class="num">{{ numero(l.germinadas) }}</td>
          <td class="num">{{ l.germinadas ? `${numero(l.porcentajeGerminacion, 1)} %` : '—' }}</td>
          <td class="num">{{ numero(l.merma) }}</td>
          <td class="num">{{ numero(l.vendidos) }}</td>
          <td class="num"><strong>{{ numero(l.disponibles) }}</strong></td>
          <td class="num">{{ bs(l.precioBs) }}</td>
          <td class="num">{{ l.costoUnitario != null ? bs(l.costoUnitario) : '—' }}</td>
          <td style="white-space: nowrap; text-align: right">
            <button v-if="puedeEscribir" class="btn fantasma chico" @click="avance(l)">Registrar avance</button>
            <button v-if="puedeVender && l.disponibles > 0 && l.etapa === 'LISTO'" class="btn chico" @click="vender(l)">Vender</button>
          </td>
        </tr>
      </tbody>
    </table>
    <p class="apagado" style="font-size: 0.85rem; margin-bottom: 0">
      % germinación = germinadas ÷ semillas sembradas · Disponibles = germinadas − merma − vendidos · Costo unitario = costo de producción ÷ (germinadas − merma).
    </p>
  </div>

  <Modal v-if="modal === 'nuevo'" titulo="Nuevo lote de plantines" @cerrar="modal = null">
    <form @submit.prevent="guardarNuevo">
      <div class="fila-campos">
        <div class="campo"><label>Especie</label><input v-model="f.especie" required minlength="2" placeholder="Tomate" /></div>
        <div class="campo"><label>Variedad</label><input v-model="f.variedad" placeholder="Santa Cruz Kada" /></div>
      </div>
      <div class="fila-campos">
        <div class="campo"><label>Fecha de siembra</label><input v-model="f.fechaSiembra" type="date" required /></div>
        <div class="campo"><label>Bandejas</label><input v-model="f.bandejas" type="number" min="1" required /></div>
        <div class="campo"><label>Semillas sembradas</label><input v-model="f.semillasSembradas" type="number" min="1" required /></div>
      </div>
      <div class="fila-campos">
        <div class="campo"><label>Precio por plantín (Bs)</label><input v-model="f.precioBs" type="number" min="0" step="0.01" /></div>
        <div class="campo"><label>Costo de producción total (Bs)</label><input v-model="f.costoBs" type="number" min="0" step="0.01" /></div>
      </div>
      <div class="acciones"><button type="button" class="btn secundario" @click="modal = null">Cancelar</button><button class="btn">Guardar</button></div>
    </form>
  </Modal>

  <Modal v-if="modal === 'avance'" :titulo="`Avance · ${f.lote.codigo} ${f.lote.especie}`" @cerrar="modal = null">
    <form @submit.prevent="guardarAvance">
      <p class="apagado" style="margin-top: 0">Sembradas: {{ numero(f.lote.semillasSembradas) }} · Vendidos: {{ numero(f.lote.vendidos) }}</p>
      <div class="fila-campos">
        <div class="campo"><label>Germinadas</label><input v-model="f.germinadas" type="number" min="0" :max="f.lote.semillasSembradas" required /></div>
        <div class="campo"><label>Merma</label><input v-model="f.merma" type="number" min="0" required /></div>
      </div>
      <div class="fila-campos">
        <div class="campo"><label>Etapa</label><select v-model="f.etapa"><option v-for="(t, k) in ETAPAS" :key="k" :value="k">{{ t }}</option></select></div>
        <div class="campo"><label>Precio por plantín (Bs)</label><input v-model="f.precioBs" type="number" min="0" step="0.01" /></div>
      </div>
      <div class="acciones"><button type="button" class="btn secundario" @click="modal = null">Cancelar</button><button class="btn">Guardar</button></div>
    </form>
  </Modal>

  <Modal v-if="modal === 'venta'" :titulo="`Vender plantines · ${f.lote.codigo}`" @cerrar="modal = null">
    <form @submit.prevent="guardarVenta">
      <p class="nota-info">La venta se registra en <strong>M5 Ventas</strong> y descuenta el stock del vivero. Disponibles: {{ numero(f.lote.disponibles) }}.</p>
      <div class="campo"><label>Cliente</label><select v-model="f.clienteId" required><option v-for="c in clientes" :key="c.id" :value="c.id">{{ c.nombre }}</option></select></div>
      <div class="fila-campos">
        <div class="campo"><label>Cantidad de plantines</label><input v-model="f.cantidad" type="number" min="1" :max="f.lote.disponibles" required /></div>
        <div class="campo"><label>Precio unitario (Bs)</label><input v-model="f.precioBs" type="number" min="0" step="0.01" required /></div>
      </div>
      <label style="display: flex; gap: 10px; align-items: center; margin-bottom: 12px"><span class="interruptor"><input v-model="f.pagado" type="checkbox" /><span /></span> Cobrado al contado</label>
      <p><strong>Total: {{ bs(Number(f.cantidad || 0) * Number(f.precioBs || 0)) }}</strong></p>
      <div class="acciones"><button type="button" class="btn secundario" @click="modal = null">Cancelar</button><button class="btn">Registrar venta</button></div>
    </form>
  </Modal>
</template>
