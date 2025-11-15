import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const vitestBin = join(__dirname, '..', 'node_modules', 'vitest', 'vitest.mjs');

const cliArgs = process.argv.slice(2);
const child = spawn(process.execPath, [vitestBin, 'run', ...cliArgs], {
  stdio: 'inherit',
});

child.on('exit', code => {
  process.exit(code ?? 1);
});
