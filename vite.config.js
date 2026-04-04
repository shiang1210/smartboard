import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  plugins: [
    react(),
    viteSingleFile()
  ],
  base: './', // 新增此行
  build: {
    target: 'esnext',
    cssCodeSplit: false,
    codeSplitting: false
  }
});