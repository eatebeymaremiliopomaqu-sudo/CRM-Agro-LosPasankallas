<script setup>
import { onMounted, reactive, ref, watch } from 'vue';
import { api } from '../api.js';
import { useSesion } from '../stores/sesion.js';
import { useUi } from '../stores/ui.js';
import Icono from '../components/Icono.vue';
import Modal from '../components/Modal.vue';
import { ETIQUETAS_ROL } from '../utils/permisos.js';
import { fechaHora } from '../utils/formato.js';

const sesion = useSesion();
const ui = useUi();
const pestana = ref('modulos');
const finca = ref(null);
const activos = ref([]);
const usuarios = ref([]);
const auditoria = ref([]);
const modal = ref(false);
const u = reactive({});
const DEPENDE = { M2: 'M1', M3: 'M1', M5: 'M1' };

async function cargar() {
  try {
    finca.value = await api.get('/finca');
    activos.value = finca.value.modulos.filter((m) => m !== 'M0');
  } catch (e) {
    ui.error(e);
  }
}
async function alternar(m, encender) {
  let lista = encender ? [...new Set([...activos.value, m, ...(DEPENDE[m] ? [DEPENDE[m]] : [])])] : activos.value.filter((x) => x !== m);
  if (!encender) lista = lista.filter((x) => DEPENDE[x] !== m); // apagar dependientes
  try {
    const r = await api.put('/finca/modulos', { modulos: lista });
    activos.value = r.modulos.filter((x) => x !== 'M0');
    sesion.actualizarModulos(r.modulos);
    ui.avisar(`Módulo ${m} ${encender ? 'activado' : 'desactivado'}`);
  } catch (e) {
    ui.error(e);
  }
}
async function guardarFinca() {
  try {
    const { nombre, municipio, departamento, hectareas, lat, lng, telefonoWa } = finca.value;
    await api.patch('/finca', { nombre, municipio, departamento, hectareas: Number(hectareas), lat: lat === '' ? null : Number(lat), lng: lng === '' ? null : Number(lng), telefonoWa: telefonoWa || null });
    ui.avisar('Datos de la finca guardados');
    sesion.refrescar();
  } catch (e) {
    ui.error(e);
  }
}
async function cargarUsuarios() {
  try {
    usuarios.value = await api.get('/usuarios');
  } catch (e) {
    ui.error(e);
  }
}
async function cargarAuditoria() {
  try {
    auditoria.value = await api.get('/auditoria?limite=80');
  } catch (e) {
    ui.error(e);
  }
}
function nuevoUsuario() {
  Object.assign(u, { nombre: '', email: '', password: '', rol: 'SUPERVISOR', telefono: '' });
  modal.value = true;
}
async function crearUsuario() {
  try {
    await api.post('/usuarios', { ...u, telefono: u.telefono || null });
    modal.value = false;
    ui.avisar('Usuario creado');
    cargarUsuarios();
  } catch (e) {
    ui.error(e);
  }
}
async function alternarUsuario(x) {
  try {
    await api.patch(`/usuarios/${x.id}`, { activo: !x.activo });
    cargarUsuarios();
  } catch (e) {
    ui.error(e);
  }
}
watch(pestana, (p) => (p === 'usuarios' ? cargarUsuarios() : p === 'auditoria' ? cargarAuditoria() : null));
onMounted(cargar);
</script>

