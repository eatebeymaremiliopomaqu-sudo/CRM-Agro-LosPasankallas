<script setup>
// M7 · Reportes y finanzas: costo por lote (labores + jornales + insumos), ingresos y margen.
import { computed, onMounted, reactive, ref } from 'vue';
import { api } from '../api.js';
import { useUi } from '../stores/ui.js';
import Icono from '../components/Icono.vue';
import Grafico from '../components/Grafico.vue';
import { bs, haceDiasISO, hoyISO, numero } from '../utils/formato.js';
import { descargarCSV } from '../utils/csv.js';

const ui = useUi();
const rep = ref(null);
const campanias = ref([]);
const cargando = ref(false);
const verTabla = ref(false);
const filtro = reactive({ desde: haceDiasISO(90), hasta: hoyISO(), campaniaId: '' });

// Paleta validada (CVD y contraste) con el validador de la guía de visualización
const COLOR = { ingresos: '#1F78B4', costos: '#C8823A', jornales: '#1F78B4', insumos: '#C8823A', labores: '#8E5FC2' };

async function cargar() {
  cargando.value = true;
  const q = new URLSearchParams({ ...(filtro.desde && { desde: filtro.desde }), ...(filtro.hasta && { hasta: filtro.hasta }), ...(filtro.campaniaId && { campaniaId: filtro.campaniaId }) });
  try {
    rep.value = await api.get(`/reportes/costos?${q}`);
  } catch (e) {
    ui.error(e);
  } finally {
    cargando.value = false;
  }
}

const t = computed(() => rep.value?.totales || {});
const kpis = computed(() => [
  { rotulo: 'Ingresos', valor: bs(t.value.ingresos), sub: t.value.ingresosSinLote ? `${bs(t.value.ingresosSinLote)} sin lote asignado` : 'ventas del periodo' },
  { rotulo: 'Costos', valor: bs(t.value.costoTotal), sub: 'labores + jornales + insumos' },
  { rotulo: 'Margen', valor: bs(t.value.margen), sub: 'ingresos − costos', negativo: t.value.margen < 0 },
  { rotulo: 'Margen %', valor: t.value.margenPct == null ? '—' : `${numero(t.value.margenPct, 1)} %`, sub: 'margen ÷ ingresos', negativo: t.value.margenPct < 0 },
]);

const opcionesBs = { plugins: { legend: { display: true, position: 'bottom' }, tooltip: { callbacks: { label: (c) => `${c.dataset.label}: Bs ${numero(c.parsed.y, 2)}` } } } };
const graficoLotes = computed(() => {
  const l = rep.value?.lotes || [];
  return {
    labels: l.map((x) => `${x.codigo} ${x.cultivo || ''}`.trim()),
    datasets: [
      { label: 'Ingresos', data: l.map((x) => x.ingresos), backgroundColor: COLOR.ingresos, borderRadius: 4, borderSkipped: 'bottom', maxBarThickness: 28 },
      { label: 'Costos', data: l.map((x) => x.costoTotal), backgroundColor: COLOR.costos, borderRadius: 4, borderSkipped: 'bottom', maxBarThickness: 28 },
    ],
  };
});
const graficoComposicion = computed(() => {
  const l = rep.value?.lotes || [];
  const serie = (label, k, color) => ({ label, data: l.map((x) => x[k]), backgroundColor: color, borderColor: '#fffdf8', borderWidth: { top: 2 }, maxBarThickness: 28 });
  return { labels: l.map((x) => x.codigo), datasets: [serie('Jornales', 'costoJornales', COLOR.jornales), serie('Insumos', 'costoInsumos', COLOR.insumos), serie('Labores', 'costoLabores', COLOR.labores)] };
});
const opcionesApilado = { ...opcionesBs, scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, beginAtZero: true, grid: { color: '#EFEBE0' } } } };

const COLUMNAS = [
  ['codigo', 'Lote'], ['cultivo', 'Cultivo'], ['kgCosechados', 'Kg cosechados'], ['costoLabores', 'Costo labores (Bs)'], ['costoJornales', 'Costo jornales (Bs)'],
  ['costoInsumos', 'Costo insumos (Bs)'], ['costoTotal', 'Costo total (Bs)'], ['ingresos', 'Ingresos (Bs)'], ['margen', 'Margen (Bs)'], ['margenPct', 'Margen %'], ['costoPorKg', 'Costo por kg (Bs)'],
];
function exportar() {
  const totales = { codigo: 'TOTAL', ...t.value, ingresos: t.value.ingresos, cultivo: '' };
  descargarCSV(`costos_por_lote_${filtro.desde}_${filtro.hasta}.csv`, [...rep.value.lotes, totales], COLUMNAS);
}

onMounted(async () => {
  campanias.value = await api.get('/reportes/campanias').catch(() => []);
  cargar();
});
</script>

