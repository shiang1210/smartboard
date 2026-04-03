import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  // 針對 GitHub Pages 專案網站，設定為儲存庫名稱
  base: '/smartboard/'
});