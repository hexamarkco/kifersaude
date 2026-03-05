import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

function getPackageName(id: string): string | null {
  const normalizedId = id.replace(/\\/g, '/');
  const nodeModulesPath = normalizedId.split('/node_modules/')[1];

  if (!nodeModulesPath) {
    return null;
  }

  const parts = nodeModulesPath.split('/');
  if (parts[0].startsWith('@') && parts.length > 1) {
    return `${parts[0]}/${parts[1]}`;
  }

  return parts[0];
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const pkg = getPackageName(id);

          if (!pkg) {
            return undefined;
          }

          if (pkg === 'react' || pkg === 'react-dom' || pkg === 'react-router-dom' || pkg === 'react-helmet') {
            return 'vendor';
          }

          if (pkg === 'lucide-react') {
            return 'icons';
          }

          if (pkg === '@supabase/supabase-js') {
            return 'supabase';
          }

          if (pkg === 'react-quill' || pkg === 'quill') {
            return 'vendor';
          }

          if (pkg === 'reactflow' || pkg.startsWith('d3-')) {
            return 'flow';
          }

          if (pkg === 'jspdf' || pkg === 'html-to-image') {
            return 'export';
          }

          if (pkg === 'gsap') {
            return 'animation';
          }

          if (pkg === 'dompurify' || pkg === 'date-fns') {
            return 'utils';
          }

          return 'vendor';
        },
      },
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  resolve: {
    alias: {
      '@testing-library/react': path.resolve(__dirname, 'src/testing-library/react.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    globals: true,
  },
});
