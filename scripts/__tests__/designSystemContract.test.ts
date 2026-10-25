import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'vitest';

test('design-system gate distinguishes UI primitives from content and rejects local vendor presentation', async () => {
  const prefix = path.join(tmpdir(), 'kifer-ds-contract-');
  const fixture = await mkdtemp(prefix);
  const source = path.join(fixture, 'src');
  await mkdir(source);
  const script = path.resolve('scripts/audit-design-system.mjs');
  const run = async (content: string) => {
    await writeFile(path.join(source, 'Screen.tsx'), content);
    return spawnSync(process.execPath, [script, '--root', source], { cwd: process.cwd(), encoding: 'utf8' });
  };
  try {
    const valid = await run('import { Button } from "./design-system"; export const text = "<button> is article content"; export const Screen = () => <section><Button>Salvar</Button></section>;');
    assert.equal(valid.status, 0, valid.stderr);
    const native = await run('export const Screen = () => <button onClick={() => undefined}>Salvar</button>;');
    assert.equal(native.status, 1);
    assert.match(native.stderr, /<button> must use/);
    const dynamic = await run('export const Screen = () => React.createElement("input", {});');
    assert.equal(dynamic.status, 1);
    assert.match(dynamic.stderr, /native visual elements/);
    const vendor = await run('import Canvas, { Background as Grid } from "reactflow"; import "./local.css"; export const Screen = () => <Canvas><Grid /></Canvas>;');
    assert.equal(vendor.status, 1);
    assert.match(vendor.stderr, /WorkflowCanvas/);
    assert.match(vendor.stderr, /styles must enter/);
    const engine = await run('import { Position, type Node } from "reactflow"; export const data = { side: Position.Left };');
    assert.equal(engine.status, 0, engine.stderr);
  } finally {
    assert.ok(path.resolve(fixture).startsWith(path.resolve(prefix)));
    await rm(fixture, { recursive: true, force: true });
  }
});
