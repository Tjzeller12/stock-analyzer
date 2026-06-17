import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Dev-only config. Vitest lives in vitest.config.ts so `npm start` does not
// require devDependencies like vitest to be installed.
export default defineConfig({
  plugins: [tailwindcss(), react()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
  },
  optimizeDeps: {
    // ag-grid, recharts, etc. are huge; pre-bundle them so the first dev start
    // does not sit silent for ~2 minutes while Vite crawls node_modules.
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'axios',
      'ag-grid-community',
      'ag-grid-react',
      'recharts',
      'lightweight-charts',
      'mathjs',
      '@uiw/react-codemirror',
      '@codemirror/lang-javascript',
    ],
  },
});
