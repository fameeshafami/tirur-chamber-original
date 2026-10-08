import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const api = { '/api': { target: 'http://localhost:5000', changeOrigin: true } };

export default defineConfig({
  plugins: [react()],
  server: { host: true, port: 3004, strictPort: false, proxy: api },
  preview: { host: true, port: 3004, strictPort: false, proxy: api },
});
