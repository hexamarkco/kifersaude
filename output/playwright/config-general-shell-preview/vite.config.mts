import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, '../../..');
const fixtures = path.resolve(root, 'output/playwright/config-forms-shell-preview');
const contexts = path.resolve(fixtures, 'mocks.ts');
const reminders = path.resolve(fixtures, 'reminders-mock.ts');
const configService = path.resolve(fixtures, 'config-service-fixture.ts');

export default defineConfig({
  root: directory,
  envDir: root,
  plugins: [{
    name: 'config-general-shell-preview-fixtures',
    enforce: 'pre',
    resolveId(source) {
      const id = source.replace(/\\/g, '/');
      if (id.endsWith('/contexts/AuthContext') || id.endsWith('/contexts/ConfigContext')) return contexts;
      if (id.endsWith('/features/reminders')) return reminders;
      if (id.endsWith('/data/configService')) return configService;
      return null;
    },
  }, react()],
  optimizeDeps: { entries: ['main.tsx'] },
  server: { host: '127.0.0.1', port: 5187, strictPort: true, fs: { allow: [root] } },
});
