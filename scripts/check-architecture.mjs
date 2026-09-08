import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';

const repositoryRoot = resolve(import.meta.dirname, '..');
const sourceRoot = join(repositoryRoot, 'src');
const featuresRoot = join(sourceRoot, 'features');
const sourceExtensions = new Set(['.ts', '.tsx']);
const importPattern = /\bfrom\s+['"]([^'"]+)['"]/g;

const walk = (directory) =>
  readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });

const files = walk(sourceRoot).filter((file) => sourceExtensions.has(extname(file)));
const violations = [];
const displayPath = (path) => relative(repositoryRoot, path).split(sep).join('/');

const findFeatureRoot = (path) => {
  const featureRelative = relative(featuresRoot, path).split(sep);
  if (!featureRelative[0]) return null;

  const topLevelRoot = join(featuresRoot, featureRelative[0]);
  if (existsSync(join(topLevelRoot, 'index.ts'))) return topLevelRoot;

  if (featureRelative[1]) {
    const nestedRoot = join(topLevelRoot, featureRelative[1]);
    if (existsSync(join(nestedRoot, 'index.ts'))) return nestedRoot;
  }

  return topLevelRoot;
};

for (const file of files) {
  const content = readFileSync(file, 'utf8');

  if (extname(file) === '.tsx') {
    if (/\b(?:supabase|databaseClient)\s*\./.test(content)) {
      violations.push(`${displayPath(file)}: cliente Supabase usado diretamente em TSX`);
    }
    if (/\bfrom\s+['"][^'"]*lib\/supabase['"]/.test(content)) {
      violations.push(`${displayPath(file)}: TSX depende do entrypoint legado lib/supabase`);
    }
  }

  if (!file.startsWith(featuresRoot)) continue;
  const sourceFeatureRoot = findFeatureRoot(dirname(file));
  if (!sourceFeatureRoot) continue;

  for (const match of content.matchAll(importPattern)) {
    const specifier = match[1];
    if (!specifier.startsWith('.')) continue;

    const target = resolve(dirname(file), specifier);
    if (!target.startsWith(featuresRoot)) continue;

    const targetFeatureRoot = findFeatureRoot(target);
    if (!targetFeatureRoot || targetFeatureRoot === sourceFeatureRoot) continue;

    if (target !== targetFeatureRoot) {
      violations.push(
        `${displayPath(file)}: deep import entre features (${specifier}); use ${displayPath(targetFeatureRoot)}`,
      );
    }
  }
}

if (violations.length > 0) {
  console.error('Architecture check failed:\n');
  violations.forEach((violation) => console.error(`- ${violation}`));
  process.exitCode = 1;
} else {
  console.log('Architecture check passed.');
}
