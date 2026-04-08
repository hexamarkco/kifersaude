import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const migrationsDir = path.join(repoRoot, 'supabase', 'migrations');
const outputPath = path.join(migrationsDir, 'INDEX.md');
const defaultBaselinePath = path.join(migrationsDir, 'AUDIT_BASELINE.json');

const shouldWrite = process.argv.includes('--write');
const outputJson = process.argv.includes('--json');
const shouldWriteBaseline = process.argv.includes('--write-baseline');
const shouldCheckBaseline = process.argv.includes('--check-baseline');

const baselineArgIndex = process.argv.indexOf('--baseline');
const baselinePath =
  baselineArgIndex >= 0 && typeof process.argv[baselineArgIndex + 1] === 'string'
    ? path.resolve(repoRoot, process.argv[baselineArgIndex + 1])
    : defaultBaselinePath;

const toSortedUnique = (values) => [...new Set(values)].sort((a, b) => a.localeCompare(b));

const parseMigrationName = (fileName) => {
  const match = fileName.match(/^(\d{14})_(.+)\.sql$/i);
  if (!match) return null;

  const version = match[1];
  const suffix = match[2];
  const wrappedMatch = suffix.match(/^(\d{14})_(.+)$/i);
  const legacyVersion = wrappedMatch ? wrappedMatch[1] : null;
  const slug = wrappedMatch ? wrappedMatch[2] : suffix;

  return {
    version,
    slug,
    suffix,
    isWrapped: Boolean(legacyVersion),
    legacyVersion,
    legacyKey: legacyVersion ? `${legacyVersion}_${slug}` : null,
  };
};

const toMonthKey = (version) => `${version.slice(0, 4)}-${version.slice(4, 6)}`;

const buildMarkdown = (report) => {
  const lines = [];
  lines.push('# Migrations Index');
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Total SQL files: ${report.totalFiles}`);
  lines.push(`- Valid migration filenames: ${report.parsedFiles}`);
  lines.push(`- Invalid SQL filenames: ${report.invalidFiles.length}`);
  lines.push(`- Legacy wrapped files (format \`<new>_<old>_name.sql\`): ${report.wrappedFiles}`);
  lines.push(`- Duplicate slug groups: ${report.duplicateSlugGroups.length}`);
  lines.push(`- Exact content duplicate groups: ${report.exactContentDuplicateGroups.length}`);
  lines.push('');

  lines.push('## Invalid Filenames');
  lines.push('');
  if (report.invalidFiles.length === 0) {
    lines.push('- None');
  } else {
    for (const file of report.invalidFiles) {
      lines.push(`- \`${file}\``);
    }
  }
  lines.push('');

  lines.push('## By Month');
  lines.push('');
  lines.push('| Month | Files |');
  lines.push('| --- | ---: |');
  for (const item of report.byMonth) {
    lines.push(`| ${item.month} | ${item.count} |`);
  }
  lines.push('');

  lines.push('## Duplicate Slugs');
  lines.push('');
  if (report.duplicateSlugGroups.length === 0) {
    lines.push('- None');
  } else {
    for (const group of report.duplicateSlugGroups) {
      lines.push(`- \`${group.slug}\` (${group.files.length} files)`);
      for (const file of group.files) {
        lines.push(`  - \`${file}\``);
      }
    }
  }
  lines.push('');

  lines.push('## Legacy Wrapped Files');
  lines.push('');
  if (report.wrappedGroups.length === 0) {
    lines.push('- None');
  } else {
    for (const group of report.wrappedGroups) {
      lines.push(`- \`${group.legacyKey}\``);
      for (const file of group.files) {
        lines.push(`  - \`${file}\``);
      }
    }
  }
  lines.push('');

  lines.push('## Exact Content Duplicates');
  lines.push('');
  if (report.exactContentDuplicateGroups.length === 0) {
    lines.push('- None');
  } else {
    for (const group of report.exactContentDuplicateGroups) {
      lines.push(`- hash \`${group.hash}\` (${group.files.length} files)`);
      for (const file of group.files) {
        lines.push(`  - \`${file}\``);
      }
    }
  }
  lines.push('');

  lines.push('## Notes');
  lines.push('');
  lines.push('- Keep existing migration versions immutable once applied.');
  lines.push('- Prefer creating new corrective migrations over editing old files.');
  lines.push('- Use this report before any cleanup proposal.');
  lines.push('');

  return `${lines.join('\n')}\n`;
};

