import { promises as fs } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const sourceRoot = path.join(root, 'src');

async function collect(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return collect(target);
    return entry.name.endsWith('.tsx') ? [target] : [];
  }));
  return nested.flat();
}

function addNamedDesignSystemImport(source, names) {
  const missing = [...names].filter((name) => !new RegExp(`\\b${name}\\b`).test(source.match(/import\s*\{[^}]*\}\s*from\s*['"][^'"]*design-system['"]/s)?.[0] ?? ''));
  if (missing.length === 0) return source;
  return source.replace(/import\s*\{([^}]*)\}\s*from\s*(['"][^'"]*design-system['"])\s*;/s, (full, imports, modulePath) => {
    const normalized = imports.trimEnd();
    const separator = normalized.includes('\n') ? `\n  ${missing.join(',\n  ')},` : `, ${missing.join(', ')}`;
    return `import {${normalized}${separator}\n} from ${modulePath};`;
  });
}

function normalizeComponentSizes(source) {
  source = source
    .replace(/size=(['"])compact\1/g, 'size="sm"')
    .replace(/size=(['"])default\1/g, 'size="md"')
    .replace(/size=(['"])large\1/g, 'size="lg"')
    .replace(/size=(['"])xs\1/g, 'size="sm"')
    .replace(/(<Avatar\b[^>]*?)size="sm"/gs, '$1size="xs"');
  const supported = ['Button', 'Input', 'Select', 'DateTimePicker', 'Textarea', 'FilterTrigger', 'FilterSelect', 'FilterMultiSelect', 'Tabs'];
  for (const component of supported) {
    const opening = new RegExp(`<${component}\\b[^>]*>`, 'gs');
    source = source.replace(opening, (tag) => tag
      .replace(/size=(['"])default\1/g, 'size="md"')
      .replace(/size=(['"])compact\1/g, 'size="sm"')
      .replace(/size=(['"])large\1/g, 'size="lg"')
      .replace(component === 'Button' ? /size=(['"])xs\1/g : /$^/, 'size="sm"'));
  }
  return source;
}

function findOpeningTagEnd(source, start) {
  let quote = null;
  let braces = 0;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    const previous = source[index - 1];
    if (quote) {
      if (char === quote && previous !== '\\') quote = null;
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
}

function normalizeIconAttributes(attributes) {
  const inferredSize = /(?:min-)?h-11|(?:min-)?w-11/.test(attributes) ? 'lg' : /(?:min-)?h-(?:8|9)|(?:min-)?w-(?:8|9)/.test(attributes) ? 'sm' : 'md';
  let next = attributes.replace(/\s*size=(['"])icon\1/, '');
  next = next.replace(/className="([^"]*)"/g, (_full, classes) => {
    const cleaned = classes.split(/\s+/).filter((token) => !/^(?:min-)?[hw]-(?:8|9|10|11|12)$/.test(token) && token !== 'p-0').join(' ');
    return cleaned ? `className="${cleaned}"` : '';
  });
  return `${next} size="${inferredSize}"`;
}

function migrateIconButtons(source) {
  let changed = false;
  const replacements = [];
  let cursor = 0;
  while ((cursor = source.indexOf('<Button', cursor)) >= 0) {
    const boundary = source[cursor + '<Button'.length];
    if (boundary && /[\w$]/.test(boundary)) {
      cursor += 7;
      continue;
    }
    const openEnd = findOpeningTagEnd(source, cursor + 7);
    if (openEnd < 0) break;
    const opening = source.slice(cursor, openEnd + 1);
    if (!/\bsize=(['"])icon\1/.test(opening)) {
      cursor = openEnd + 1;
      continue;
    }

    const selfClosing = /\/\s*>$/.test(opening);
    const rawAttributes = opening.slice('<Button'.length, selfClosing ? opening.lastIndexOf('/') : -1);
    let attributes = normalizeIconAttributes(rawAttributes);
    const title = attributes.match(/\btitle=(['"])(.*?)\1/s)?.[2];
    if (title && !/\baria-label=/.test(attributes)) attributes += ` aria-label="${title}"`;
    const replacementOpen = `<IconButton${attributes}${selfClosing ? ' />' : '>'}`;
    if (selfClosing) {
      replacements.push({ start: cursor, end: openEnd + 1, value: replacementOpen });
      cursor = openEnd + 1;
      changed = true;
      continue;
    }

    const closeStart = source.indexOf('</Button>', openEnd + 1);
    if (closeStart < 0) break;
    const children = source.slice(openEnd + 1, closeStart).replace(
      /className=(['"])([^'"]*)\1/g,
      (_full, quote, classes) => {
        const cleaned = classes.split(/\s+/).filter((token) => !/^[hw]-(?:3|3\.5|4|5|6)$/.test(token)).join(' ');
        return cleaned ? `className=${quote}${cleaned}${quote}` : 'aria-hidden="true"';
      },
    );
    replacements.push({
      start: cursor,
      end: closeStart + '</Button>'.length,
      value: `${replacementOpen}${children}</IconButton>`,
    });
    cursor = closeStart + '</Button>'.length;
    changed = true;
  }
  for (const replacement of replacements.reverse()) {
    source = source.slice(0, replacement.start) + replacement.value + source.slice(replacement.end);
  }
  if (changed) source = addNamedDesignSystemImport(source, new Set(['IconButton']));
  return source;
}

const geometryToken = /^(?:(?:sm|md|lg|xl|2xl):)?!?(?:(?:min-|max-)?h-|(?:p|px|py|pl|pr|pt|pb)-|rounded(?:-|$)|text-(?:xs|sm|base|lg|xl|\[)|leading-(?:none|tight|snug|normal|relaxed|loose|\[)|gap-)/;
const iconButtonWidthToken = /^(?:(?:sm|md|lg|xl|2xl):)?!?(?:min-|max-)?w-/;

function normalizePrimitiveGeometry(source) {
  const components = ['Button', 'IconButton', 'Input', 'SearchInput', 'Select', 'Combobox', 'DateTimePicker', 'Textarea', 'FilterTrigger', 'FilterSelect', 'FilterMultiSelect', 'DateRangeFilter', 'Tabs', 'SegmentedControl'];
  for (const component of components) {
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
      const normalized = opening.replace(/className=(['"])([^'"]*)\1/g, (_full, quote, classes) => {
        const cleaned = classes
          .split(/\s+/)
          .filter((token) => token && !geometryToken.test(token) && !(component === 'IconButton' && iconButtonWidthToken.test(token)))
          .join(' ');
        return cleaned ? `className=${quote}${cleaned}${quote}` : '';
      });
      source = source.slice(0, cursor) + normalized + source.slice(end + 1);
      cursor += normalized.length;
    }
  }
  return source;
}

function normalizeControlIconGeometry(source) {
  for (const component of ['Button', 'IconButton']) {
    let cursor = 0;
    while ((cursor = source.indexOf(`<${component}`, cursor)) >= 0) {
      const boundary = source[cursor + component.length + 1];
      if (boundary && /[\w$]/.test(boundary)) {
        cursor += component.length + 1;
        continue;
      }
      const openEnd = findOpeningTagEnd(source, cursor + component.length + 1);
      if (openEnd < 0) break;
      const opening = source.slice(cursor, openEnd + 1);
      if (/\/\s*>$/.test(opening)) {
        cursor = openEnd + 1;
        continue;
      }
      const closeStart = source.indexOf(`</${component}>`, openEnd + 1);
      if (closeStart < 0) break;
      const body = source.slice(openEnd + 1, closeStart).replace(
        /(<[A-Z][A-Za-z0-9]*(?:\s[^>]*)?className=)(['"])([^'"]*)\2/g,
        (_full, prefix, quote, classes) => {
          const cleaned = classes.split(/\s+/).filter((token) => !/^(?:(?:sm|md|lg|xl|2xl):)?!?(?:min-|max-)?[hw]-(?:\d|\[)/.test(token)).join(' ');
          return cleaned ? `${prefix}${quote}${cleaned}${quote}` : `${prefix}${quote}kds-control-icon${quote}`;
        },
      );
      source = source.slice(0, openEnd + 1) + body + source.slice(closeStart);
      cursor = openEnd + 1 + body.length + `</${component}>`.length;
    }
  }
  return source;
}

function migrateSharedComponents(source) {
  const migrations = [
    { legacy: 'FilterSingleSelect', canonical: 'FilterSelect', path: /import\s+FilterSingleSelect\s+from\s+['"][^'"]*\/FilterSingleSelect['"]\s*;?\r?\n?/g },
    { legacy: 'FilterMultiSelect', canonical: 'FilterMultiSelect', path: /import\s+FilterMultiSelect\s+from\s+['"][^'"]*\/FilterMultiSelect['"]\s*;?\r?\n?/g },
    { legacy: 'FilterDateRange', canonical: 'DateRangeFilter', path: /import\s+FilterDateRange\s+from\s+['"][^'"]*\/FilterDateRange['"]\s*;?\r?\n?/g },
    { legacy: 'Pagination', canonical: 'Pagination', path: /import\s+Pagination\s+from\s+['"][^'"]*\/Pagination['"]\s*;?\r?\n?/g },
    { legacy: 'ModalShell', canonical: 'DialogShell', path: /import\s+ModalShell\s+from\s+['"][^'"]*components\/ui\/ModalShell['"]\s*;?\r?\n?/g },
    { legacy: 'WhatsAppDialog', canonical: 'WorkspaceDialog', path: /import\s+WhatsAppDialog\s+from\s+['"]\.\/WhatsAppDialog['"]\s*;?\r?\n?/g },
  ];
  for (const migration of migrations) {
    if (!migration.path.test(source)) continue;
    migration.path.lastIndex = 0;
    source = source.replace(migration.path, '');
    if (migration.legacy !== migration.canonical) {
      source = source.replace(new RegExp(`\\b${migration.legacy}\\b`, 'g'), migration.canonical);
    }
    source = addNamedDesignSystemImport(source, new Set([migration.canonical]));
  }
  return source;
}

function repairArrowAttributes(source) {
  return source
    .replace(/onClick=\{\(\) = size="(sm|md|lg)">/g, 'size="$1" onClick={() =>')
    .replace(/onClick=\{async \(\) = size="(sm|md|lg)">/g, 'size="$1" onClick={async () =>');
}

for (const file of await collect(sourceRoot)) {
  if (file.endsWith(path.join('design-system', 'components', 'Button.tsx'))) continue;
  const before = await fs.readFile(file, 'utf8');
  let after = normalizeComponentSizes(before);
  after = migrateIconButtons(after);
  after = normalizePrimitiveGeometry(after);
  after = normalizeControlIconGeometry(after);
  after = migrateSharedComponents(after);
  after = repairArrowAttributes(after);
  if (after !== before) await fs.writeFile(file, after, 'utf8');
}
