import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, '..');
const outputPath = resolve(
  repositoryRoot,
  'src/infrastructure/supabase/database.generated.ts',
);
const checkOnly = process.argv.includes('--check');
const executable = process.platform === 'win32' ? 'supabase.exe' : 'supabase';

const result = spawnSync(
  executable,
  ['gen', 'types', '--linked', '--schema', 'public'],
  {
    cwd: repositoryRoot,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  },
);

if (result.status !== 0) {
  process.stderr.write(
    result.stderr
      || result.error?.message
      || 'Falha ao gerar tipos do Supabase.\n',
  );
  process.exit(result.status ?? 1);
}

const generated = result.stdout.replace(/\r\n/g, '\n').trimEnd() + '\n';

if (checkOnly) {
  let current = '';
  try {
    current = readFileSync(outputPath, 'utf8').replace(/\r\n/g, '\n');
  } catch {
    process.stderr.write('Tipos Supabase ainda não foram gerados.\n');
    process.exit(1);
  }

  if (current !== generated) {
    process.stderr.write(
      'Os tipos Supabase estão desatualizados. Execute npm run types:supabase.\n',
    );
    process.exit(1);
  }

  process.stdout.write('Tipos Supabase sincronizados com o projeto vinculado.\n');
  process.exit(0);
}

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, generated, 'utf8');
process.stdout.write(`Tipos Supabase atualizados em ${outputPath}.\n`);
