import { promises as fs } from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const targetRoot = path.join(projectRoot, 'src');
const fileExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.css']);
const includeDesignSystem = process.argv.includes('--include-design-system');

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

const canonicalControls = [
  'Button',
  'IconButton',
  'Input',
  'SearchInput',
  'Select',
  'Combobox',
  'DateTimePicker',
  'Textarea',
  'FilterTrigger',
  'FilterSelect',
  'FilterMultiSelect',
  'DateRangeFilter',
  'Tabs',
  'SegmentedControl',
  'Dialog',
  'Drawer',
  'Pagination',
];
const legacySizePattern = /\bsize=(['"])(?:icon|xs|default|compact|large)\1/;
const geometryTokenPattern = /^(?:(?:sm|md|lg|xl|2xl):)?!?(?:(?:min-|max-)?h-|(?:p|px|py|pl|pr|pt|pb)-|rounded(?:-|$)|text-(?:xs|sm|base|lg|xl|\[)|leading-(?:none|tight|snug|normal|relaxed|loose|\[)|gap-)/;
const iconGeometryTokenPattern = /^(?:(?:sm|md|lg|xl|2xl):)?!?(?:min-|max-)?[hw]-(?:\d|\[)/;
const legacyImportPattern = /from\s+['"][^'"]*(?:components\/Pagination|components\/Filter(?:SingleSelect|MultiSelect|DateRange)|components\/ui\/(?:Input|Textarea|DateTimePicker|ModalShell|ConfirmationModal)|WhatsAppDialog)['"]/g;

const findOpeningTagEnd = (source, start) => {
  let quote = null;
  let braces = 0;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (char === quote && source[index - 1] !== '\\') quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{') braces += 1;
    if (char === '}') braces = Math.max(0, braces - 1);
    if (char === '>' && braces === 0) return index;
  }
  return -1;
};

const auditCanonicalControls = (source) => {
  const matches = [];
  for (const component of canonicalControls) {
    let cursor = 0;
    while ((cursor = source.indexOf(`<${component}`, cursor)) >= 0) {
      const boundary = source[cursor + component.length + 1];
      if (boundary && /[\w$]/.test(boundary)) {
        cursor += component.length + 1;
        continue;
      }
      const end = findOpeningTagEnd(source, cursor + component.length + 1);
      if (end < 0) break;
      const opening = source.slice(cursor, end + 1);
      if (legacySizePattern.test(opening)) matches.push({ type: 'legacy-control-size', value: component });
      if (
        component === 'IconButton'
        && !/\baria-(?:label|labelledby)=/.test(opening)
      ) {
        matches.push({ type: 'unlabelled-icon-button', value: component });
      }
      for (const classMatch of opening.matchAll(/className=(['"])([^'"]*)\1/g)) {
        for (const token of classMatch[2].split(/\s+/)) {
          if (geometryTokenPattern.test(token) || (component === 'IconButton' && /^(?:(?:sm|md|lg|xl|2xl):)?!?(?:min-|max-)?w-/.test(token))) {
            matches.push({ type: 'primitive-geometry-override', value: `${component}:${token}` });
          }
        }
      }

      if ((component === 'Button' || component === 'IconButton') && !/\/\s*>$/.test(opening)) {
        const closeStart = source.indexOf(`</${component}>`, end + 1);
        if (closeStart >= 0) {
          const body = source.slice(end + 1, closeStart);
          const normalizedBody = body.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').trim();
          if (
            component === 'Button'
            && /^<[A-Z][A-Za-z0-9.]*(?:\s[^>]*)?\/\s*>$/.test(normalizedBody)
          ) {
            matches.push({ type: 'icon-only-button', value: component });
          }
          for (const iconMatch of body.matchAll(/<[A-Z][A-Za-z0-9]*(?:\s[^>]*)?className=(['"])([^'"]*)\1[^>]*\/?\s*>/g)) {
            for (const token of iconMatch[2].split(/\s+/)) {
              if (iconGeometryTokenPattern.test(token)) matches.push({ type: 'primitive-icon-override', value: `${component}:${token}` });
            }
          }
        }
      }
      cursor = end + 1;
    }
  }
  return matches;
};

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
  const isDesignSystemFile = path.relative(projectRoot, filePath).split(path.sep).includes('design-system');

  for (const value of source.match(/(?:linear|radial|conic)-gradient/gi) || []) {
    matches.push({ type: 'non-flat-gradient', value });
  }

  for (const value of source.match(/<(?:linear|radial|conic)Gradient\b/gi) || []) {
    matches.push({ type: 'non-flat-svg-gradient', value });
  }

  for (const value of source.match(/\bbg-gradient-to-[^\s"']+/g) || []) {
    matches.push({ type: 'non-flat-utility-gradient', value });
  }

  for (const value of source.match(/\bsize=(['"])(?:icon|default|compact|large)\1/g) || []) {
    matches.push({ type: 'legacy-size-alias', value });
  }

  if (!isDesignSystemFile) {
    for (const value of source.match(legacyImportPattern) || []) {
      matches.push({ type: 'legacy-primitive-import', value });
    }
  }

  matches.push(...auditCanonicalControls(source));

  for (const definition of isDesignSystemFile && !includeDesignSystem ? [] : patternDefinitions) {
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
  const relativePath = path.relative(projectRoot, filePath);
  const pathParts = relativePath.split(path.sep);

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

const scopeLabel = includeDesignSystem ? 'src' : 'src excluding design-system';

console.log(`Visual hardcode audit: ${totalMatches} matches across ${results.length} files in ${scopeLabel}`);

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

console.error('');
console.error('Visual audit failed. Use Design System tokens/primitives or document a narrowly scoped exception in this script.');
process.exit(1);
