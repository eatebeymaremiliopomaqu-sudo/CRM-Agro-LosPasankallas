<script setup>
import { onMounted, onBeforeUnmount } from 'vue';
const props = defineProps({ titulo: String, ancho: { type: String, default: '560px' } });
const emit = defineEmits(['cerrar']);
const tecla = (e) => e.key === 'Escape' && emit('cerrar');
onMounted(() => document.addEventListener('keydown', tecla));
onBeforeUnmount(() => document.removeEventListener('keydown', tecla));
</script>

<template>
  <Teleport to="body">
    <div class="velo" @click.self="emit('cerrar')">
      <div class="modal" role="dialog" aria-modal="true" :aria-label="props.titulo" :style="{ width: `min(${props.ancho}, 100%)` }">
        <div class="tarjeta-titulo">
          <h2>{{ props.titulo }}</h2>
          <button class="btn fantasma" aria-label="Cerrar" @click="emit('cerrar')">✕</button>
        </div>
        <slot />
      </div>
    </div>
  </Teleport>
</template>
