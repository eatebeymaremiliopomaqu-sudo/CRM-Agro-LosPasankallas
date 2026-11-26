<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { api } from '../api.js';
import { useSesion } from '../stores/sesion.js';
import { useUi } from '../stores/ui.js';
import Icono from '../components/Icono.vue';
import Modal from '../components/Modal.vue';
import { bs, fecha, fechaHora, hoyISO, iniciales, numero } from '../utils/formato.js';

const sesion = useSesion();
const ui = useUi();
const pestana = ref('ventas');
const modal = ref(null);
const f = reactive({});

// Datos
const ventas = ref([]);
const clientes = ref([]);
const pedidos = ref([]);
const productos = ref([]);
const cuentasPorCobrar = ref(null);
const lotesCosecha = ref([]);
const ventaDetalle = ref(null);

// Filtros
const filtroEstadoVenta = ref('');
const filtroEstadoPedido = ref('');
const busquedaCliente = ref('');

const TIPOS_CLIENTE = { MINORISTA: 'Minorista', MAYORISTA: 'Mayorista', RESTAURANTE: 'Restaurante', MERCADO: 'Mercado' };
const ESTADOS_VENTA = { PENDIENTE: 'Pendiente', PAGADO: 'Pagado', VENCIDO: 'Vencido' };
const ESTADOS_PEDIDO = { PENDIENTE: 'Pendiente', CONFIRMADO: 'Confirmado', ENTREGADO: 'Entregado', CANCELADO: 'Cancelado' };
const METODOS_PAGO = { EFECTIVO: 'Efectivo', TRANSFERENCIA: 'Transferencia', QR: 'QR' };

const clientesFiltrados = computed(() => {
  const q = busquedaCliente.value.toLowerCase();
  return clientes.value.filter(c => !q || c.nombre.toLowerCase().includes(q) || (c.telefono || '').includes(q));
});

const ventasFiltradas = computed(() => {
  return ventas.value.filter(v => !filtroEstadoVenta.value || v.estado === filtroEstadoVenta.value);
});

const pedidosFiltrados = computed(() => {
  return pedidos.value.filter(p => !filtroEstadoPedido.value || p.estado === filtroEstadoPedido.value);
});

const badgeVenta = (estado) => {
  const map = { PAGADO: 'verde', PENDIENTE: 'amarillo', VENCIDO: 'rojo' };
  return map[estado] || 'gris';
};

const badgePedido = (estado) => {
  const map = { ENTREGADO: 'verde', CONFIRMADO: 'azul', PENDIENTE: 'amarillo', CANCELADO: 'gris' };
  return map[estado] || 'gris';
};

async function cargar() {
  try {
    if (pestana.value === 'ventas') {
      ventas.value = await api.get('/ventas');
      clientes.value = await api.get('/clientes');
    } else if (pestana.value === 'clientes') {
      clientes.value = await api.get('/clientes?todos=true');
    } else if (pestana.value === 'pedidos') {
      pedidos.value = await api.get('/pedidos');
      clientes.value = await api.get('/clientes');
    } else if (pestana.value === 'productos') {
      productos.value = await api.get('/productos');
    } else if (pestana.value === 'cuentas') {
      cuentasPorCobrar.value = await api.get('/ventas/cuentas-por-cobrar');
    }
  } catch (e) {
    ui.error(e);
  }
}

watch(pestana, cargar);

// ==================== CLIENTES ====================
function nuevoCliente() {
  Object.assign(f, { nombre: '', tipo: 'MINORISTA', telefono: '', consentimientoWhatsapp: false, nit: '', direccion: '', activo: true });
  modal.value = 'cliente';
}

function editarCliente(c) {
  Object.assign(f, { id: c.id, nombre: c.nombre, tipo: c.tipo, telefono: c.telefono, consentimientoWhatsapp: c.consentimientoWhatsapp, nit: c.nit, direccion: c.direccion, activo: c.activo });
  modal.value = 'cliente';
}

async function guardarCliente() {
  try {
    const data = {
      nombre: f.nombre,
      tipo: f.tipo,
      telefono: f.telefono || null,
      consentimientoWhatsapp: f.consentimientoWhatsapp,
      nit: f.nit || null,
      direccion: f.direccion || null,
      activo: f.activo,
    };
    if (f.id) {
      await api.put(`/clientes/${f.id}`, data);
      ui.avisar('Cliente actualizado');
    } else {
      await api.post('/clientes', data);
      ui.avisar('Cliente creado');
    }
    modal.value = null;
    cargar();
  } catch (e) {
    ui.error(e);
  }
}

