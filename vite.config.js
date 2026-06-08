import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/yii2-api': {
        target: 'http://localhost',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/yii2-api/, '/orderart/orderart-yii2/api/web'),
      },
    },
  },
})
