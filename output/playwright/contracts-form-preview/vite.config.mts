import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, '../../..');
const mocks = path.resolve(directory, 'mocks.ts');

export default defineConfig({
  root,
  plugins: [
    {
      name: 'contracts-form-preview-mocks',
      enforce: 'pre',
      resolveId(source, importer?: string) {
        const isContractForm = importer?.replaceAll('\\', '/').endsWith('/src/components/ContractForm.tsx');
        if (!isContractForm) return null;
        if ([
          '../contexts/ConfigContext',
          '../features/contracts',
          '../features/config',
          '../features/production',
        ].includes(source)) return mocks;
        return null;
      },
    },
    react(),
  ],
  server: { host: '127.0.0.1', port: 5181, strictPort: true },
});