const toBaseline = (report) => ({
  generatedAt: new Date().toISOString(),
  totalFiles: report.totalFiles,
  wrappedFiles: report.wrappedFiles,
  duplicateSlugs: toSortedUnique(report.duplicateSlugGroups.map((group) => group.slug)),
  wrappedKeys: toSortedUnique(report.wrappedGroups.map((group) => group.legacyKey)),
  exactDuplicateHashes: toSortedUnique(
    report.exactContentDuplicateGroups.map((group) => group.hash),
  ),
  invalidFiles: toSortedUnique(report.invalidFiles),
});

const validateBaselineShape = (baseline) =>
  Boolean(
    baseline &&
      typeof baseline === 'object' &&
      Array.isArray(baseline.duplicateSlugs) &&
      Array.isArray(baseline.wrappedKeys) &&
      Array.isArray(baseline.exactDuplicateHashes) &&
      typeof baseline.wrappedFiles === 'number',
  );

const compareWithBaseline = (report, baseline) => {
  const violations = [];

  if (report.invalidFiles.length > 0) {
    violations.push(
      `Found invalid migration filenames: ${report.invalidFiles
        .map((name) => `\`${name}\``)
        .join(', ')}`,
    );
  }

  if (report.wrappedFiles > baseline.wrappedFiles) {
    violations.push(
      `Wrapped file count increased from ${baseline.wrappedFiles} to ${report.wrappedFiles}`,
    );
  }

  const currentWrappedKeys = new Set(report.wrappedGroups.map((group) => group.legacyKey));
  const baselineWrappedKeys = new Set(
    baseline.wrappedKeys.filter((value) => typeof value === 'string'),
  );
  const newWrappedKeys = [...currentWrappedKeys]
    .filter((key) => !baselineWrappedKeys.has(key))
    .sort((a, b) => a.localeCompare(b));
  if (newWrappedKeys.length > 0) {
    violations.push(
      `New wrapped migration groups detected: ${newWrappedKeys
        .map((key) => `\`${key}\``)
        .join(', ')}`,
    );
  }

  const currentDuplicateSlugs = new Set(report.duplicateSlugGroups.map((group) => group.slug));
  const baselineDuplicateSlugs = new Set(
    baseline.duplicateSlugs.filter((value) => typeof value === 'string'),
  );
  const newDuplicateSlugs = [...currentDuplicateSlugs]
    .filter((slug) => !baselineDuplicateSlugs.has(slug))
    .sort((a, b) => a.localeCompare(b));
  if (newDuplicateSlugs.length > 0) {
    violations.push(
      `New duplicate slug groups detected: ${newDuplicateSlugs
        .map((slug) => `\`${slug}\``)
        .join(', ')}`,
    );
  }

  const currentDuplicateHashes = new Set(
    report.exactContentDuplicateGroups.map((group) => group.hash),
  );
  const baselineDuplicateHashes = new Set(
    baseline.exactDuplicateHashes.filter((value) => typeof value === 'string'),
  );
  const newDuplicateHashes = [...currentDuplicateHashes]
    .filter((hash) => !baselineDuplicateHashes.has(hash))
    .sort((a, b) => a.localeCompare(b));
  if (newDuplicateHashes.length > 0) {
    violations.push(
      `New exact content duplicate groups detected (hashes): ${newDuplicateHashes
        .map((hash) => `\`${hash}\``)
        .join(', ')}`,
    );
  }

  return violations;
};

const run = async () => {
  const entries = await fs.readdir(migrationsDir, { withFileTypes: true });
  const sqlFiles = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.sql'))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  const parsedRows = [];
  const invalidFiles = [];

  for (const fileName of sqlFiles) {
    const parsed = parseMigrationName(fileName);
    if (!parsed) {
      invalidFiles.push(fileName);
      continue;
    }

    const filePath = path.join(migrationsDir, fileName);
    const raw = await fs.readFile(filePath, 'utf8');
    const hash = createHash('sha1').update(raw).digest('hex').slice(0, 12);
    parsedRows.push({ fileName, parsed, hash });
  }

  const byMonthMap = new Map();
  const bySlugMap = new Map();
  const wrappedMap = new Map();
  const byHashMap = new Map();

  for (const row of parsedRows) {
    const { fileName, parsed, hash } = row;
    const month = toMonthKey(parsed.version);
    byMonthMap.set(month, (byMonthMap.get(month) ?? 0) + 1);

    const slugFiles = bySlugMap.get(parsed.slug) ?? [];
    slugFiles.push(fileName);
    bySlugMap.set(parsed.slug, slugFiles);

    if (parsed.isWrapped && parsed.legacyKey) {
      const wrappedFiles = wrappedMap.get(parsed.legacyKey) ?? [];
      wrappedFiles.push(fileName);
      wrappedMap.set(parsed.legacyKey, wrappedFiles);
    }

    const hashFiles = byHashMap.get(hash) ?? [];
    hashFiles.push(fileName);
    byHashMap.set(hash, hashFiles);
  }

  const byMonth = Array.from(byMonthMap.entries())
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => a.month.localeCompare(b.month));

  const duplicateSlugGroups = Array.from(bySlugMap.entries())
    .filter(([, files]) => files.length > 1)
    .map(([slug, files]) => ({ slug, files: [...files].sort((a, b) => a.localeCompare(b)) }))
    .sort((a, b) => b.files.length - a.files.length || a.slug.localeCompare(b.slug));

  const wrappedGroups = Array.from(wrappedMap.entries())
    .map(([legacyKey, files]) => ({ legacyKey, files: [...files].sort((a, b) => a.localeCompare(b)) }))
    .sort((a, b) => b.files.length - a.files.length || a.legacyKey.localeCompare(b.legacyKey));

  const exactContentDuplicateGroups = Array.from(byHashMap.entries())
    .filter(([, files]) => files.length > 1)
    .map(([hash, files]) => ({ hash, files: [...files].sort((a, b) => a.localeCompare(b)) }))
    .sort((a, b) => b.files.length - a.files.length || a.hash.localeCompare(b.hash));

  const report = {
    generatedAt: new Date().toISOString(),
    totalFiles: sqlFiles.length,
    parsedFiles: parsedRows.length,
    invalidFiles: invalidFiles.sort((a, b) => a.localeCompare(b)),
    wrappedFiles: parsedRows.filter((row) => row.parsed.isWrapped).length,
    byMonth,
    duplicateSlugGroups,
    wrappedGroups,
    exactContentDuplicateGroups,
  };

  if (shouldWriteBaseline) {
    const baseline = toBaseline(report);
    await fs.writeFile(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`, 'utf8');
    process.stdout.write(
      `Migration baseline written to ${path.relative(repoRoot, baselinePath)}\n`,
    );
    return;
  }

  if (shouldCheckBaseline) {
    let baseline;

    try {
      const rawBaseline = await fs.readFile(baselinePath, 'utf8');
      baseline = JSON.parse(rawBaseline);
    } catch {
      process.stderr.write(
        `[audit-migrations] Baseline not found at ${path.relative(
          repoRoot,
          baselinePath,
        )}. Run with --write-baseline first.\n`,
      );
      process.exitCode = 1;
      return;
    }

    if (!validateBaselineShape(baseline)) {
      process.stderr.write(
        `[audit-migrations] Invalid baseline format at ${path.relative(
          repoRoot,
          baselinePath,
        )}. Regenerate with --write-baseline.\n`,
      );
      process.exitCode = 1;
      return;
    }

    const violations = compareWithBaseline(report, baseline);
    if (violations.length > 0) {
      process.stderr.write('[audit-migrations] Baseline check failed:\n');
      for (const violation of violations) {
        process.stderr.write(`- ${violation}\n`);
      }
      process.exitCode = 1;
      return;
    }

    process.stdout.write(
      `Migration baseline check passed (${path.relative(repoRoot, baselinePath)}).\n`,
    );
    return;
  }

  if (outputJson) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }

  const markdown = buildMarkdown(report);

  if (shouldWrite) {
    await fs.writeFile(outputPath, markdown, 'utf8');
    process.stdout.write(`Migration report written to ${path.relative(repoRoot, outputPath)}\n`);
    return;
  }

  process.stdout.write(markdown);
};

run().catch((error) => {
  process.stderr.write(`[audit-migrations] ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
