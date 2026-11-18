import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

// Offline only. The test suite injects both model stages and never initializes WhatsApp.
const outputDir = resolve('local-artifacts/autonomous-v2');
mkdirSync(outputDir, { recursive: true });
const styleChecks = spawnSync(process.execPath, ['--test', resolve('scripts/build-autonomous-style-library.test.mjs')], { stdio: 'inherit' });
if (styleChecks.error) throw styleChecks.error;
if (styleChecks.status !== 0) process.exit(styleChecks.status ?? 1);
const child = spawn(process.execPath, [resolve('node_modules/vitest/vitest.mjs'), 'run',
  'supabase/functions/_shared/__tests__/autonomous-v2.test.ts',
  'supabase/functions/_shared/__tests__/autonomous-v2-style.test.ts',
  'supabase/functions/_shared/__tests__/autonomous-v2-message-grouping.test.ts',
  'supabase/functions/_shared/__tests__/autonomous-v2-worker.test.ts',
  'supabase/functions/_shared/__tests__/autonomous-v2-pg.test.ts',
  'supabase/functions/_shared/__tests__/ai-sandbox-attendance.test.ts',
  'src/features/communication/whatsapp/components/__tests__/WhatsAppAttendanceBriefing.test.tsx',
  '--reporter=default', '--reporter=json', `--outputFile=${resolve(outputDir, 'tests.json')}`], {
  stdio: 'inherit', env: { ...process.env, AUTONOMOUS_V2_REPORT_PATH: resolve(outputDir, 'commercial-simulations.json') },
});
child.on('error', (error) => { console.error(error.message); process.exitCode = 1; });
child.on('exit', (code) => { process.exitCode = code ?? 1; });
