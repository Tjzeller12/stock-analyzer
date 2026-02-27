import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Crucial for Docker
    port: 5173,
    strictPort: true,
  },
});