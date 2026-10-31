import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, '../../..');
const mocks = path.resolve(directory, 'mocks.ts');

export default defineConfig({
  root,
  plugins: [
    {
      name: 'contract-detail-preview-mocks',
      enforce: 'pre',
      resolveId(source, importer) {
        const file = importer?.replaceAll('\\', '/') ?? '';
        if (source.endsWith('/contexts/AuthContext') || source.endsWith('/contexts/ConfigContext')) return mocks;
        if (source === '../features/contracts' && file.endsWith('/src/components/ContractDetails.tsx')) return mocks;
        return null;
      },
    },
    react(),
  ],
  server: { host: '127.0.0.1', port: 5179, strictPort: true },
});
