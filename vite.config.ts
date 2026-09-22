import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import dts from 'vite-plugin-dts'
import { defineConfig } from 'vitest/config'

const srcDir = fileURLToPath(new URL('./src', import.meta.url))

/**
 * 单份配置同时承载：
 * - 开发服务器（入口 `index.html` → `playground/`，仅本地演示，不参与构建）
 * - 库构建（`build.lib`，产出 ESM + UMD + 单一 CSS + d.ts）
 * - 单元测试（Vitest）
 */
export default defineConfig({
  plugins: [
    vue(),
    dts({
      tsconfigPath: './tsconfig.lib.json',
      entryRoot: 'src',
      include: ['src/**/*.ts', 'src/**/*.vue'],
      exclude: ['src/**/*.spec.ts'],
      outDirs: 'dist/types',
      copyDtsFiles: true,
      // 读取 tsconfig 的 baseUrl + paths，把 d.ts 中的 @/ 别名还原为相对路径，
      // 保证产物类型可被使用方直接解析
      pathsToAliases: true,
    }),
  ],
  resolve: {
    // 源码内部统一使用 `@/` 前缀，例如 `@/composables/useIiifSource`、`@/types/viewer`。
    alias: [{ find: /^@\//, replacement: `${srcDir}/` }],
  },
  server: {
    port: 5173,
    open: false,
  },
  build: {
    target: 'es2022',
    cssCodeSplit: false,
    sourcemap: false,
    lib: {
      entry: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
      name: 'IiifViewer',
      formats: ['es', 'umd'],
      fileName: (format) => (format === 'es' ? 'index.mjs' : 'index.umd.cjs'),
    },
    rollupOptions: {
      // vue 与 openseadragon 由使用方提供，不打入库产物
      external: ['vue', 'openseadragon'],
      output: {
        exports: 'named',
        globals: {
          vue: 'Vue',
          openseadragon: 'OpenSeadragon',
        },
        // 固定样式产物名，避免依赖 Vite 的默认命名规则
        assetFileNames: 'iiif-viewer.[ext]',
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['tests/setup.ts'],
    include: ['tests/unit/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/core/**', 'src/composables/**', 'src/locales/**'],
    },
  },
})
