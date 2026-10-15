import { execFileSync } from 'node:child_process';
import { test } from 'vitest';

test('Postgres production attribution, deduplication and reporting regressions', () => {
  try {
    execFileSync(process.execPath, ['--test', 'scripts/test-production-database.mjs'], { encoding: 'utf8', stdio: 'pipe' });
  } catch (error) {
    const output = error as Error & { stdout?: string; stderr?: string };
    throw new Error(`${output.message}\n${output.stdout ?? ''}\n${output.stderr ?? ''}`);
  }
}, 60000);
