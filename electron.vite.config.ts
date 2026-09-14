import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'electron-vite'

export default defineConfig({
  main: {
    build: {
      externalizeDeps: {
        exclude: ['zod']
      },
      rollupOptions: {
        input: resolve('src/main/index.ts')
      }
    }
  },
  preload: {
    build: {
      rollupOptions: {
        input: resolve('src/preload/index.ts'),
        output: {
          entryFileNames: '[name].cjs',
          format: 'cjs'
        }
      }
    }
  },
  renderer: {
    root: resolve('src/renderer'),
    resolve: {
      alias: {
        '@': resolve('src/renderer/src')
      }
    },
    build: {
      rollupOptions: {
        input: resolve('src/renderer/index.html')
      }
    },
    plugins: [vue(), tailwindcss()]
  }
})
