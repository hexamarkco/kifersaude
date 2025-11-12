import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const tempDir = mkdtempSync(join(tmpdir(), 'kifersaude-tests-'));

try {
  const outfile = join(tempDir, 'startConversationUtils.test.mjs');

  await build({
    entryPoints: ['src/components/__tests__/startConversationUtils.test.ts'],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    sourcemap: 'inline',
    logLevel: 'silent',
  });

  const moduleUrl = pathToFileURL(outfile);
  await import(moduleUrl.href);
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
