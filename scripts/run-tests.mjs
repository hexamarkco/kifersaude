import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const tempDir = mkdtempSync(join(tmpdir(), 'kifersaude-tests-'));

try {
  const tests = [
    {
      entry: 'src/components/__tests__/startConversationUtils.test.ts',
      outfile: 'startConversationUtils.test.mjs',
    },
    {
      entry: 'supabase/functions/whatsapp-webhook/__tests__/normalization.test.ts',
      outfile: 'whatsappWebhookNormalization.test.mjs',
    },
    {
      entry: 'supabase/functions/whatsapp-webhook/__tests__/peers.test.ts',
      outfile: 'whatsappWebhookPeers.test.mjs',
    },
  ];

  for (const { entry, outfile } of tests) {
    const compiledFile = join(tempDir, outfile);

    await build({
      entryPoints: [entry],
      outfile: compiledFile,
      bundle: true,
      platform: 'node',
      format: 'esm',
      sourcemap: 'inline',
      logLevel: 'silent',
      external: ['npm:@supabase/supabase-js@2.57.4'],
    });

    const moduleUrl = pathToFileURL(compiledFile);
    await import(moduleUrl.href);
  }
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
