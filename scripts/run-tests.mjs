import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const tempDir = mkdtempSync(join(process.cwd(), '.tmp-tests-'));

try {
  const tests = [
    {
      entry: 'src/components/__tests__/ChatMetricsBadges.test.tsx',
      outfile: 'chat-metrics-badges.test.cjs',
    },
    {
      entry: 'src/pages/__tests__/WhatsappQuickReplies.test.tsx',
      outfile: 'whatsapp-quick-replies.test.cjs',
    },
  ];

  for (const { entry, outfile } of tests) {
    const compiledFile = join(tempDir, outfile);

    await build({
      entryPoints: [entry],
      outfile: compiledFile,
      bundle: true,
      platform: 'node',
      format: 'cjs',
      sourcemap: 'inline',
      logLevel: 'silent',
      external: ['npm:@supabase/supabase-js@2.57.4', 'jsdom'],
      jsx: 'automatic',
    });

    const moduleUrl = pathToFileURL(compiledFile);
    await import(moduleUrl.href);
  }
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
