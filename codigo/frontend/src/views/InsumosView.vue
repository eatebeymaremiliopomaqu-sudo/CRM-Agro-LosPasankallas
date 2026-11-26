<script setup>
// M4 · Inventarios: insumos (semillas, fertilizantes, agroquímicos, herramientas) y productos cosechados.
// La cosecha genera ENTRADAS de producto y la venta genera SALIDAS automáticamente.
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { api } from '../api.js';
import { useSesion } from '../stores/sesion.js';
import { useUi } from '../stores/ui.js';
import Icono from '../components/Icono.vue';
import Modal from '../components/Modal.vue';
import { bs, fecha, numero } from '../utils/formato.js';

const sesion = useSesion();
const ui = useUi();
const pestana = ref('insumos');
const insumos = ref([]);
const productos = ref([]);
const movimientos = ref([]);
const modal = ref(null);
const f = reactive({});
const CATEGORIAS = { SEMILLA: 'Semilla', FERTILIZANTE: 'Fertilizante', AGROQUIMICO: 'Agroquímico', HERRAMIENTA: 'Herramienta', OTRO: 'Otro' };
const MOTIVOS_PRODUCTO = { COSECHA: 'Cosecha', VENTA: 'Venta', MERMA: 'Merma', AJUSTE: 'Ajuste' };
const puedeEscribir = computed(() => sesion.puede('insumos:escribir'));
const bajos = computed(() => [...insumos.value, ...productos.value].filter((x) => x.bajoMinimo).length);