async function desactivarCliente(c) {
  if (!confirm(`¿Desactivar cliente ${c.nombre}?`)) return;
  try {
    await api.delete(`/clientes/${c.id}`);
    ui.avisar('Cliente desactivado');
    cargar();
  } catch (e) {
    ui.error(e);
  }
}

// ==================== PRODUCTOS ====================
function nuevoProducto() {
  Object.assign(f, { nombre: '', cultivo: '', unidad: 'kg', stock: 0, stockMinimo: 0, precioVentaBs: 0 });
  modal.value = 'producto';
}

function editarProducto(p) {
  Object.assign(f, { id: p.id, nombre: p.nombre, cultivo: p.cultivo, unidad: p.unidad, stock: p.stock, stockMinimo: p.stockMinimo, precioVentaBs: p.precioVentaBs });
  modal.value = 'producto';
}

async function guardarProducto() {
  try {
    const data = {
      nombre: f.nombre,
      cultivo: f.cultivo,
      unidad: f.unidad,
      stock: Number(f.stock),
      stockMinimo: Number(f.stockMinimo),
      precioVentaBs: Number(f.precioVentaBs),
    };
    if (f.id) {
      await api.put(`/productos/${f.id}`, data);
      ui.avisar('Producto actualizado');
    } else {
      await api.post('/productos', data);
      ui.avisar('Producto creado');
    }
    modal.value = null;
    cargar();
  } catch (e) {
    ui.error(e);
  }
}

function movimientoProducto(p, tipo) {
  Object.assign(f, { producto: p, tipo, cantidad: '', motivo: '' });
  modal.value = 'movimiento';
}

async function guardarMovimiento() {
  try {
    await api.post('/productos/movimientos', {
      productoId: f.producto.id,
      tipo: f.tipo,
      cantidad: Number(f.cantidad),
      motivo: f.motivo || null,
    });
    ui.avisar(f.tipo === 'ENTRADA' ? 'Entrada registrada' : 'Salida registrada');
    modal.value = null;
    cargar();
  } catch (e) {
    ui.error(e);
  }
}

// ==================== PEDIDOS ====================
async function nuevoPedido() {
  try {
    if (!clientes.value.length) {
      clientes.value = await api.get('/clientes');
    }
    if (!productos.value.length) {
      productos.value = await api.get('/productos');
    }
    Object.assign(f, {
      clienteId: clientes.value[0]?.id,
      fechaEntrega: '',
      notas: '',
      detalles: [{ producto: '', cantidad: 1, unidad: 'kg', precioBs: 0, subtotal: 0 }],
    });
    modal.value = 'pedido';
  } catch (e) {
    ui.error(e);
  }
}

function agregarDetallePedido() {
  f.detalles.push({ producto: '', cantidad: 1, unidad: 'kg', precioBs: 0, subtotal: 0 });
}

function quitarDetalle(idx) {
  f.detalles.splice(idx, 1);
}

function calcularSubtotal(d) {
  d.subtotal = d.cantidad * d.precioBs;
}

async function guardarPedido() {
  try {
    const total = f.detalles.reduce((sum, d) => sum + d.subtotal, 0);
    if (total === 0) {
      ui.avisar('Agrega al menos un producto al pedido', 'alerta');
      return;
    }
    await api.post('/pedidos', {
      clienteId: Number(f.clienteId),
      fechaEntrega: f.fechaEntrega || null,
      notas: f.notas || null,
      detalles: f.detalles,
    });
    ui.avisar('Pedido creado');
    modal.value = null;
    cargar();
  } catch (e) {
    ui.error(e);
  }
}

async function cambiarEstadoPedido(p, nuevoEstado) {
  try {
    await api.put(`/pedidos/${p.id}`, { estado: nuevoEstado });
    ui.avisar(`Pedido marcado como ${ESTADOS_PEDIDO[nuevoEstado]}`);
    cargar();
  } catch (e) {
    ui.error(e);
  }
}

// ==================== VENTAS ====================
async function nuevaVenta() {
  try {
    if (!clientes.value.length) {
      clientes.value = await api.get('/clientes');
    }
    if (!productos.value.length) {
      productos.value = await api.get('/productos');
    }
    if (sesion.tieneModulo('M2')) {
      lotesCosecha.value = await api.get('/trazabilidad/lotes').catch(() => []);
    }
    Object.assign(f, {
      clienteId: clientes.value[0]?.id,
      fecha: hoyISO(),
      notas: '',
      detalles: [{ producto: '', cantidad: 1, unidad: 'kg', precioBs: 0, subtotal: 0, productoId: null, loteCosechaId: null }],
    });
    modal.value = 'venta';
  } catch (e) {
    ui.error(e);
  }
}

