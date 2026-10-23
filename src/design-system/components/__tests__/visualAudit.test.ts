import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'vitest';

const auditScript = path.resolve('scripts/audit-visual-hardcodes.mjs');

test('visual audit accepts DS text in buttons and rejects custom icons and home typography', async () => {
  const fixturePrefix = path.join(tmpdir(), 'kifer-visual-audit-');
  const fixtureRoot = await mkdtemp(fixturePrefix);
  const fixtureDirectory = path.join(fixtureRoot, 'src', 'pages', 'public');
  await mkdir(fixtureDirectory, { recursive: true });

  const runAudit = async (source: string) => {
    await writeFile(path.join(fixtureDirectory, 'HomePage.tsx'), source);
    return spawnSync(process.execPath, [auditScript], { cwd: fixtureRoot, encoding: 'utf8' });
  };

  try {
    const canonical = await runAudit('<Heading level={1}>Título</Heading><Button><Text as="span" className="min-w-0 whitespace-normal">Pergunta</Text><Plus className="kds-control-icon" /></Button>');
    assert.equal(canonical.status, 0, canonical.stdout + canonical.stderr);

    const customIcon = await runAudit('<Button><Plus className="h-6 w-6" /></Button>');
    assert.equal(customIcon.status, 1);
    assert.ok(customIcon.stdout.includes('primitive-icon-override'));

    const customTypography = await runAudit('<h1 className="font-[var(--font-display)]">Título</h1>');
    assert.equal(customTypography.status, 1);
    assert.ok(customTypography.stdout.includes('public-home-noncanonical-typography'));
  } finally {
    assert.ok(fixtureRoot.startsWith(fixturePrefix));
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});
