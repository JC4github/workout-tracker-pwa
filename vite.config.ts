import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1]

export default defineConfig({
  // GitHub Pages serves project repositories under /<repository-name>/.
  // Keep local development and the existing hosted deployment at the root.
  base: process.env.GITHUB_ACTIONS === 'true' && repositoryName ? `/${repositoryName}/` : '/',
  plugins: [react(), VitePWA({
    registerType: 'autoUpdate',
    includeAssets: ['bodymap-front.png', 'bodymap-back.png'],
    manifest: { name: 'Muscle Map Workout Tracker', short_name: 'Muscle Map', description: 'Fast, private muscle-level workout tracking.', theme_color: '#0d0d0d', background_color: '#0d0d0d', display: 'standalone', orientation: 'portrait', icons: [{ src: 'app-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }] },
  })],
})
