import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Базовый путь: для GitHub Pages /Workshop-Inventory/, для хостинга в корне задайте BASE=/
const base = process.env.BASE ?? '/Workshop-Inventory/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Workshop Inventory',
        short_name: 'Мастерская',
        description: 'Учёт инструментов, оборудования и расходников',
        lang: 'ru',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#0f172a',
        theme_color: '#0f172a',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: { globPatterns: ['**/*.{js,css,html,png,svg}'] }
    })
  ],
  test: { environment: 'node' }
});