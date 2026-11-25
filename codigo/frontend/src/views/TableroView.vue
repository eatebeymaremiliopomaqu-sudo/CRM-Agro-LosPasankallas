<script setup>
import { computed, onMounted, ref } from 'vue';
import { api } from '../api.js';
import { useSesion } from '../stores/sesion.js';
import { useUi } from '../stores/ui.js';
import Icono from '../components/Icono.vue';
import Grafico from '../components/Grafico.vue';
import { COLORES_LABOR, ETIQUETAS_LABOR, ETIQUETAS_OBS, claseSeveridad, fecha, numero } from '../utils/formato.js';

const sesion = useSesion();
const ui = useUi();
const d = ref(null);

const saludo = computed(() => {
  const h = new Date().getHours();
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
});

const kpis = computed(() => {
  const i = d.value?.indicadores || {};
  return [
    { rotulo: 'Parcelas activas', valor: numero(i.parcelas), sub: `${numero(i.hectareas, 1)} ha`, icono: 'parcela', modulo: 'M1' },
    { rotulo: 'Labores (30 días)', valor: numero(i.laboresMes), icono: 'campo', modulo: 'M2' },
    { rotulo: 'Lotes trazables', valor: numero(i.lotes), sub: `${numero(i.kgCosechados)} kg`, icono: 'qr', modulo: 'M3' },
    { rotulo: 'Trabajadores', valor: numero(i.trabajadores), icono: 'personas', modulo: 'M4' },
  ].filter((k) => sesion.tieneModulo(k.modulo));
});

const graficoLabores = computed(() => {
  const s = d.value?.series.laboresPorTipo || [];
  return { labels: s.map((x) => ETIQUETAS_LABOR[x.tipo] || x.tipo), datasets: [{ data: s.map((x) => x.cantidad), backgroundColor: s.map((x) => COLORES_LABOR[x.tipo] || '#999'), borderWidth: 0 }] };
});
const graficoHoras = computed(() => {
  const s = d.value?.series.horasPorDia || [];
  return {
    labels: s.map((x) => fecha(x.fecha, { day: '2-digit', month: 'short' })),
    datasets: [{ label: 'Horas', data: s.map((x) => x.horas), borderColor: '#3E7B4F', backgroundColor: 'rgba(139,195,74,.18)', fill: true, tension: 0.35, pointRadius: 0 }],
  };
});
const graficoCosecha = computed(() => {
  const s = d.value?.series.kgPorCultivo || [];
  return { labels: s.map((x) => x.cultivo), datasets: [{ label: 'kg', data: s.map((x) => x.kg), backgroundColor: '#C8823A', borderRadius: 8, maxBarThickness: 46 }] };
});

onMounted(async () => {
  try {
    d.value = await api.get('/dashboard');
  } catch (e) {
    ui.error(e);
  }
});
</script>

<template>
  <div class="encabezado">
    <div>
      <h1>{{ saludo }}, {{ sesion.usuario?.nombre?.split(' ')[0] }} 👋</h1>
      <p>Así está {{ sesion.finca?.nombre }} hoy, {{ new Date().toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long' }) }}.</p>
    </div>
    <RouterLink v-if="sesion.tieneModulo('M2') && sesion.puede('labores:escribir')" to="/campo?nuevo=1" class="btn"><Icono nombre="mas" /> Registrar labor</RouterLink>
  </div>

  <div v-if="!d" class="rejilla r-kpi"><div v-for="i in 4" :key="i" class="tarjeta"><div class="esqueleto" style="height: 56px" /></div></div>

  <template v-else>
    <div class="rejilla r-kpi">
      <div v-for="k in kpis" :key="k.rotulo" class="tarjeta kpi">
        <div class="rotulo">{{ k.rotulo }}</div>
        <div class="valor">{{ k.valor }}</div>
        <small v-if="k.sub">{{ k.sub }}</small>
        <span class="icono-fondo"><Icono :nombre="k.icono" :tam="86" /></span>
      </div>
    </div>

    <div class="rejilla r-2-1" style="margin-top: 18px">
      <div class="tarjeta">
        <div class="tarjeta-titulo"><h3>Horas trabajadas por día</h3><span class="insignia gris">últimos 30 días</span></div>
        <Grafico v-if="graficoHoras.labels.length" tipo="line" :datos="graficoHoras" />
        <div v-else class="vacio">Aún no hay asistencias registradas.</div>
      </div>
      <div class="tarjeta">
        <div class="tarjeta-titulo"><h3>Alertas de campo</h3><span class="insignia rojo">severidad ≥ 4</span></div>
        <div v-if="!d.alertas.length" class="vacio"><Icono nombre="escudo" :tam="36" /><div>Sin alertas en la última semana</div></div>
        <div v-for="a in d.alertas" :key="a.id" style="display: flex; gap: 10px; padding: 10px 0; border-bottom: 1px solid #f0ece2">
          <span style="color: var(--rojo)"><Icono nombre="alerta" /></span>
          <div>
            <strong>{{ a.parcela }} · {{ ETIQUETAS_OBS[a.tipo] }}</strong>
            <span class="insignia" :class="claseSeveridad(a.severidad)" style="margin-left: 6px">{{ a.severidad }}/5</span>
            <div class="apagado" style="font-size: 0.88rem">{{ a.nota }} · {{ fecha(a.fecha) }}</div>
          </div>
        </div>
        <template v-if="d.insumosBajos?.length && sesion.tieneModulo('M6')">
          <h3 style="margin-top: 16px">Insumos bajo mínimo</h3>
          <div v-for="i in d.insumosBajos" :key="i.nombre" style="display: flex; justify-content: space-between; padding: 6px 0">
            <span>{{ i.nombre }}</span><span class="insignia ambar">{{ i.stock }} {{ i.unidad }}</span>
          </div>
        </template>
      </div>
    </div>

    <div class="rejilla r-2" style="margin-top: 18px">
      <div class="tarjeta">
        <div class="tarjeta-titulo"><h3>Labores por tipo</h3><span class="insignia gris">30 días</span></div>
        <Grafico v-if="graficoLabores.labels.length" tipo="doughnut" :datos="graficoLabores" :opciones="{ cutout: '62%' }" />
        <div v-else class="vacio">Sin labores registradas.</div>
      </div>
      <div class="tarjeta">
        <div class="tarjeta-titulo"><h3>Kilos cosechados por cultivo</h3><span class="insignia gris">lotes trazables</span></div>
        <Grafico v-if="graficoCosecha.labels.length" :datos="graficoCosecha" />
        <div v-else class="vacio">Sin cosechas registradas.</div>
      </div>
    </div>
  </template>
</template>
