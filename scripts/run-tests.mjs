import { build } from 'esbuild';
import Module from 'node:module';
import { mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, delimiter } from 'node:path';
import { pathToFileURL } from 'node:url';

const tempDir = mkdtempSync(join(tmpdir(), 'kifersaude-tests-'));

try {
  symlinkSync(join(process.cwd(), 'node_modules'), join(tempDir, 'node_modules'), 'dir');
} catch {
  // Ignore if symlink cannot be created
}

const existingNodePath = process.env.NODE_PATH ? process.env.NODE_PATH.split(delimiter) : [];
const projectNodeModules = join(process.cwd(), 'node_modules');
if (!existingNodePath.includes(projectNodeModules)) {
  existingNodePath.push(projectNodeModules);
}
process.env.NODE_PATH = existingNodePath.join(delimiter);
Module._initPaths();

try {
  const tests = [
    {
      entry: 'src/server/__tests__/whatsappScheduler.test.ts',
      outfile: 'whatsappScheduler.test.js',
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
      external: ['@supabase/supabase-js'],
    });

    const moduleUrl = pathToFileURL(compiledFile);
    await import(moduleUrl.href);
  }
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
