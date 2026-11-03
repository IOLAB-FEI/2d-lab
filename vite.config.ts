import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'

export default defineConfig({
  base: './',
  plugins: [vue(), vuetify({ autoImport: true })],
  test: { include: ['src/**/*.test.ts'] },
})
