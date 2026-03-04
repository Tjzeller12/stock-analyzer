import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
export default defineConfig({
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  plugins: [tailwindcss(), react()],
  server: {
    host: true, // Crucial for Docker
    port: 5173,
    strictPort: true,
  },
});