import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const previewDirectory = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = resolve(previewDirectory, '../../..');

export default defineConfig({
  root: projectRoot,
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: '../../../../contexts/ConfigContext',
        replacement: resolve(previewDirectory, 'mockConfig.tsx'),
      },
    ],
  },
  server: {
    host: '127.0.0.1',
    port: 0,
  },
});
