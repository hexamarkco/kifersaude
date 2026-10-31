import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, '../../..');
const mocks = path.resolve(dir, 'mocks.tsx');

export default defineConfig({
  root,
  plugins: [
    {
      name: 'inbox-thread-preview-mocks',
      enforce: 'pre',
      resolveId(source, importer) {
        const normalizedImporter = importer?.replaceAll('\\', '/') ?? '';
        if (normalizedImporter.endsWith('/WhatsAppMessageThread.tsx') && source === './WhatsAppInboxList') {
          return mocks;
        }
        return null;
      },
    },
    react(),
  ],
  server: { host: '127.0.0.1', port: 5185, strictPort: true },
});
