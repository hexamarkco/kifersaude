import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, '../../..');
const fixtures = path.resolve(directory, 'fixtures.ts');
const service = path.resolve(directory, 'config-service.ts');
const userRepository = path.resolve(directory, 'users.ts');

export default defineConfig({
  root: directory,
  envDir: root,
  plugins: [{
    name: 'synthetic-access-config-preview-fixtures',
    enforce: 'pre',
    resolveId(source) {
      const id = source.replace(/\\/g, '/');
      if (id.endsWith('/contexts/AuthContext') || id.endsWith('/contexts/ConfigContext')) return fixtures;
      if (id.endsWith('/data/configService')) return service;
      if (id.endsWith('/users/data/usersRepository')) return userRepository;
      return null;
    },
  }, react()],
  optimizeDeps: { entries: ['main.tsx'] },
  server: { host: '127.0.0.1', port: 5188, strictPort: true, fs: { allow: [root] } },
});
