import { defineConfig } from 'vite'
import path from 'path'
import { builtinModules } from 'module'

const nodeBuiltins = new Set([
  ...builtinModules,
  ...builtinModules.map((moduleName) => `node:${moduleName}`),
])

export default defineConfig({
  publicDir: false,
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    target: 'node20',
    outDir: 'agent-bridge/dist',
    emptyOutDir: true,
    lib: {
      entry: path.resolve(__dirname, './src/agent/bridge/cli.ts'),
      formats: ['es'],
      fileName: () => 'tasktime-agent-bridge.mjs',
    },
    rollupOptions: {
      external: (id) => nodeBuiltins.has(id),
      output: {
        banner: '#!/usr/bin/env node',
        inlineDynamicImports: true,
      },
    },
  },
})
