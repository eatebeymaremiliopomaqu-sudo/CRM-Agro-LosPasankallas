import { defineStore } from 'pinia';
import { api } from '../api.js';

export const useVentas = defineStore('ventas', {
  state: () => ({
    ventas: [],
    clientes: [],
    pedidos: [],
    productos: [],
    cuentasPorCobrar: null,
  }),
  getters: {
    ventasPendientes: (s) => s.ventas.filter(v => v.estado === 'PENDIENTE'),
    ventasVencidas: (s) => s.ventas.filter(v => v.estado === 'VENCIDO'),
    totalPorCobrar: (s) => s.ventas.reduce((sum, v) => sum + v.saldo, 0),
    clientesActivos: (s) => s.clientes.filter(c => c.activo),
    productosAlerta: (s) => s.productos.filter(p => p.bajoMinimo),
  },
  actions: {
    async cargarVentas() {
      this.ventas = await api.get('/ventas');
      return this.ventas;
    },
    async cargarClientes() {
      this.clientes = await api.get('/clientes?todos=true');
      return this.clientes;
    },
    async cargarPedidos() {
      this.pedidos = await api.get('/pedidos');
      return this.pedidos;
    },
    async cargarProductos() {
      this.productos = await api.get('/productos');
      return this.productos;
    },
    async cargarCuentasPorCobrar() {
      this.cuentasPorCobrar = await api.get('/ventas/cuentas-por-cobrar');
      return this.cuentasPorCobrar;
    },
    async crearVenta(data) {
      const venta = await api.post('/ventas', data);
      this.ventas.unshift(venta);
      return venta;
    },
    async crearCliente(data) {
      const cliente = await api.post('/clientes', data);
      this.clientes.unshift(cliente);
      return cliente;
    },
    async crearProducto(data) {
      const producto = await api.post('/productos', data);
      this.productos.unshift(producto);
      return producto;
    },
  },
});
