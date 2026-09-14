import js from '@eslint/js'
import vue from 'eslint-plugin-vue'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: ['node_modules/**', 'out/**', 'release/**', 'coverage/**', 'artifacts/**']
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...vue.configs['flat/recommended'],
  {
    files: [
      'src/main/**/*.ts',
      'src/preload/**/*.ts',
      'scripts/**/*.mjs',
      'tests/**/*.{ts,mjs}',
      'electron.vite.config.ts'
    ],
    languageOptions: {
      globals: globals.node
    }
  },
  {
    files: ['src/renderer/**/*.{ts,vue}'],
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        parser: tseslint.parser
      }
    },
    rules: {
      'vue/no-v-html': 'error',
      'no-restricted-globals': [
        'error',
        { name: 'process', message: 'renderer 必须通过受限 preload API 获取平台信息。' },
        { name: 'localStorage', message: 'renderer 持久化必须通过受限 preload 业务接口。' },
        { name: 'sessionStorage', message: 'renderer 持久化必须通过受限 preload 业务接口。' }
      ],
      'no-restricted-properties': [
        'error',
        { object: 'window', property: 'localStorage', message: 'renderer 持久化必须通过受限 preload 业务接口。' },
        { object: 'window', property: 'sessionStorage', message: 'renderer 持久化必须通过受限 preload 业务接口。' },
        { object: 'globalThis', property: 'localStorage', message: 'renderer 持久化必须通过受限 preload 业务接口。' },
        { object: 'globalThis', property: 'sessionStorage', message: 'renderer 持久化必须通过受限 preload 业务接口。' }
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['electron', 'node:*'], message: 'renderer 不得直接导入 Electron 或 Node.js。' }
          ]
        }
      ],
      'vue/html-self-closing': 'off',
      'vue/max-attributes-per-line': 'off',
      'vue/multi-word-component-names': 'off',
      'vue/singleline-html-element-content-newline': 'off'
    }
  }
)
