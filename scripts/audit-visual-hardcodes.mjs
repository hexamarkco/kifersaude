import { promises as fs } from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const targetRoot = path.join(projectRoot, 'src');
const fileExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.css']);

const patternDefinitions = [
  {
    label: 'tailwind-color-utility',
    regex: /\b(?:bg|text|border|ring|from|via|to|fill|stroke)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|black|white)(?:-\d{2,3})?\b/g,
  },
  {
    label: 'raw-hex-color',
    regex: /#[0-9a-fA-F]{3,8}\b/g,
  },
  {
    label: 'rgba-color',
    regex: /\brgba?\([^)]*\)/g,
  },
];

const collectFiles = async (dir) => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return collectFiles(entryPath);
      }

      return fileExtensions.has(path.extname(entry.name)) ? [entryPath] : [];
    }),
  );

  return files.flat();
};

const auditFile = async (filePath) => {
  const source = await fs.readFile(filePath, 'utf8');
  const matches = [];

  for (const definition of patternDefinitions) {
    const found = source.match(definition.regex) || [];
    for (const value of found) {
      matches.push({ type: definition.label, value });
    }
  }

  return matches;
};

const files = await collectFiles(targetRoot);
const results = [];

for (const filePath of files) {
  const matches = await auditFile(filePath);
  if (matches.length === 0) continue;

  const countsByType = matches.reduce((accumulator, match) => {
    accumulator[match.type] = (accumulator[match.type] || 0) + 1;
    return accumulator;
  }, {});

  results.push({
    filePath,
    total: matches.length,
    byType: countsByType,
  });
}

results.sort((left, right) => right.total - left.total || left.filePath.localeCompare(right.filePath));

const totalMatches = results.reduce((sum, item) => sum + item.total, 0);

console.log(`Visual hardcode audit: ${totalMatches} matches across ${results.length} files in src`);

if (results.length === 0) {
  process.exit(0);
}

console.log('');
console.log('Top offenders:');

for (const item of results.slice(0, 20)) {
  const relativePath = path.relative(projectRoot, item.filePath);
  const typeSummary = Object.entries(item.byType)
    .sort((left, right) => right[1] - left[1])
    .map(([type, count]) => `${type}:${count}`)
    .join(', ');

  console.log(`- ${relativePath} -> ${item.total} (${typeSummary})`);
}
