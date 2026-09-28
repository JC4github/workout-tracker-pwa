import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [react(), VitePWA({
    registerType: 'autoUpdate',
    includeAssets: ['bodymap-front.png', 'bodymap-back.png'],
    manifest: { name: 'Muscle Map Workout Tracker', short_name: 'Muscle Map', description: 'Fast, private muscle-level workout tracking.', theme_color: '#0d0d0d', background_color: '#0d0d0d', display: 'standalone', orientation: 'portrait', icons: [{ src: 'app-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }] },
  })],
})
