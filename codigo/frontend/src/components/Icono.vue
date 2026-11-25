<script setup>
// Set propio de íconos de trazo (24x24), sin dependencias externas.
defineProps({ nombre: { type: String, required: true }, tam: { type: [Number, String], default: 20 } });
const P = {
  tablero: 'M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-6H3zM13 3v6h8V3z',
  parcela: 'M3 7l6-3 6 3 6-3v13l-6 3-6-3-6 3zM9 4v13M15 7v13',
  campo: 'M12 22V11M12 13c0-5 3.5-8 8-8 0 5-3.5 8-8 8zM12 16c0-4-3-7-7-7 0 4 3 7 7 7z',
  qr: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM18 18h3v3h-3zM14 20h2M20 14v2',
  personas: 'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM22 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8',
  chat: 'M21 12a8 8 0 01-11.6 7.1L3 21l1.9-6.4A8 8 0 1121 12z',
  caja: 'M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8',
  ajustes: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 01-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 010-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 014 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 010 4h-.1a1.7 1.7 0 00-1.5 1z',
  mas: 'M12 5v14M5 12h14',
  salir: 'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9',
  alerta: 'M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0zM12 9v4M12 17h.01',
  nube: 'M18 10h-1.3A8 8 0 109 20h9a5 5 0 000-10z',
  sinred: 'M1 1l22 22M16.7 11.1A11 11 0 0122.6 9M5 12.6a11 11 0 015.2-2.5M10.7 5A16 16 0 0123 8.6M1.4 8.6a16 16 0 014.3-2.7M8.5 16.1a5 5 0 017 0M12 20h.01',
  enviar: 'M22 2L11 13M22 2l-7 20-4-9-9-4z',
  gota: 'M12 2.7l5.7 5.6a8 8 0 11-11.4 0z',
  hoja: 'M11 20A7 7 0 019.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10zM2 21c0-3 1.9-5.4 5.1-6',
  calendario: 'M3 4h18v18H3zM16 2v4M8 2v4M3 10h18',
  check: 'M20 6L9 17l-5-5',
  x: 'M18 6L6 18M6 6l12 12',
  descargar: 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3',
  ubicacion: 'M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0zM12 13a3 3 0 100-6 3 3 0 000 6z',
  balanza: 'M12 3v18M5 21h14M6 7h12M6 7l-3 7a3 3 0 006 0zM18 7l-3 7a3 3 0 006 0z',
  escudo: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  menu: 'M3 12h18M3 6h18M3 18h18',
  whatsapp: 'M3 21l1.6-5.2A9 9 0 1112 21a9 9 0 01-4.3-1.1zM9 9.5c0 3 2.5 5.5 5.5 5.5l1.5-1.5-2-1-1 1c-1 0-2.5-1.5-2.5-2.5l1-1-1-2z',
  reloj: 'M12 22a10 10 0 100-20 10 10 0 000 20zM12 6v6l4 2',
  tractor: 'M3 4h9l2 7M5 4v7h12l3 3v3h-2M7 20a3 3 0 100-6 3 3 0 000 6zM18 20a2 2 0 100-4 2 2 0 000 4zM10 17h6',
};
</script>

<template>
  <svg :width="tam" :height="tam" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path :d="P[nombre] || P.hoja" />
  </svg>
</template>