function seleccionarProducto(d, productoId) {
  const p = productos.value.find(pr => pr.id === Number(productoId));
  if (p) {
    d.productoId = p.id;
    d.producto = p.nombre;
    d.unidad = p.unidad;
    d.precioBs = p.precioVentaBs;
    calcularSubtotal(d);
  }
}

async function guardarVenta() {
  try {
    const total = f.detalles.reduce((sum, d) => sum + d.subtotal, 0);
    if (total === 0) {
      ui.avisar('Agrega al menos un producto a la venta', 'alerta');
      return;
    }
    await api.post('/ventas', {
      clienteId: Number(f.clienteId),
      fecha: f.fecha || hoyISO(),
      notas: f.notas || null,
      detalles: f.detalles.map(d => ({
        producto: d.producto,
        cantidad: Number(d.cantidad),
        unidad: d.unidad,
        precioBs: Number(d.precioBs),
        subtotal: Number(d.subtotal),
        productoId: d.productoId || undefined,
        loteCosechaId: d.loteCosechaId ? Number(d.loteCosechaId) : null,
      })),
    });
    ui.avisar('Venta creada');
    modal.value = null;
    cargar();
  } catch (e) {
    ui.error(e);
  }
}

async function verVenta(v) {
  try {
    ventaDetalle.value = await api.get(`/ventas/${v.id}`);
    Object.assign(f, { montoBs: '', metodo: 'EFECTIVO', recibo: '' });
    modal.value = 'detalle-venta';
  } catch (e) {
    ui.error(e);
  }
}

