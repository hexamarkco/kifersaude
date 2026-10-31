import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, '../../..');
const contexts = path.resolve(directory, 'mocks.ts');
const reminders = path.resolve(directory, 'reminders-mock.ts');
const linksService = path.resolve(directory, 'links-service-fixture.ts');
const configService = path.resolve(directory, 'config-service-fixture.ts');

export default defineConfig({
  root: directory,
  envDir: root,
  plugins: [
    {
      name: 'config-links-shell-preview-fixtures',
      enforce: 'pre',
      resolveId(source) {
        const id = source.replace(/\\/g, '/');
        if (id.endsWith('/contexts/AuthContext') || id.endsWith('/contexts/ConfigContext')) return contexts;
        if (id.endsWith('/features/reminders')) return reminders;
        if (id.endsWith('/lib/linksService')) return linksService;
        if (id.endsWith('/data/configService')) return configService;
        return null;
      },
    },
    react(),
  ],
  optimizeDeps: { entries: ['main.tsx'] },
  server: { host: '127.0.0.1', port: 5182, strictPort: true, fs: { allow: [root] } },
});
