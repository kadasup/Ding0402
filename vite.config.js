import { defineConfig } from 'vite'
// Trigger Reload
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // 確保在 GitHub Pages 可以正確讀取路徑
})