<template>
  <div class="encabezado">
    <div>
      <h1>Reportes y finanzas</h1>
      <p>Costos por lote, ingresos y margen. <span class="insignia tierra">M7</span></p>
    </div>
    <button class="btn secundario" :disabled="!rep" @click="exportar"><Icono nombre="descargar" /> Exportar CSV</button>
  </div>

  <div class="filtros tarjeta" style="margin-bottom: 18px">
    <label>Desde <input v-model="filtro.desde" type="date" class="entrada" /></label>
    <label>Hasta <input v-model="filtro.hasta" type="date" class="entrada" /></label>
    <label>Campaña
      <select v-model="filtro.campaniaId" class="entrada">
        <option value="">Todas</option>
        <option v-for="c in campanias" :key="c.id" :value="c.id">{{ c.lote.codigo }} · {{ c.cultivo }} {{ c.variedad || '' }}</option>
      </select>
    </label>
    <button class="btn" :disabled="cargando" @click="cargar">{{ cargando ? 'Calculando…' : 'Aplicar' }}</button>
  </div>

  <template v-if="rep">
    <div class="rejilla r-kpi">
      <div v-for="k in kpis" :key="k.rotulo" class="tarjeta kpi">
        <div class="rotulo">{{ k.rotulo }}</div>
        <div class="valor" :style="k.negativo ? { color: 'var(--rojo)' } : {}">{{ k.valor }}</div>
        <small>{{ k.sub }}</small>
      </div>
    </div>

    <div class="rejilla r-2" style="margin-top: 18px">
      <div class="tarjeta">
        <h3>Ingresos y costos por lote</h3>
        <Grafico tipo="bar" :datos="graficoLotes" :opciones="opcionesBs" :alto="280" />
      </div>
      <div class="tarjeta">
        <h3>Composición del costo por lote</h3>
        <Grafico tipo="bar" :datos="graficoComposicion" :opciones="opcionesApilado" :alto="280" />
      </div>
    </div>

    <div class="tarjeta" style="margin-top: 18px">
      <div class="tarjeta-titulo">
        <h3>Detalle por lote de campo</h3>
        <button class="btn fantasma chico" @click="verTabla = !verTabla">{{ verTabla ? 'Ocultar fórmulas' : 'Ver fórmulas' }}</button>
      </div>
      <div v-if="verTabla" class="nota-info">
        <strong>Costo labores</strong> = Σ costo directo registrado en cada labor (combustible, alquiler, servicios).<br />
        <strong>Costo jornales</strong> = Σ (horas de asistencia en el lote ÷ 8) × jornal del trabajador.<br />
        <strong>Costo insumos</strong> = Σ cantidad usada en las aplicaciones × costo unitario del insumo.<br />
        <strong>Ingresos</strong> = Σ subtotales de venta de los lotes de cosecha del lote (trazabilidad cosecha → venta).<br />
        <strong>Margen</strong> = ingresos − costo total · <strong>Margen %</strong> = margen ÷ ingresos × 100 · <strong>Costo por kg</strong> = costo total ÷ kg cosechados.
      </div>
      <div class="tabla-envoltura">
        <table>
          <thead><tr><th>Lote</th><th class="num">Kg</th><th class="num">Labores</th><th class="num">Jornales</th><th class="num">Insumos</th><th class="num">Costo total</th><th class="num">Ingresos</th><th class="num">Margen</th><th class="num">Margen %</th><th class="num">Costo/kg</th></tr></thead>
          <tbody>
            <tr v-for="l in rep.lotes" :key="l.loteId">
              <td><strong>{{ l.codigo }}</strong> <small>{{ l.cultivo }}</small></td>
              <td class="num">{{ numero(l.kgCosechados) }}</td>
              <td class="num">{{ bs(l.costoLabores) }}</td>
              <td class="num">{{ bs(l.costoJornales) }}</td>
              <td class="num">{{ bs(l.costoInsumos) }}</td>
              <td class="num"><strong>{{ bs(l.costoTotal) }}</strong></td>
              <td class="num">{{ bs(l.ingresos) }}</td>
              <td class="num" :style="{ color: l.margen < 0 ? 'var(--rojo)' : 'inherit' }"><strong>{{ bs(l.margen) }}</strong></td>
              <td class="num">{{ l.margenPct == null ? 'sin ventas' : `${numero(l.margenPct, 1)} %` }}</td>
              <td class="num">{{ l.costoPorKg == null ? '—' : bs(l.costoPorKg) }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <th>Total</th><th class="num">{{ numero(t.kgCosechados) }}</th><th class="num">{{ bs(t.costoLabores) }}</th><th class="num">{{ bs(t.costoJornales) }}</th><th class="num">{{ bs(t.costoInsumos) }}</th>
              <th class="num">{{ bs(t.costoTotal) }}</th><th class="num">{{ bs(t.ingresos) }}</th><th class="num">{{ bs(t.margen) }}</th><th class="num">{{ t.margenPct == null ? '—' : `${numero(t.margenPct, 1)} %` }}</th><th />
            </tr>
          </tfoot>
        </table>
      </div>
      <p v-if="rep.vivero" class="apagado" style="font-size: 0.85rem; margin-bottom: 0">
        Vivero (M6), aparte de los lotes de campo: costo de producción {{ bs(rep.vivero.costo) }} · ingresos por plantines {{ bs(rep.vivero.ingresos) }} · margen {{ bs(rep.vivero.margen) }}.
        Los lotes sin cosecha todavía muestran margen negativo porque están en crecimiento.
      </p>
    </div>
  </template>
  <div v-else class="vacio">Calculando reporte…</div>
</template>
