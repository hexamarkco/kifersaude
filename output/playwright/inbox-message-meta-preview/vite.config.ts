import { defineConfig, mergeConfig } from 'vite';
import appConfig from '../../../vite.config';
import { fileURLToPath } from 'node:url';

export default defineConfig(async (env) => {
  const base = await (typeof appConfig === 'function' ? appConfig(env) : appConfig);
  return mergeConfig(base, {
    root: fileURLToPath(new URL('.', import.meta.url)),
    build: { outDir: 'dist', emptyOutDir: false },
  });
});
