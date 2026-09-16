import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'electron-vite'
import type { Plugin } from 'vite'

function rendererCspPlugin(): Plugin {
  return {
    name: 'sonavi-renderer-csp',
    transformIndexHtml: {
      order: 'pre',
      handler(html, context) {
        const connectSources = context.server
          ? "'self' ws://localhost:*"
          : "'self'"
        return html.replace('__SONAVI_CONNECT_SOURCES__', connectSources)
      }
    }
  }
}

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
    plugins: [rendererCspPlugin(), vue(), tailwindcss()]
  }
})