<template>
  <div class="encabezado">
    <div>
      <h1>Configuración</h1>
      <p>Datos de la finca, módulos activables, usuarios y auditoría. <span class="insignia tierra">M0</span></p>
    </div>
  </div>

  <div class="tarjeta">
    <div class="pestanas">
      <button :class="{ activa: pestana === 'modulos' }" @click="pestana = 'modulos'">Módulos</button>
      <button :class="{ activa: pestana === 'finca' }" @click="pestana = 'finca'">Finca</button>
      <button :class="{ activa: pestana === 'usuarios' }" @click="pestana = 'usuarios'">Usuarios y roles</button>
      <button :class="{ activa: pestana === 'auditoria' }" @click="pestana = 'auditoria'">Auditoría</button>
    </div>

    <template v-if="pestana === 'modulos' && finca">
      <p class="apagado" style="margin-top: 0">Activa sólo lo que tu finca necesita. Al desactivar un módulo se ocultan sus pantallas y la API bloquea sus rutas; los datos no se borran.</p>
      <div v-for="(desc, m) in finca.catalogoModulos" :key="m" class="modulo-fila">
        <span class="codigo">{{ m }}</span>
        <div style="flex: 1">
          <strong>{{ desc }}</strong><br />
          <small v-if="m === 'M0'">Siempre activo</small>
          <small v-else-if="DEPENDE[m]">Requiere {{ DEPENDE[m] }}</small>
        </div>
        <label class="interruptor">
          <input type="checkbox" :checked="m === 'M0' || activos.includes(m)" :disabled="m === 'M0'" :aria-label="`Módulo ${m}`" @change="alternar(m, $event.target.checked)" />
          <span />
        </label>
      </div>
    </template>

    <form v-else-if="pestana === 'finca' && finca" @submit.prevent="guardarFinca">
      <div class="fila-campos">
        <div class="campo"><label>Nombre</label><input v-model="finca.nombre" required /></div>
        <div class="campo"><label>Municipio</label><input v-model="finca.municipio" /></div>
        <div class="campo"><label>Departamento</label><input v-model="finca.departamento" /></div>
      </div>
      <div class="fila-campos">
        <div class="campo"><label>Hectáreas</label><input v-model="finca.hectareas" type="number" step="0.1" min="0" /></div>
        <div class="campo"><label>Latitud</label><input v-model="finca.lat" type="number" step="any" /></div>
        <div class="campo"><label>Longitud</label><input v-model="finca.lng" type="number" step="any" /></div>
        <div class="campo"><label>WhatsApp de la finca</label><input v-model="finca.telefonoWa" /></div>
      </div>
      <button class="btn">Guardar</button>
    </form>

    <template v-else-if="pestana === 'usuarios'">
      <div style="display: flex; justify-content: flex-end; margin-bottom: 10px"><button class="btn" @click="nuevoUsuario"><Icono nombre="mas" /> Nuevo usuario</button></div>
      <div class="tabla-envoltura">
        <table>
          <thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Teléfono (WhatsApp)</th><th>Estado</th><th /></tr></thead>
          <tbody>
            <tr v-for="x in usuarios" :key="x.id">
              <td><strong>{{ x.nombre }}</strong></td>
              <td>{{ x.email }}</td>
              <td><span class="insignia azul">{{ ETIQUETAS_ROL[x.rol] }}</span></td>
              <td>{{ x.telefono || '—' }}</td>
              <td><span class="insignia" :class="x.activo ? '' : 'gris'">{{ x.activo ? 'Activo' : 'Inactivo' }}</span></td>
              <td style="text-align: right"><button v-if="x.id !== sesion.usuario?.id" class="btn fantasma chico" @click="alternarUsuario(x)">{{ x.activo ? 'Desactivar' : 'Activar' }}</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <template v-else-if="pestana === 'auditoria'">
      <div class="tabla-envoltura">
        <table>
          <thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Entidad</th><th>Detalle</th></tr></thead>
          <tbody>
            <tr v-for="a in auditoria" :key="a.id">
              <td style="white-space: nowrap">{{ fechaHora(a.fecha) }}</td>
              <td>{{ a.usuario?.nombre || 'WhatsApp / sistema' }}</td>
              <td><span class="insignia gris">{{ a.accion }}</span></td>
              <td>{{ a.entidad }} <small v-if="a.entidadId">#{{ a.entidadId }}</small></td>
              <td><small>{{ a.detalle }}</small></td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>

  <Modal v-if="modal" titulo="Nuevo usuario" @cerrar="modal = false">
    <form @submit.prevent="crearUsuario">
      <div class="campo"><label>Nombre</label><input v-model="u.nombre" required minlength="3" /></div>
      <div class="fila-campos">
        <div class="campo"><label>Correo</label><input v-model="u.email" type="email" required /></div>
        <div class="campo"><label>Contraseña inicial</label><input v-model="u.password" type="password" required minlength="8" autocomplete="new-password" /></div>
      </div>
      <div class="fila-campos">
        <div class="campo"><label>Rol</label><select v-model="u.rol"><option v-for="(t, k) in ETIQUETAS_ROL" :key="k" :value="k">{{ t }}</option></select></div>
        <div class="campo"><label>Teléfono WhatsApp</label><input v-model="u.telefono" placeholder="59170000000" /></div>
      </div>
      <div class="acciones"><button type="button" class="btn secundario" @click="modal = false">Cancelar</button><button class="btn">Crear</button></div>
    </form>
  </Modal>
</template>
