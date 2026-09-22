/**
 * playground 演示站的构建配置。
 */
import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

const srcDir = fileURLToPath(new URL('./src', import.meta.url))

export default defineConfig({
  plugins: [vue()],
  base: process.env.DEMO_BASE ?? '/iiif-viewer/',
  resolve: {
    alias: [{ find: /^@\//, replacement: `${srcDir}/` }],
  },
  build: {
    target: 'es2022',
    outDir: 'demo-dist',
    emptyOutDir: true,
    sourcemap: false,
  },
})
