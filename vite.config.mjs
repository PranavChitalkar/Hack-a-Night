import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react()],
  root: 'src',
  build: {
    outDir: '../public',
    emptyOutDir: false,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'src/index.html')
      }
    }
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/uploads': 'http://localhost:3000'
    }
  }
});
