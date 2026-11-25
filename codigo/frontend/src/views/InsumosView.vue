<script setup>
import { onMounted, reactive, ref } from 'vue';
import { api } from '../api.js';
import { useSesion } from '../stores/sesion.js';
import { useUi } from '../stores/ui.js';
import Icono from '../components/Icono.vue';
import Modal from '../components/Modal.vue';
import { bs, numero } from '../utils/formato.js';

const sesion = useSesion();
const ui = useUi();
const insumos = ref([]);
const modal = ref(null);
const f = reactive({});
const CATEGORIAS = { SEMILLA: 'Semilla', FERTILIZANTE: 'Fertilizante', AGROQUIMICO: 'Agroquímico', HERRAMIENTA: 'Herramienta', OTRO: 'Otro' };

async function cargar() {
  try {
    insumos.value = await api.get('/insumos');
  } catch (e) {
    ui.error(e);
  }
}
function nuevo() {
  Object.assign(f, { nombre: '', categoria: 'FERTILIZANTE', unidad: 'kg', stock: 0, stockMinimo: 0, costoUnitBs: 0 });
  modal.value = 'nuevo';
}
function movimiento(i, tipo) {
  Object.assign(f, { insumo: i, tipo, cantidad: '', motivo: '' });
  modal.value = 'mov';
}
async function guardarNuevo() {
  try {
    await api.post('/insumos', { nombre: f.nombre, categoria: f.categoria, unidad: f.unidad, stock: Number(f.stock), stockMinimo: Number(f.stockMinimo), costoUnitBs: Number(f.costoUnitBs) });
    modal.value = null;
    ui.avisar('Insumo creado');
    cargar();
  } catch (e) {
    ui.error(e);
  }
}
async function guardarMov() {
  try {
    await api.post(`/insumos/${f.insumo.id}/movimientos`, { tipo: f.tipo, cantidad: Number(f.cantidad), motivo: f.motivo || undefined });
    modal.value = null;
    ui.avisar(f.tipo === 'ENTRADA' ? 'Entrada registrada' : 'Salida registrada');
    cargar();
  } catch (e) {
    ui.error(e);
  }
}
const pct = (i) => Math.min(100, i.stockMinimo ? (i.stock / (i.stockMinimo * 2)) * 100 : 100);
onMounted(cargar);
</script>

<template>
  <div class="encabezado">
    <div>
      <h1>Inventario de insumos</h1>
      <p>Módulo opcional con alertas de stock mínimo. <span class="insignia tierra">M6</span></p>
    </div>
    <button v-if="sesion.puede('insumos:escribir')" class="btn" @click="nuevo"><Icono nombre="mas" /> Nuevo insumo</button>
  </div>

  <div class="tarjeta tabla-envoltura" style="margin: 0; padding: 20px">
    <table>
      <thead><tr><th>Insumo</th><th>Categoría</th><th style="min-width: 160px">Stock</th><th class="num">Costo unit.</th><th class="num">Valor</th><th /></tr></thead>
      <tbody>
        <tr v-for="i in insumos" :key="i.id">
          <td><strong>{{ i.nombre }}</strong></td>
          <td><span class="insignia gris">{{ CATEGORIAS[i.categoria] }}</span></td>
          <td>
            <div style="display: flex; justify-content: space-between; font-size: 0.85rem">
              <span>{{ numero(i.stock, 1) }} {{ i.unidad }}</span>
              <span v-if="i.bajoMinimo" class="insignia rojo">bajo mínimo ({{ i.stockMinimo }})</span>
            </div>
            <div style="height: 6px; background: #eeeae0; border-radius: 4px; margin-top: 4px">
              <div :style="{ width: `${pct(i)}%`, height: '100%', borderRadius: '4px', background: i.bajoMinimo ? 'var(--rojo)' : 'var(--hoja)' }" />
            </div>
          </td>
          <td class="num">{{ bs(i.costoUnitBs) }}</td>
          <td class="num">{{ bs(i.stock * i.costoUnitBs) }}</td>
          <td style="white-space: nowrap; text-align: right">
            <template v-if="sesion.puede('insumos:escribir')">
              <button class="btn fantasma chico" @click="movimiento(i, 'ENTRADA')">+ Entrada</button>
              <button class="btn fantasma chico" @click="movimiento(i, 'SALIDA')">− Salida</button>
            </template>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <Modal v-if="modal === 'nuevo'" titulo="Nuevo insumo" @cerrar="modal = null">
    <form @submit.prevent="guardarNuevo">
      <div class="campo"><label>Nombre</label><input v-model="f.nombre" required minlength="2" /></div>
      <div class="fila-campos">
        <div class="campo"><label>Categoría</label><select v-model="f.categoria"><option v-for="(t, k) in CATEGORIAS" :key="k" :value="k">{{ t }}</option></select></div>
        <div class="campo"><label>Unidad</label><input v-model="f.unidad" required maxlength="10" /></div>
      </div>
      <div class="fila-campos">
        <div class="campo"><label>Stock inicial</label><input v-model="f.stock" type="number" min="0" step="any" /></div>
        <div class="campo"><label>Stock mínimo</label><input v-model="f.stockMinimo" type="number" min="0" step="any" /></div>
        <div class="campo"><label>Costo unitario (Bs)</label><input v-model="f.costoUnitBs" type="number" min="0" step="any" /></div>
      </div>
      <div class="acciones"><button type="button" class="btn secundario" @click="modal = null">Cancelar</button><button class="btn">Guardar</button></div>
    </form>
  </Modal>

  <Modal v-if="modal === 'mov'" :titulo="`${f.tipo === 'ENTRADA' ? 'Entrada' : 'Salida'} · ${f.insumo.nombre}`" @cerrar="modal = null">
    <form @submit.prevent="guardarMov">
      <div class="campo"><label>Cantidad ({{ f.insumo.unidad }})</label><input v-model="f.cantidad" type="number" min="0.01" step="any" required /></div>
      <div class="campo"><label>Motivo</label><input v-model="f.motivo" maxlength="120" placeholder="Compra, uso en P-02…" /></div>
      <div class="acciones"><button type="button" class="btn secundario" @click="modal = null">Cancelar</button><button class="btn">Registrar</button></div>
    </form>
  </Modal>
</template>
