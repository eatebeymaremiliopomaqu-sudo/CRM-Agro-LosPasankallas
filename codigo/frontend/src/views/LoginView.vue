<script setup>
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useSesion } from '../stores/sesion.js';
import Icono from '../components/Icono.vue';

const sesion = useSesion();
const router = useRouter();
const ruta = useRoute();
const email = ref('');
const password = ref('');
const error = ref('');
const cargando = ref(false);

const demo = [
  ['propietario@finca.test', 'Propietario'],
  ['encargado@finca.test', 'Encargado'],
  ['trabajador@finca.test', 'Trabajador'],
];

async function entrar() {
  error.value = '';
  cargando.value = true;
  try {
    await sesion.iniciar(email.value.trim(), password.value);
    router.push(ruta.query.volver || '/');
  } catch (e) {
    error.value = e.status === 0 ? 'No hay conexión con el servidor. Intenta de nuevo en unos segundos (el servidor gratuito puede tardar en despertar).' : e.message;
  } finally {
    cargando.value = false;
  }
}
function usarDemo(correo) {
  email.value = correo;
  password.value = 'Agro2026!';
}
</script>

<template>
  <div class="login">
    <section class="login-arte">
      <div class="marca" style="padding: 0">
        <img src="/favicon.svg" width="44" height="44" alt="" />
        <div><strong style="color: #fff; font-family: var(--titulo); font-size: 1.3rem">CRM-Agro</strong></div>
      </div>
      <div style="position: relative; z-index: 1">
        <h1>Tu finca, ordenada desde el surco hasta el mercado.</h1>
        <p style="max-width: 46ch; color: #c9d8cb; font-size: 1.05rem">
          Registra labores, sigue cada lote con un código QR y lleva la asistencia de tu gente. También por WhatsApp, y aunque no haya señal.
        </p>
        <div style="display: flex; gap: 18px; flex-wrap: wrap; margin-top: 20px; color: #dfe9df; font-weight: 500">
          <span style="display: flex; gap: 6px; align-items: center"><Icono nombre="campo" /> Control de campo</span>
          <span style="display: flex; gap: 6px; align-items: center"><Icono nombre="qr" /> Trazabilidad</span>
          <span style="display: flex; gap: 6px; align-items: center"><Icono nombre="whatsapp" /> WhatsApp + IA</span>
        </div>
      </div>
      <svg class="surcos" viewBox="0 0 800 300" preserveAspectRatio="none" aria-hidden="true">
        <path v-for="i in 9" :key="i" :d="`M-50 ${300 - i * 30} Q 400 ${230 - i * 34} 850 ${300 - i * 30}`" fill="none" stroke="#8BC34A" stroke-width="3" />
      </svg>
    </section>

    <section class="login-form">
      <form class="tarjeta" @submit.prevent="entrar">
        <h2>Iniciar sesión</h2>
        <p class="apagado" style="margin-top: 0">Ingresa con tu cuenta de la finca.</p>
        <div class="campo">
          <label for="email">Correo</label>
          <input id="email" v-model="email" type="email" autocomplete="username" required placeholder="nombre@finca.test" />
        </div>
        <div class="campo">
          <label for="clave">Contraseña</label>
          <input id="clave" v-model="password" type="password" autocomplete="current-password" required minlength="6" />
        </div>
        <p v-if="error" class="campo error" role="alert">{{ error }}</p>
        <button class="btn" style="width: 100%" :disabled="cargando">{{ cargando ? 'Ingresando…' : 'Ingresar' }}</button>
        <div class="cuentas-demo">
          <strong>Cuentas de demostración</strong> (datos ficticios, clave <code>Agro2026!</code>):<br />
          <span v-for="([c, r], i) in demo" :key="c"><button type="button" @click="usarDemo(c)">{{ r }}</button><span v-if="i < demo.length - 1"> · </span></span>
        </div>
      </form>
    </section>
  </div>
</template>
