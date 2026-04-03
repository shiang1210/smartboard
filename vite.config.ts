import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // 必須對齊 GitHub 儲存庫名稱
  base: '/smartboard/',
  build: {
    // 確保 CSS 不會被拆分過細，利於載入
    cssCodeSplit: false,
    assetsDir: 'assets',
  }
});