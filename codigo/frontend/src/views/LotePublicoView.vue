<script setup>
// Página que ve el consumidor al escanear el QR. Pública, liviana y sin datos sensibles.
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '../api.js';
import Icono from '../components/Icono.vue';
import { ETIQUETAS_EVENTO, ETIQUETAS_LABOR, fecha, numero } from '../utils/formato.js';

const ruta = useRoute();
const lote = ref(null);
const error = ref('');

onMounted(async () => {
  try {
    lote.value = await api.get(`/publico/lotes/${encodeURIComponent(ruta.params.token)}`);
  } catch (e) {
    error.value = e.status === 404 ? 'No encontramos este lote. Verifica el código QR.' : 'No se pudo cargar la información. Intenta nuevamente.';
  }
});
const dias = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
</script>

<template>
  <div class="publico">
    <div v-if="error" class="tarjeta vacio" style="margin-top: 40px"><Icono nombre="qr" :tam="44" /><p>{{ error }}</p></div>
    <div v-else-if="!lote" class="vacio" style="padding-top: 80px">Cargando origen del producto…</div>
    <template v-else>
      <header class="publico-cabecera">
        <span class="sello"><Icono nombre="escudo" :tam="16" /> Producto trazable</span>
        <h1>{{ lote.producto }} <span style="font-weight: 400; opacity: 0.85; font-size: 1.1rem">{{ lote.variedad }}</span></h1>
        <div style="opacity: 0.9">Lote <strong>{{ lote.codigo }}</strong></div>
      </header>

      <section class="tarjeta">
        <div class="datos">
          <div><small>Finca</small><strong>{{ lote.finca.nombre }}</strong></div>
          <div><small>Origen</small><strong>{{ lote.finca.municipio }}, {{ lote.finca.departamento }}</strong></div>
          <div><small>Sembrado</small><strong>{{ fecha(lote.fechaSiembra) }}</strong></div>
          <div><small>Cosechado</small><strong>{{ fecha(lote.fechaCosecha) }}</strong></div>
          <div><small>Ciclo</small><strong>{{ dias(lote.fechaSiembra, lote.fechaCosecha) }} días</strong></div>
          <div><small>Calidad · peso</small><strong>{{ lote.calidad }} · {{ numero(lote.cantidadKg) }} kg</strong></div>
        </div>
      </section>

      <section class="tarjeta" style="margin-top: 16px">
        <h2>Recorrido del lote</h2>
        <ul class="linea-tiempo">
          <li v-for="(e, i) in lote.eventos" :key="i" :class="{ tierra: e.tipo === 'DESPACHO' }">
            <span class="hito" /><strong>{{ ETIQUETAS_EVENTO[e.tipo] }}</strong> <small>{{ fecha(e.fecha) }}</small>
            <div class="apagado" style="font-size: 0.88rem">{{ e.detalle }}</div>
          </li>
        </ul>
      </section>

      <section class="tarjeta" style="margin-top: 16px">
        <h2>Manejo en campo</h2>
        <p class="apagado" style="margin-top: 0; font-size: 0.88rem">Labores registradas en la parcela {{ lote.parcela }} durante este ciclo.</p>
        <div v-for="(l, i) in lote.labores" :key="i" style="display: flex; justify-content: space-between; gap: 10px; padding: 7px 0; border-bottom: 1px solid #f0ece2">
          <span>{{ ETIQUETAS_LABOR[l.tipo] }}<small v-if="l.producto"> · {{ l.producto }}{{ l.carenciaDias != null ? ` (carencia ${l.carenciaDias} d)` : '' }}</small></span>
          <small style="white-space: nowrap">{{ fecha(l.fecha) }}</small>
        </div>
        <div v-if="!lote.labores.length" class="apagado">Sin labores registradas.</div>
      </section>
      <p style="text-align: center; font-size: 0.8rem" class="apagado">Información registrada por la finca en CRM-Agro · Datos de demostración ficticios</p>
    </template>
  </div>
</template>
