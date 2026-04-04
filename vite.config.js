import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // 強制指定 GitHub Pages 專案子目錄，解決資源 404 找不到的問題
  base: '/smartboard/', 
  build: {
    outDir: 'dist',
  }
})