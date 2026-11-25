<script setup>
// Mapa de parcelas con Leaflet + OpenStreetMap (gratuito, sin API key).
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import L from 'leaflet';

const props = defineProps({ parcelas: { type: Array, default: () => [] }, centro: { type: Array, default: () => [-17.9135, -64.5312] }, alto: { type: Number, default: 380 } });
const emit = defineEmits(['seleccionar']);
const contenedor = ref(null);
let mapa;
let capa;

const colorPorCultivo = (c = '') => {
  const paleta = ['#3E7B4F', '#C8823A', '#2E6F95', '#B5523B', '#7D6B9E', '#D4A017'];
  let h = 0;
  for (const ch of c) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return paleta[h % paleta.length];
};

// Escapa texto antes de insertarlo como HTML en el mapa (evita XSS)
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function pintar() {
  if (!mapa) return;
  capa.clearLayers();
  const puntos = [];
  for (const p of props.parcelas) {
    if (p.lat == null || p.lng == null) continue;
    const color = colorPorCultivo(p.siembraActual?.cultivo);
    // Radio aproximado según el área (círculo equivalente en metros)
    const radio = Math.sqrt((p.areaHa * 10000) / Math.PI);
    L.circle([p.lat, p.lng], { radius: radio, color, weight: 2, fillColor: color, fillOpacity: 0.25 })
      .addTo(capa)
      .bindPopup(`<strong>${esc(p.codigo)} · ${esc(p.nombre)}</strong><br>${p.siembraActual ? `${esc(p.siembraActual.cultivo)} (${esc(p.siembraActual.variedad || 's/v')})` : 'Sin siembra activa'}<br>${esc(p.areaHa)} ha · ${esc(p.riego || 'sin riego')}`)
      .on('click', () => emit('seleccionar', p));
    L.marker([p.lat, p.lng], {
      icon: L.divIcon({ className: '', html: `<div style="background:${color};color:#fff;font:700 11px Inter,sans-serif;padding:2px 6px;border-radius:6px;box-shadow:0 1px 4px rgba(0,0,0,.3);white-space:nowrap">${esc(p.codigo)}</div>`, iconAnchor: [18, 10] }),
    }).addTo(capa);
    puntos.push([p.lat, p.lng]);
  }
  if (puntos.length) mapa.fitBounds(puntos, { padding: [50, 50], maxZoom: 17 });
}

onMounted(() => {
  mapa = L.map(contenedor.value, { scrollWheelZoom: false }).setView(props.centro, 16);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(mapa);
  capa = L.layerGroup().addTo(mapa);
  pintar();
});
watch(() => props.parcelas, pintar, { deep: true });
onBeforeUnmount(() => mapa?.remove());
</script>

<template>
  <div ref="contenedor" class="mapa" :style="{ height: `${alto}px` }" />
</template>
