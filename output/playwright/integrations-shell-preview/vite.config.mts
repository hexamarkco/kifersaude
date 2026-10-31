import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, '../../..');
const contexts = path.resolve(root, 'output/playwright/config-forms-shell-preview/mocks.ts');
const reminders = path.resolve(root, 'output/playwright/config-forms-shell-preview/reminders-mock.ts');
const configService = path.resolve(directory, 'integrations-service-fixture.ts');
const integrationsApi = path.resolve(directory, 'integrations-api-fixture.ts');
const metaAdsApi = path.resolve(directory, 'meta-ads-api-fixture.ts');

export default defineConfig({
  root: directory,
  envDir: root,
  plugins: [
    {
      name: 'integrations-shell-preview-fixtures',
      enforce: 'pre',
      resolveId(source, importer) {
        const id = source.replace(/\\/g, '/');
        const importingIntegration = importer?.replace(/\\/g, '/').includes('/features/config/integrations/');
        if (id.endsWith('/contexts/AuthContext') || id.endsWith('/contexts/ConfigContext')) return contexts;
        if (id.endsWith('/features/reminders')) return reminders;
        if (importingIntegration && id.endsWith('/data/configService')) return configService;
        if (importingIntegration && id.endsWith('/data/integrationsApi')) return integrationsApi;
        if (importingIntegration && id.endsWith('/data/metaAdsApi')) return metaAdsApi;
        return null;
      },
    },
    react(),
  ],
  optimizeDeps: { entries: ['main.tsx'] },
  server: { host: '127.0.0.1', port: 5185, strictPort: true, fs: { allow: [root] } },
});
