<script setup>
// Página que ve el consumidor al escanear el QR. Pública, liviana y sin datos personales:
// lote de campo → labores (con aplicaciones y carencia) → cosecha → cadena → ventas (solo tipo de cliente).
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '../api.js';
import Icono from '../components/Icono.vue';
import { ETIQUETAS_EVENTO, ETIQUETAS_LABOR, COLORES_LABOR, fecha, numero } from '../utils/formato.js';

const ruta = useRoute();
const lote = ref(null);
const error = ref('');
const sql = ref(null);
const verSql = ref(false);

const token = () => encodeURIComponent(ruta.params.token);

onMounted(async () => {
  try {
    lote.value = await api.get(`/publico/lotes/${token()}`);
  } catch (e) {
    error.value = e.status === 404 ? 'No encontramos este lote. Verifica el código QR.' : 'No se pudo cargar la información. Intenta nuevamente.';
  }
});

async function alternarSql() {
  verSql.value = !verSql.value;
  if (verSql.value && !sql.value) {
    try {
      sql.value = await api.get(`/publico/lotes/${token()}/sql`);
    } catch {
      sql.value = { consultas: [] };
    }
  }
}
const dias = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
const RIEGO = { GOTEO: 'Goteo', ASPERSION: 'Aspersión', GRAVEDAD: 'Gravedad', SECANO: 'Secano' };
</script>

<template>
  <div class="publico">
    <div v-if="error" class="tarjeta vacio" style="margin-top: 40px"><Icono nombre="qr" :tam="44" /><p>{{ error }}</p></div>
    <div v-else-if="!lote" class="vacio" style="padding-top: 80px">Cargando origen del producto…</div>
    <template v-else>
      <header class="publico-cabecera">
        <span class="sello"><Icono nombre="escudo" :tam="16" /> Producto trazable</span>
        <h1>{{ lote.producto }} <span style="font-weight: 400; opacity: 0.85; font-size: 1.1rem">{{ lote.variedad }}</span></h1>
        <div style="opacity: 0.9">Lote de cosecha <strong>{{ lote.codigo }}</strong></div>
      </header>

      <section class="tarjeta">
        <div class="datos">
          <div><small>Finca</small><strong>{{ lote.finca.nombre }}</strong></div>
          <div><small>Origen</small><strong>{{ lote.finca.municipio }}, {{ lote.finca.departamento }}</strong></div>
          <div><small>Lote de campo</small><strong>{{ lote.lote.codigo }} · {{ lote.lote.nombre }}</strong></div>
          <div><small>Superficie · riego</small><strong>{{ numero(lote.lote.areaHa, 1) }} ha · {{ RIEGO[lote.lote.riego] || '—' }}</strong></div>
          <div><small>Sembrado</small><strong>{{ fecha(lote.fechaSiembra) }}</strong></div>
          <div><small>Cosechado</small><strong>{{ fecha(lote.fechaCosecha) }}</strong></div>
          <div><small>Ciclo</small><strong>{{ dias(lote.fechaSiembra, lote.fechaCosecha) }} días</strong></div>
          <div><small>Calidad · peso</small><strong>{{ lote.calidad }} · {{ numero(lote.cantidadKg) }} kg</strong></div>
        </div>
        <p v-if="lote.resumen.aplicaciones" :class="lote.resumen.carenciaRespetada ? 'nota-info' : 'nota-peligro'" style="margin: 14px 0 0">
          <template v-if="lote.resumen.carenciaRespetada">✔ Se registraron {{ lote.resumen.aplicaciones }} aplicación(es) fitosanitaria(s) y la cosecha se hizo después de terminar su período de carencia.</template>
          <template v-else>⚠ Hay aplicaciones cuya carencia no había terminado al cosechar (cosecha autorizada por el propietario con justificación).</template>
        </p>
      </section>

      <section class="tarjeta" style="margin-top: 16px">
        <h2>1 · Manejo en campo</h2>
        <p class="apagado" style="margin-top: 0; font-size: 0.88rem">Labores registradas en el lote {{ lote.lote.codigo }} durante esta campaña.</p>
        <ul class="linea-tiempo">
          <li v-for="(l, i) in lote.labores" :key="i">
            <span class="hito" :style="{ background: COLORES_LABOR[l.tipo] }" />
            <strong>{{ ETIQUETAS_LABOR[l.tipo] }}</strong> <small>{{ fecha(l.fecha) }}</small>
            <div v-if="l.descripcion" class="apagado" style="font-size: 0.88rem">{{ l.descripcion }}</div>
            <div v-if="l.producto" style="font-size: 0.88rem; margin-top: 2px">
              Producto aplicado: <strong>{{ l.producto }}</strong><span v-if="l.motivo"> · contra {{ l.motivo }}</span>
              <span v-if="l.carenciaDias" class="insignia" :class="l.carenciaRespetada === false ? 'rojo' : 'gris'" style="margin-left: 4px">
                Carencia {{ l.carenciaDias }} d · hasta {{ fecha(l.fechaFinCarencia) }}
              </span>
            </div>
          </li>
        </ul>
        <div v-if="!lote.labores.length" class="apagado">Sin labores registradas.</div>
      </section>

      <section class="tarjeta" style="margin-top: 16px">
        <h2>2 · Cosecha y recorrido</h2>
        <ul class="linea-tiempo">
          <li v-for="(e, i) in lote.eventos" :key="i" :class="{ tierra: e.tipo === 'DESPACHO' }">
            <span class="hito" /><strong>{{ ETIQUETAS_EVENTO[e.tipo] }}</strong> <small>{{ fecha(e.fecha) }}</small>
            <div class="apagado" style="font-size: 0.88rem">{{ e.detalle }}</div>
          </li>
        </ul>
      </section>

      <section class="tarjeta" style="margin-top: 16px">
        <h2>3 · Venta</h2>
        <div v-if="!lote.ventas.length" class="apagado">Este lote aún no registra ventas.</div>
        <div v-for="(v, i) in lote.ventas" :key="i" style="display: flex; justify-content: space-between; gap: 10px; padding: 7px 0; border-bottom: 1px solid #f0ece2">
          <span><Icono nombre="dinero" :tam="15" /> {{ v.destino }} · {{ numero(v.cantidad, 1) }} {{ v.unidad }}</span>
          <small>{{ fecha(v.fecha) }}</small>
        </div>
        <p class="apagado" style="font-size: 0.8rem; margin-bottom: 0">Por privacidad no se muestran datos de los compradores.</p>
      </section>

      <section class="tarjeta" style="margin-top: 16px">
        <button class="btn fantasma" @click="alternarSql"><Icono nombre="tablero" :tam="16" /> {{ verSql ? 'Ocultar' : 'Ver' }} consulta SQL de trazabilidad</button>
        <div v-if="verSql && sql">
          <div v-for="c in sql.consultas" :key="c.nombre" style="margin-top: 12px">
            <p style="margin: 0 0 6px"><strong>{{ c.nombre }}</strong> · <small>{{ c.descripcion }} ({{ c.filas.length }} fila/s)</small></p>
            <pre class="codigo">{{ c.sql }}</pre>
          </div>
        </div>
      </section>
      <p style="text-align: center; font-size: 0.8rem" class="apagado">Información registrada por la finca en CRM-Agro · Datos de demostración ficticios</p>
    </template>
  </div>
</template>