async function cargar() {
  try {
    insumos.value = await api.get('/insumos');
    productos.value = await api.get('/productos').catch(() => []);
  } catch (e) {
    ui.error(e);
  }
}
async function cargarMovimientos() {
  try {
    movimientos.value = await api.get('/productos/movimientos');
  } catch (e) {
    ui.error(e);
  }
}
function nuevo() {
  Object.assign(f, pestana.value === 'insumos'
    ? { nombre: '', categoria: 'FERTILIZANTE', unidad: 'kg', stock: 0, stockMinimo: 0, costoUnitBs: 0 }
    : { nombre: '', cultivo: '', unidad: 'kg', stockMinimo: 0, precioVentaBs: 0 });
  modal.value = pestana.value === 'insumos' ? 'nuevo' : 'nuevoProducto';
}
function movimiento(item, tipo, esProducto = false) {
  Object.assign(f, { item, tipo, cantidad: '', motivo: esProducto ? (tipo === 'ENTRADA' ? 'AJUSTE' : 'MERMA') : '', esProducto });
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
async function guardarProducto() {
  try {
    await api.post('/productos', { nombre: f.nombre, cultivo: f.cultivo.toUpperCase(), unidad: f.unidad, stockMinimo: Number(f.stockMinimo), precioVentaBs: Number(f.precioVentaBs) });
    modal.value = null;
    ui.avisar('Producto creado');
    cargar();
  } catch (e) {
    ui.error(e);
  }
}
async function guardarMov() {
  try {
    if (f.esProducto) await api.post('/productos/movimientos', { productoId: f.item.id, tipo: f.tipo, cantidad: Number(f.cantidad), motivo: f.motivo || undefined });
    else await api.post(`/insumos/${f.item.id}/movimientos`, { tipo: f.tipo, cantidad: Number(f.cantidad), motivo: f.motivo || undefined });
    modal.value = null;
    ui.avisar(f.tipo === 'ENTRADA' ? 'Entrada registrada' : 'Salida registrada');
    cargar();
    if (pestana.value === 'movimientos') cargarMovimientos();
  } catch (e) {
    ui.error(e);
  }
}
const pct = (i) => Math.min(100, i.stockMinimo ? (i.stock / (i.stockMinimo * 2)) * 100 : 100);
watch(pestana, (p) => p === 'movimientos' && cargarMovimientos());
onMounted(cargar);
</script>

<template>
  <div class="encabezado">
    <div>
      <h1>Inventarios</h1>
      <p>Insumos y productos cosechados con alerta de stock mínimo. <span class="insignia tierra">M4</span> <span v-if="bajos" class="insignia rojo">{{ bajos }} bajo el mínimo</span></p>
    </div>
    <button v-if="puedeEscribir && pestana !== 'movimientos'" class="btn" @click="nuevo"><Icono nombre="mas" /> {{ pestana === 'insumos' ? 'Nuevo insumo' : 'Nuevo producto' }}</button>
  </div>

  <div class="tarjeta">
    <div class="pestanas">
      <button :class="{ activa: pestana === 'insumos' }" @click="pestana = 'insumos'">Insumos ({{ insumos.length }})</button>
      <button :class="{ activa: pestana === 'productos' }" @click="pestana = 'productos'">Productos cosechados ({{ productos.length }})</button>
      <button :class="{ activa: pestana === 'movimientos' }" @click="pestana = 'movimientos'">Movimientos de productos</button>
    </div>

    <div v-if="pestana === 'insumos'" class="tabla-envoltura">
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
              <template v-if="puedeEscribir">
                <button class="btn fantasma chico" @click="movimiento(i, 'ENTRADA')">+ Entrada</button>
                <button class="btn fantasma chico" @click="movimiento(i, 'SALIDA')">− Salida</button>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else-if="pestana === 'productos'" class="tabla-envoltura">
      <p class="apagado" style="margin-top: 0">Las cosechas (M2) suman stock automáticamente y las ventas (M5) lo descuentan, con el lote de cosecha para la trazabilidad.</p>
      <table>
        <thead><tr><th>Producto</th><th>Cultivo</th><th style="min-width: 160px">Stock</th><th class="num">Precio de venta</th><th class="num">Valor</th><th /></tr></thead>
        <tbody>
          <tr v-for="p in productos" :key="p.id">
            <td><strong>{{ p.nombre }}</strong></td>
            <td><span class="insignia gris">{{ p.cultivo }}</span></td>
            <td>
              <div style="display: flex; justify-content: space-between; font-size: 0.85rem">
                <span>{{ numero(p.stock, 1) }} {{ p.unidad }}</span>
                <span v-if="p.bajoMinimo" class="insignia rojo">bajo mínimo ({{ p.stockMinimo }})</span>
              </div>
              <div style="height: 6px; background: #eeeae0; border-radius: 4px; margin-top: 4px">
                <div :style="{ width: `${pct(p)}%`, height: '100%', borderRadius: '4px', background: p.bajoMinimo ? 'var(--rojo)' : 'var(--hoja)' }" />
              </div>
            </td>
            <td class="num">{{ bs(p.precioVentaBs) }}/{{ p.unidad }}</td>
            <td class="num">{{ bs(p.stock * p.precioVentaBs) }}</td>
            <td style="white-space: nowrap; text-align: right">
              <template v-if="puedeEscribir">
                <button class="btn fantasma chico" @click="movimiento(p, 'ENTRADA', true)">+ Ajuste</button>
                <button class="btn fantasma chico" @click="movimiento(p, 'SALIDA', true)">− Merma</button>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else class="tabla-envoltura">
      <table>
        <thead><tr><th>Fecha</th><th>Producto</th><th>Tipo</th><th class="num">Cantidad</th><th>Motivo</th><th>Referencia</th></tr></thead>
        <tbody>
          <tr v-for="m in movimientos" :key="m.id">
            <td>{{ fecha(m.fecha) }}</td>
            <td>{{ m.producto.nombre }}</td>
            <td><span class="insignia" :class="m.tipo === 'ENTRADA' ? '' : 'ambar'">{{ m.tipo }}</span></td>
            <td class="num">{{ numero(m.cantidad, 1) }} {{ m.producto.unidad }}</td>
            <td>{{ MOTIVOS_PRODUCTO[m.motivo] || m.motivo }}</td>
            <td><small>{{ m.referencia }}</small></td>
          </tr>
        </tbody>
      </table>
    </div>
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

  <Modal v-if="modal === 'nuevoProducto'" titulo="Nuevo producto cosechado" @cerrar="modal = null">
    <form @submit.prevent="guardarProducto">
      <div class="fila-campos">
        <div class="campo"><label>Nombre comercial</label><input v-model="f.nombre" required minlength="2" placeholder="Tomate Santa Cruz" /></div>
        <div class="campo"><label>Cultivo</label><input v-model="f.cultivo" required minlength="2" placeholder="TOMATE" /></div>
      </div>
      <div class="fila-campos">
        <div class="campo"><label>Unidad</label><input v-model="f.unidad" required maxlength="10" /></div>
        <div class="campo"><label>Stock mínimo</label><input v-model="f.stockMinimo" type="number" min="0" step="any" /></div>
        <div class="campo"><label>Precio de venta (Bs)</label><input v-model="f.precioVentaBs" type="number" min="0" step="any" /></div>
      </div>
      <div class="acciones"><button type="button" class="btn secundario" @click="modal = null">Cancelar</button><button class="btn">Guardar</button></div>
    </form>
  </Modal>

  <Modal v-if="modal === 'mov'" :titulo="`${f.tipo === 'ENTRADA' ? 'Entrada' : 'Salida'} · ${f.item.nombre}`" @cerrar="modal = null">
    <form @submit.prevent="guardarMov">
      <div class="campo"><label>Cantidad ({{ f.item.unidad }})</label><input v-model="f.cantidad" type="number" min="0.01" step="any" required /></div>
      <div v-if="f.esProducto" class="campo"><label>Motivo</label><select v-model="f.motivo"><option v-for="(t, k) in MOTIVOS_PRODUCTO" :key="k" :value="k">{{ t }}</option></select></div>
      <div v-else class="campo"><label>Motivo</label><input v-model="f.motivo" maxlength="120" placeholder="Compra, uso en L-02…" /></div>
      <div class="acciones"><button type="button" class="btn secundario" @click="modal = null">Cancelar</button><button class="btn">Registrar</button></div>
    </form>
  </Modal>
</template>
