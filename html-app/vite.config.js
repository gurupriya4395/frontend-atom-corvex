import { defineConfig } from 'vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  root: dir,
  server: {
    host: '0.0.0.0',
    port: 5174,
    allowedHosts: true,
  },
  preview: {
    host: true,
    port: 4174,
    allowedHosts: true,
  },
})
