import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import type { Connect } from 'vite'
import { chatProxy, loadEnv } from './server/deepseek.ts'

loadEnv()

const attachApi = (middlewares: Connect.Server) => {
  middlewares.use('/api/chat', (req, res) => {
    void chatProxy(req, res)
  })
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'local-ai-proxy',
      configureServer(server) {
        attachApi(server.middlewares)
      },
      configurePreviewServer(server) {
        attachApi(server.middlewares)
      },
    },
  ],
})
