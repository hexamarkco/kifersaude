import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, '../../..');

export default defineConfig({
  root: directory,
  envDir: root,
  plugins: [react()],
  optimizeDeps: { entries: ['main.tsx'] },
  server: { host: '127.0.0.1', port: 5185, strictPort: true, fs: { allow: [root] } },
});
