import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve('src/renderer/src')
    }
  },
  test: {
    environment: 'happy-dom',
    include: ['tests/unit/**/*.test.{ts,mjs}'],
    restoreMocks: true
  }
})
