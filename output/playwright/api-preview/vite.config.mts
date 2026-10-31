import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, '../../..');
const mocks = path.resolve(directory, 'mocks.ts');
export default defineConfig({
  root: directory, envDir: root,
  plugins: [{ name: 'api-preview-auth-mock', enforce: 'pre', resolveId(source) { if (source.endsWith('/contexts/AuthContext') || source.endsWith('/contexts/ConfigContext')) return mocks; return null; } }, react()],
  optimizeDeps: { entries: ['main.tsx'] },
  server: { host: '127.0.0.1', port: 5182, strictPort: true, fs: { allow: [root] } },
});
