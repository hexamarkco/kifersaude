import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, '../../..');
const contexts = path.resolve(directory, 'mocks.ts');
const reminders = path.resolve(directory, 'reminders-mock.ts');
const configService = path.resolve(directory, 'config-service-fixture.ts');
const formsService = path.resolve(directory, 'forms-service-fixture.ts');

export default defineConfig({
  root: directory,
  envDir: root,
  plugins: [
    {
      name: 'config-forms-shell-preview-fixtures',
      enforce: 'pre',
      resolveId(source) {
        const id = source.replace(/\\/g, '/');
        if (id.endsWith('/contexts/AuthContext') || id.endsWith('/contexts/ConfigContext')) return contexts;
        if (id.endsWith('/features/reminders')) return reminders;
        if (id.endsWith('/data/configService')) return configService;
        if (id.endsWith('/lib/formsService')) return formsService;
        return null;
      },
    },
    react(),
  ],
  optimizeDeps: { entries: ['main.tsx'] },
  server: { host: '127.0.0.1', port: 5183, strictPort: true, fs: { allow: [root] } },
});
