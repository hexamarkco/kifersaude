import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, '../../..');
const contexts = path.resolve(root, 'output/playwright/config-forms-shell-preview/mocks.ts');
const reminders = path.resolve(root, 'output/playwright/config-forms-shell-preview/reminders-mock.ts');
const configService = path.resolve(directory, 'automation-service-fixture.ts');
const automationApi = path.resolve(directory, 'automation-api-fixture.ts');

export default defineConfig({
  root: directory,
  envDir: root,
  plugins: [
    {
      name: 'automation-shell-preview-fixtures',
      enforce: 'pre',
      resolveId(source) {
        const id = source.replace(/\\/g, '/');
        if (id.endsWith('/contexts/AuthContext') || id.endsWith('/contexts/ConfigContext')) return contexts;
        if (id.endsWith('/features/reminders')) return reminders;
        if (id.endsWith('/data/configService')) return configService;
        if (id.endsWith('/data/automationApi')) return automationApi;
        return null;
      },
    },
    react(),
  ],
  optimizeDeps: { entries: ['main.tsx'] },
  server: { host: '127.0.0.1', port: 5184, strictPort: true, fs: { allow: [root] } },
});
