import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Default to the Java Spring Boot backend on :8080. Override with
  // VITE_DEV_PROXY_TARGET if the backend is running on a different host/port.
  const proxyTarget = env.VITE_DEV_PROXY_TARGET || 'http://localhost:8080'

  return {
    plugins: [
      react(),
      tailwindcss()
    ],
    assetsInclude: ['**/*.glb'],
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
          secure: false
        }
      }
    }
  }
})