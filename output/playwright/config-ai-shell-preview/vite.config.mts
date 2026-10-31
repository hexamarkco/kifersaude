import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, '../../..');
const contexts = path.resolve(root, 'output/playwright/config-forms-shell-preview/mocks.ts');
const reminders = path.resolve(root, 'output/playwright/config-forms-shell-preview/reminders-mock.ts');
const aiConfigService = path.resolve(directory, 'ai-config-fixture.ts');

export default defineConfig({
  root: directory,
  envDir: root,
  plugins: [
    {
      name: 'config-ai-shell-preview-fixtures',
      enforce: 'pre',
      resolveId(source, importer) {
        const id = source.replace(/\\/g, '/');
        const fromAiConfig = importer?.replace(/\\/g, '/').includes('/features/config/ai/');
        if (id.endsWith('/contexts/AuthContext') || id.endsWith('/contexts/ConfigContext')) return contexts;
        if (id.endsWith('/features/reminders')) return reminders;
        if (fromAiConfig && id.endsWith('aiConfigService')) return aiConfigService;
        return null;
      },
    },
    react(),
  ],
  optimizeDeps: { entries: ['main.tsx'] },
  server: { host: '127.0.0.1', port: 5186, strictPort: true, fs: { allow: [root] } },
});
