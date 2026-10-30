import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, '../../..');
const mock = path.resolve(dir, 'mocks.ts');

export default defineConfig({
  root,
  plugins: [{
    name: 'contracts-preview-mocks',
    enforce: 'pre',
    resolveId(source, importer) {
      const normalizedImporter = importer?.replaceAll('\\', '/') ?? '';
      const fromManager = normalizedImporter.endsWith('/features/contracts/ContractsManagerScreen.tsx');
      const fromDetails = normalizedImporter.endsWith('/components/ContractDetails.tsx');
      const fromContractsApi = normalizedImporter.endsWith('/features/contracts/index.ts');

      if ((fromManager || fromDetails) && (source.includes('AuthContext') || source.includes('ConfigContext'))) {
        return mock;
      }
      if (fromManager && (source.endsWith('contractsRepository') || source === '../production' || source.endsWith('useContractStatus'))) {
        return mock;
      }
      if (fromContractsApi && (source === './data/contractsRepository' || source === './data/contractDetailsRepository')) {
        return mock;
      }
      return null;
    },
  }, react()],
  server: { host: '127.0.0.1', port: 5178, strictPort: true },
});
