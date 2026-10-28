import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const configDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(configDir, '../../..');
const mocks = path.resolve(configDir, 'mocks.ts');

export default defineConfig({
  root: repoRoot,
  plugins: [
    {
      name: 'users-preview-mocks',
      enforce: 'pre',
      resolveId(source) {
        if (source.includes('AuthContext')
          || source.includes('ConfigContext')
          || source.endsWith('usersRepository')
          || source.endsWith('/toast')) return mocks;
        return null;
      },
    },
    react(),
  ],
  server: { host: '127.0.0.1', port: 5178, strictPort: true },
});