async function registrarCobro() {
  try {
    if (!f.montoBs || Number(f.montoBs) <= 0) {
      ui.avisar('Ingresa un monto válido', 'alerta');
      return;
    }
    await api.post(`/ventas/${ventaDetalle.value.id}/cobros`, {
      montoBs: Number(f.montoBs),
      metodo: f.metodo,
      recibo: f.recibo || null,
    });
    ui.avisar('Cobro registrado');
    ventaDetalle.value = await api.get(`/ventas/${ventaDetalle.value.id}`);
    Object.assign(f, { montoBs: '', metodo: 'EFECTIVO', recibo: '' });
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
      <h1>Ventas y clientes</h1>
      <p>Gestión de ventas, cobros, pedidos y clientes. <span class="insignia tierra">M5</span></p>
    </div>
  </div>

  <nav class="pestanas">
    <button :class="{ activa: pestana === 'ventas' }" @click="pestana = 'ventas'"><Icono nombre="dinero" /> Ventas</button>
    <button :class="{ activa: pestana === 'clientes' }" @click="pestana = 'clientes'"><Icono nombre="personas" /> Clientes</button>
    <button :class="{ activa: pestana === 'pedidos' }" @click="pestana = 'pedidos'"><Icono nombre="caja" /> Pedidos</button>
    <button :class="{ activa: pestana === 'productos' }" @click="pestana = 'productos'"><Icono nombre="caja" /> Productos</button>
    <button :class="{ activa: pestana === 'cuentas' }" @click="pestana = 'cuentas'"><Icono nombre="dinero" /> Cuentas por cobrar</button>
  </nav>

  <!-- TAB: VENTAS -->
  <div v-if="pestana === 'ventas'" class="tarjeta" style="margin: 0">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 10px">
      <div style="display: flex; gap: 10px; align-items: center">
        <label>Estado:</label>
        <select v-model="filtroEstadoVenta">
          <option value="">Todos</option>
          <option v-for="(label, val) in ESTADOS_VENTA" :key="val" :value="val">{{ label }}</option>
        </select>
      </div>
      <button v-if="sesion.puede('ventas:escribir')" class="btn" @click="nuevaVenta"><Icono nombre="mas" /> Nueva venta</button>
    </div>

    <div class="lista-movil">
      <div v-for="v in ventasFiltradas" :key="v.id" class="tarjeta-item" @click="verVenta(v)">
        <div style="display: flex; justify-content: space-between; align-items: start">
          <div>
            <strong>{{ v.cliente.nombre }}</strong>
            <div style="font-size: 0.85rem; color: #666; margin-top: 2px">{{ fecha(v.fecha) }}</div>
          </div>
          <span :class="`insignia ${badgeVenta(v.estado)}`">{{ ESTADOS_VENTA[v.estado] }}</span>
        </div>
        <div style="margin-top: 10px; display: flex; justify-content: space-between">
          <span style="font-weight: 600">Total: {{ bs(v.total) }}</span>
          <span v-if="v.saldo > 0" style="color: var(--rojo)">Saldo: {{ bs(v.saldo) }}</span>
        </div>
      </div>
    </div>
  </div>

  <!-- TAB: CLIENTES -->
  <div v-if="pestana === 'clientes'" class="tarjeta" style="margin: 0">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 10px">
      <input v-model="busquedaCliente" type="search" placeholder="Buscar cliente..." style="max-width: 300px" />
      <button v-if="sesion.puede('ventas:escribir')" class="btn" @click="nuevoCliente"><Icono nombre="mas" /> Nuevo cliente</button>
    </div>

    <div class="lista-movil">
      <div v-for="c in clientesFiltrados" :key="c.id" class="tarjeta-item">
        <div style="display: flex; justify-content: space-between; align-items: start">
          <div>
            <strong>{{ c.nombre }}</strong>
            <span :class="`insignia ${c.activo ? 'verde' : 'gris'}`" style="margin-left: 8px">{{ c.activo ? 'Activo' : 'Inactivo' }}</span>
            <div style="font-size: 0.85rem; color: #666; margin-top: 4px">
              {{ TIPOS_CLIENTE[c.tipo] }}
              <span v-if="c.telefono"> · {{ c.telefono }}</span>
            </div>
            <div v-if="c.consentimientoWhatsapp" style="font-size: 0.8rem; color: var(--hoja); margin-top: 2px">✓ Consentimiento WhatsApp</div>
          </div>
          <div v-if="sesion.puede('ventas:escribir')" style="display: flex; gap: 5px">
            <button class="btn fantasma chico" @click="editarCliente(c)">Editar</button>
            <button v-if="c.activo" class="btn fantasma chico" @click="desactivarCliente(c)">Desactivar</button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- TAB: PEDIDOS -->
  <div v-if="pestana === 'pedidos'" class="tarjeta" style="margin: 0">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 10px">
      <div style="display: flex; gap: 10px; align-items: center">
        <label>Estado:</label>
        <select v-model="filtroEstadoPedido">
          <option value="">Todos</option>
          <option v-for="(label, val) in ESTADOS_PEDIDO" :key="val" :value="val">{{ label }}</option>
        </select>
      </div>
      <button v-if="sesion.puede('ventas:escribir')" class="btn" @click="nuevoPedido"><Icono nombre="mas" /> Nuevo pedido</button>
    </div>

    <div class="lista-movil">
      <div v-for="p in pedidosFiltrados" :key="p.id" class="tarjeta-item">
        <div style="display: flex; justify-content: space-between; align-items: start">
          <div>
            <strong>{{ p.cliente.nombre }}</strong>
            <span :class="`insignia ${badgePedido(p.estado)}`" style="margin-left: 8px">{{ ESTADOS_PEDIDO[p.estado] }}</span>
            <span v-if="p.origen === 'WHATSAPP'" class="insignia azul" style="margin-left: 6px" title="Pedido recibido por WhatsApp">WhatsApp</span>
            <div style="font-size: 0.85rem; color: #666; margin-top: 4px">
              {{ fecha(p.fecha) }}
              <span v-if="p.fechaEntrega"> · Entrega: {{ fecha(p.fechaEntrega) }}</span>
            </div>
          </div>
        </div>
        <div style="margin-top: 10px; display: flex; justify-content: space-between; align-items: center">
          <span style="font-weight: 600">Total: {{ bs(p.total) }}</span>
          <div v-if="sesion.puede('ventas:escribir') && p.estado === 'PENDIENTE'" style="display: flex; gap: 5px">
            <button class="btn fantasma chico" @click="cambiarEstadoPedido(p, 'CONFIRMADO')">Confirmar</button>
            <button class="btn fantasma chico" @click="cambiarEstadoPedido(p, 'ENTREGADO')">Entregado</button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- TAB: PRODUCTOS -->
  <div v-if="pestana === 'productos'" class="tarjeta" style="margin: 0">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px">
      <h3>Productos cosechados</h3>
      <button v-if="sesion.puede('ventas:escribir')" class="btn" @click="nuevoProducto"><Icono nombre="mas" /> Nuevo producto</button>
    </div>

    <div class="tabla-envoltura">
      <table>
        <thead>
          <tr>
            <th>Producto</th>
            <th>Cultivo</th>
            <th style="min-width: 160px">Stock</th>
            <th class="num">Precio venta</th>
            <th class="num">Valor total</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in productos" :key="p.id">
            <td><strong>{{ p.nombre }}</strong></td>
            <td><span class="insignia gris">{{ p.cultivo }}</span></td>
            <td>
              <div style="display: flex; justify-content: space-between; font-size: 0.85rem">
                <span>{{ numero(p.stock, 1) }} {{ p.unidad }}</span>
                <span v-if="p.bajoMinimo" class="insignia rojo">Bajo mínimo ({{ p.stockMinimo }})</span>
              </div>
              <div style="height: 6px; background: #eeeae0; border-radius: 4px; margin-top: 4px">
                <div
                  :style="{
                    width: `${Math.min(100, p.stockMinimo ? (p.stock / (p.stockMinimo * 2)) * 100 : 100)}%`,
                    height: '100%',
                    borderRadius: '4px',
                    background: p.bajoMinimo ? 'var(--rojo)' : 'var(--hoja)',
                  }"
                />
              </div>
            </td>
            <td class="num">{{ bs(p.precioVentaBs) }}/{{ p.unidad }}</td>
            <td class="num">{{ bs(p.stock * p.precioVentaBs) }}</td>
            <td style="white-space: nowrap; text-align: right">
              <template v-if="sesion.puede('ventas:escribir')">
                <button class="btn fantasma chico" @click="editarProducto(p)">Editar</button>
                <button class="btn fantasma chico" @click="movimientoProducto(p, 'ENTRADA')">+ Entrada</button>
                <button class="btn fantasma chico" @click="movimientoProducto(p, 'SALIDA')">− Salida</button>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- TAB: CUENTAS POR COBRAR -->
  <div v-if="pestana === 'cuentas' && cuentasPorCobrar" class="tarjeta" style="margin: 0">
    <h3>Resumen de cuentas por cobrar</h3>
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0">
      <div class="tarjeta" style="background: var(--hoja-clara); border-left: 4px solid var(--hoja)">
        <div style="font-size: 0.85rem; color: #666">Total por cobrar</div>
        <div style="font-size: 1.5rem; font-weight: 700; color: var(--hoja)">{{ bs(cuentasPorCobrar.totalPorCobrar) }}</div>
      </div>
      <div class="tarjeta" style="background: #fff3f3; border-left: 4px solid var(--rojo)">
        <div style="font-size: 0.85rem; color: #666">Total vencido</div>
        <div style="font-size: 1.5rem; font-weight: 700; color: var(--rojo)">{{ bs(cuentasPorCobrar.totalVencido) }}</div>
      </div>
      <div class="tarjeta" style="background: #f5f5f5; border-left: 4px solid #666">
        <div style="font-size: 0.85rem; color: #666">Ventas pendientes</div>
        <div style="font-size: 1.5rem; font-weight: 700">{{ cuentasPorCobrar.cantidadVentas }}</div>
      </div>
    </div>

    <div class="tabla-envoltura" style="margin-top: 20px">
      <table>
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Fecha venta</th>
            <th class="num">Total</th>
            <th class="num">Pagado</th>
            <th class="num">Saldo</th>
            <th>Estado</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr v-for="v in cuentasPorCobrar.ventas" :key="v.id">
            <td>
              <strong>{{ v.cliente.nombre }}</strong>
              <div style="font-size: 0.85rem; color: #666">{{ v.cliente.telefono }}</div>
            </td>
            <td>{{ fecha(v.fecha) }}</td>
            <td class="num">{{ bs(v.total) }}</td>
            <td class="num">{{ bs(v.pagado) }}</td>
            <td class="num" style="color: var(--rojo); font-weight: 600">{{ bs(v.saldo) }}</td>
            <td><span :class="`insignia ${badgeVenta(v.estado)}`">{{ ESTADOS_VENTA[v.estado] }}</span></td>
            <td><button class="btn fantasma chico" @click="verVenta(v)">Ver</button></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- MODAL: CLIENTE -->
  <Modal v-if="modal === 'cliente'" :titulo="f.id ? 'Editar cliente' : 'Nuevo cliente'" @cerrar="modal = null">
    <form @submit.prevent="guardarCliente">
      <div class="campo">
        <label>Nombre</label>
        <input v-model="f.nombre" required minlength="2" />
      </div>
      <div class="fila-campos">
        <div class="campo">
          <label>Tipo</label>
          <select v-model="f.tipo">
            <option v-for="(label, val) in TIPOS_CLIENTE" :key="val" :value="val">{{ label }}</option>
          </select>
        </div>
        <div class="campo">
          <label>Teléfono</label>
          <input v-model="f.telefono" type="tel" />
        </div>
      </div>
      <div class="fila-campos">
        <div class="campo">
          <label>NIT</label>
          <input v-model="f.nit" />
        </div>
        <div class="campo">
          <label>Dirección</label>
          <input v-model="f.direccion" />
        </div>
      </div>
      <div class="campo">
        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer">
          <input v-model="f.consentimientoWhatsapp" type="checkbox" />
          <span>Tiene consentimiento para WhatsApp</span>
        </label>
      </div>
      <div v-if="f.id" class="campo">
        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer">
          <input v-model="f.activo" type="checkbox" />
          <span>Cliente activo</span>
        </label>
      </div>
      <div class="acciones">
        <button type="button" class="btn secundario" @click="modal = null">Cancelar</button>
        <button class="btn">Guardar</button>
      </div>
    </form>
  </Modal>

  <!-- MODAL: PRODUCTO -->
  <Modal v-if="modal === 'producto'" :titulo="f.id ? 'Editar producto' : 'Nuevo producto'" @cerrar="modal = null">
    <form @submit.prevent="guardarProducto">
      <div class="campo">
        <label>Nombre del producto</label>
        <input v-model="f.nombre" required minlength="2" placeholder="Tomate Cherry, Lechuga Crespa..." />
      </div>
      <div class="fila-campos">
        <div class="campo">
          <label>Cultivo</label>
          <input v-model="f.cultivo" required placeholder="TOMATE, LECHUGA..." />
        </div>
        <div class="campo">
          <label>Unidad</label>
          <input v-model="f.unidad" required maxlength="10" placeholder="kg, unidad..." />
        </div>
      </div>
      <div class="fila-campos">
        <div class="campo">
          <label>Stock inicial</label>
          <input v-model="f.stock" type="number" min="0" step="any" />
        </div>
        <div class="campo">
          <label>Stock mínimo</label>
          <input v-model="f.stockMinimo" type="number" min="0" step="any" />
        </div>
        <div class="campo">
          <label>Precio venta (Bs)</label>
          <input v-model="f.precioVentaBs" type="number" min="0" step="any" />
        </div>
      </div>
      <div class="acciones">
        <button type="button" class="btn secundario" @click="modal = null">Cancelar</button>
        <button class="btn">Guardar</button>
      </div>
    </form>
  </Modal>

  <!-- MODAL: MOVIMIENTO DE PRODUCTO -->
  <Modal v-if="modal === 'movimiento'" :titulo="`${f.tipo === 'ENTRADA' ? 'Entrada' : 'Salida'} · ${f.producto.nombre}`" @cerrar="modal = null">
    <form @submit.prevent="guardarMovimiento">
      <div class="campo">
        <label>Cantidad ({{ f.producto.unidad }})</label>
        <input v-model="f.cantidad" type="number" min="0.01" step="any" required />
      </div>
      <div class="campo">
        <label>Motivo</label>
        <input v-model="f.motivo" maxlength="120" placeholder="Cosecha, ajuste, merma..." />
      </div>
      <div class="acciones">
        <button type="button" class="btn secundario" @click="modal = null">Cancelar</button>
        <button class="btn">Registrar</button>
      </div>
    </form>
  </Modal>

  <!-- MODAL: NUEVO PEDIDO -->
  <Modal v-if="modal === 'pedido'" titulo="Nuevo pedido" @cerrar="modal = null" ancho="800px">
    <form @submit.prevent="guardarPedido">
      <div class="campo">
        <label>Cliente</label>
        <select v-model="f.clienteId" required>
          <option v-for="c in clientes.filter(x => x.activo)" :key="c.id" :value="c.id">{{ c.nombre }}</option>
        </select>
      </div>
      <div class="fila-campos">
        <div class="campo">
          <label>Fecha de entrega (opcional)</label>
          <input v-model="f.fechaEntrega" type="date" />
        </div>
        <div class="campo">
          <label>Notas</label>
          <input v-model="f.notas" placeholder="Instrucciones especiales..." />
        </div>
      </div>

      <h4 style="margin: 20px 0 10px">Detalles del pedido</h4>
      <div v-for="(d, idx) in f.detalles" :key="idx" style="display: flex; gap: 10px; margin-bottom: 10px; align-items: end">
        <div class="campo" style="flex: 2">
          <label>Producto</label>
          <input v-model="d.producto" required />
        </div>
        <div class="campo" style="flex: 1">
          <label>Cantidad</label>
          <input v-model="d.cantidad" type="number" min="0.01" step="any" required @input="calcularSubtotal(d)" />
        </div>
        <div class="campo" style="flex: 1">
          <label>Unidad</label>
          <input v-model="d.unidad" required maxlength="10" />
        </div>
        <div class="campo" style="flex: 1">
          <label>Precio (Bs)</label>
          <input v-model="d.precioBs" type="number" min="0" step="any" required @input="calcularSubtotal(d)" />
        </div>
        <div class="campo" style="flex: 1">
          <label>Subtotal</label>
          <input :value="bs(d.subtotal)" readonly />
        </div>
        <button v-if="f.detalles.length > 1" type="button" class="btn fantasma chico" @click="quitarDetalle(idx)">×</button>
      </div>
      <button type="button" class="btn secundario chico" @click="agregarDetallePedido">+ Agregar producto</button>

      <div class="acciones" style="margin-top: 20px">
        <button type="button" class="btn secundario" @click="modal = null">Cancelar</button>
        <button class="btn">Crear pedido</button>
      </div>
    </form>
  </Modal>

  <!-- MODAL: NUEVA VENTA -->
  <Modal v-if="modal === 'venta'" titulo="Nueva venta" @cerrar="modal = null" ancho="900px">
    <form @submit.prevent="guardarVenta">
      <div class="fila-campos">
        <div class="campo">
          <label>Cliente</label>
          <select v-model="f.clienteId" required>
            <option v-for="c in clientes.filter(x => x.activo)" :key="c.id" :value="c.id">{{ c.nombre }}</option>
          </select>
        </div>
        <div class="campo">
          <label>Fecha</label>
          <input v-model="f.fecha" type="date" required />
        </div>
      </div>
      <div class="campo">
        <label>Notas</label>
        <input v-model="f.notas" placeholder="Información adicional..." />
      </div>

      <h4 style="margin: 20px 0 10px">Detalles de la venta</h4>
      <div v-for="(d, idx) in f.detalles" :key="idx" style="margin-bottom: 15px; padding: 10px; background: #f9f9f9; border-radius: 6px">
        <div style="display: flex; gap: 10px; align-items: end">
          <div class="campo" style="flex: 2">
            <label>Producto</label>
            <select v-model="d.productoId" @change="seleccionarProducto(d, $event.target.value)">
              <option value="">Seleccionar producto...</option>
              <option v-for="p in productos" :key="p.id" :value="p.id">{{ p.nombre }} ({{ numero(p.stock, 1) }} {{ p.unidad }})</option>
            </select>
          </div>
          <div class="campo" style="flex: 1">
            <label>Cantidad</label>
            <input v-model="d.cantidad" type="number" min="0.01" step="any" required @input="calcularSubtotal(d)" />
          </div>
          <div class="campo" style="flex: 1">
            <label>Precio (Bs)</label>
            <input v-model="d.precioBs" type="number" min="0" step="any" required @input="calcularSubtotal(d)" />
          </div>
          <div class="campo" style="flex: 1">
            <label>Subtotal</label>
            <input :value="bs(d.subtotal)" readonly />
          </div>
          <button v-if="f.detalles.length > 1" type="button" class="btn fantasma chico" @click="quitarDetalle(idx)">×</button>
        </div>
        <div v-if="sesion.tieneModulo('M2')" class="campo" style="margin-top: 10px">
          <label>Lote de cosecha QR (opcional - para trazabilidad)</label>
          <select v-model="d.loteCosechaId">
            <option value="">Sin vincular a lote QR</option>
            <option v-for="lc in lotesCosecha" :key="lc.id" :value="lc.id">{{ lc.codigo }} - {{ lc.campania.cultivo }} ({{ numero(lc.cantidadKg, 1) }} kg)</option>
          </select>
        </div>
      </div>
      <button type="button" class="btn secundario chico" @click="f.detalles.push({ producto: '', cantidad: 1, unidad: 'kg', precioBs: 0, subtotal: 0, productoId: null, loteCosechaId: null })">+ Agregar producto</button>

      <div class="acciones" style="margin-top: 20px">
        <button type="button" class="btn secundario" @click="modal = null">Cancelar</button>
        <button class="btn">Crear venta</button>
      </div>
    </form>
  </Modal>

  <!-- MODAL: DETALLE VENTA CON COBROS -->
  <Modal v-if="modal === 'detalle-venta' && ventaDetalle" titulo="Detalle de venta" @cerrar="modal = null" ancho="800px">
    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 20px">
      <div>
        <div style="font-size: 0.85rem; color: #666">Cliente</div>
        <div style="font-weight: 600">{{ ventaDetalle.cliente.nombre }}</div>
        <div style="font-size: 0.85rem; color: #666">{{ TIPOS_CLIENTE[ventaDetalle.cliente.tipo] }}</div>
      </div>
      <div>
        <div style="font-size: 0.85rem; color: #666">Fecha</div>
        <div>{{ fecha(ventaDetalle.fecha) }}</div>
      </div>
      <div>
        <div style="font-size: 0.85rem; color: #666">Total</div>
        <div style="font-size: 1.3rem; font-weight: 700">{{ bs(ventaDetalle.total) }}</div>
      </div>
      <div>
        <div style="font-size: 0.85rem; color: #666">Estado</div>
        <span :class="`insignia ${badgeVenta(ventaDetalle.estado)}`">{{ ESTADOS_VENTA[ventaDetalle.estado] }}</span>
      </div>
      <div>
        <div style="font-size: 0.85rem; color: #666">Pagado</div>
        <div style="color: var(--hoja); font-weight: 600">{{ bs(ventaDetalle.pagado) }}</div>
      </div>
      <div>
        <div style="font-size: 0.85rem; color: #666">Saldo</div>
        <div style="color: var(--rojo); font-weight: 600">{{ bs(ventaDetalle.saldo) }}</div>
      </div>
    </div>

    <h4>Productos vendidos</h4>
    <table style="width: 100%; margin-bottom: 20px">
      <thead>
        <tr>
          <th>Producto</th>
          <th>Cantidad</th>
          <th class="num">Precio</th>
          <th class="num">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="d in ventaDetalle.detalles" :key="d.id">
          <td>
            {{ d.producto }}
            <span v-if="d.loteCosechaId" class="insignia azul" style="margin-left: 5px">QR: {{ d.loteCosecha.codigo }}</span>
          </td>
          <td>{{ numero(d.cantidad, 2) }} {{ d.unidad }}</td>
          <td class="num">{{ bs(d.precioBs) }}</td>
          <td class="num">{{ bs(d.subtotal) }}</td>
        </tr>
      </tbody>
    </table>

    <h4>Historial de cobros</h4>
    <table v-if="ventaDetalle.cobros.length" style="width: 100%; margin-bottom: 20px">
      <thead>
        <tr>
          <th>Fecha</th>
          <th>Monto</th>
          <th>Método</th>
          <th>Recibo</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="c in ventaDetalle.cobros" :key="c.id">
          <td>{{ fechaHora(c.fecha) }}</td>
          <td>{{ bs(c.montoBs) }}</td>
          <td><span class="insignia gris">{{ METODOS_PAGO[c.metodo] }}</span></td>
          <td>{{ c.recibo || '-' }}</td>
        </tr>
      </tbody>
    </table>
    <p v-else style="color: #666; font-style: italic">No hay cobros registrados</p>

    <div v-if="ventaDetalle.saldo > 0 && sesion.puede('ventas:escribir')" style="border-top: 1px solid #ddd; padding-top: 20px; margin-top: 20px">
      <h4>Registrar cobro</h4>
      <form @submit.prevent="registrarCobro">
        <div class="fila-campos">
          <div class="campo">
            <label>Monto (Bs) - Máximo: {{ bs(ventaDetalle.saldo) }}</label>
            <input v-model="f.montoBs" type="number" min="0.01" :max="ventaDetalle.saldo" step="any" required />
          </div>
          <div class="campo">
            <label>Método</label>
            <select v-model="f.metodo">
              <option v-for="(label, val) in METODOS_PAGO" :key="val" :value="val">{{ label }}</option>
            </select>
          </div>
          <div class="campo">
            <label>Nro. recibo (opcional)</label>
            <input v-model="f.recibo" maxlength="60" />
          </div>
        </div>
        <button class="btn">Registrar cobro</button>
      </form>
    </div>
  </Modal>
</template>

<style scoped>
.pestanas {
  display: flex;
  gap: 5px;
  margin-bottom: 20px;
  overflow-x: auto;
  border-bottom: 2px solid #e0e0e0;
}
.pestanas button {
  padding: 12px 20px;
  border: none;
  background: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #666;
  font-weight: 500;
  border-bottom: 3px solid transparent;
  transition: all 0.2s;
  white-space: nowrap;
}
.pestanas button:hover {
  color: var(--tierra);
  background: #f9f9f9;
}
.pestanas button.activa {
  color: var(--tierra);
  border-bottom-color: var(--tierra);
  font-weight: 600;
}

.lista-movil {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.tarjeta-item {
  padding: 15px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}
.tarjeta-item:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border-color: var(--tierra);
}

@media (max-width: 768px) {
  .pestanas {
    gap: 0;
  }
  .pestanas button {
    font-size: 0.85rem;
    padding: 10px 12px;
  }
}
</style>
