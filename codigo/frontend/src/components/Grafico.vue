<script setup>
// Envoltorio liviano de Chart.js con el estilo del CRM.
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);
Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
Chart.defaults.color = '#4B564F';
Chart.defaults.plugins.legend.labels.boxWidth = 12;

const props = defineProps({ tipo: { type: String, default: 'bar' }, datos: { type: Object, required: true }, opciones: { type: Object, default: () => ({}) }, alto: { type: Number, default: 260 } });
const lienzo = ref(null);
let grafico;

function dibujar() {
  grafico?.destroy();
  grafico = new Chart(lienzo.value, {
    type: props.tipo,
    data: props.datos,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: props.tipo === 'doughnut', position: 'bottom' } },
      scales: props.tipo === 'doughnut' ? {} : { x: { grid: { display: false } }, y: { grid: { color: '#EFEBE0' }, beginAtZero: true } },
      ...props.opciones,
    },
  });
}
onMounted(dibujar);
watch(() => props.datos, dibujar, { deep: true });
onBeforeUnmount(() => grafico?.destroy());
</script>

<template>
  <div :style="{ height: `${alto}px`, position: 'relative' }"><canvas ref="lienzo" /></div>
</template>
