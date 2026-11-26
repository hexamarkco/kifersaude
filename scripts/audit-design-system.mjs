import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import ts from 'typescript';

const rootArg = process.argv.indexOf('--root');
const root = resolve(rootArg < 0 ? 'src' : process.argv[rootArg + 1]);
const library = join(root, 'design-system') + sep;
const primitives = new Set(['button', 'input', 'select', 'textarea', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'dialog', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'label', 'a', 'img', 'video', 'audio']);
const vendorUi = new Set(['Background', 'Controls', 'Handle', 'MiniMap', 'Panel']);
const violations = [];
const applicationComponents = new Set();
const catalogComponents = new Set();
let files = 0;
let controls = 0;
const display = (file) => relative(process.cwd(), file).split(sep).join('/');
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]);

for (const file of walk(root)) {
  if (file.startsWith(library) || file.includes(`${sep}__tests__${sep}`) || /\.(?:test|spec)\.[jt]sx?$/.test(file)) continue;
  if (!/\.(?:css|[jt]sx?)$/.test(file)) continue;
  const source = readFileSync(file, 'utf8');
  if (file.endsWith('.css')) {
    if (file !== join(root, 'index.css') || source.trim() !== "@import './design-system/styles.css';") violations.push(`${display(file)}: stylesheet outside the design system`);
    continue;
  }
  if (!/\.[jt]sx?$/.test(file)) continue;
  files++;
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const imports = new Map();
  for (const statement of tree.statements) {
    if (!ts.isImportDeclaration(statement) || statement.importClause?.isTypeOnly || !/(?:^|\/)design-system$/.test(statement.moduleSpecifier.text)) continue;
    const bindings = statement.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) for (const item of bindings.elements) {
      const name = item.propertyName?.text ?? item.name.text;
      if (!item.isTypeOnly && /^[A-Z][A-Za-z0-9]*$/.test(name)) imports.set(item.name.text, name);
    }
  }
  const references = file.startsWith(join(root, 'pages', 'dev') + sep) ? catalogComponents : applicationComponents;
  const record = (node, message) => violations.push(`${display(file)}:${tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1}: ${message}`);
  const visit = (node) => {
    if (!ts.isImportDeclaration(node) && ts.isIdentifier(node) && imports.has(node.text)) references.add(imports.get(node.text));
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(tree);
      if (primitives.has(tag)) record(node, `<${tag}> must use the public design-system component`);
      else if (/^[A-Z]/.test(tag)) controls++;
    }
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const name = node.moduleSpecifier.text;
      if (/\.css$/.test(name) && !(file === join(root, 'main.tsx') && name === './index.css')) record(node, 'styles must enter through src/design-system/styles.css');
      if (name === 'react-quill') record(node, 'use RichTextEditor from the design system');
      if (name === 'reactflow') {
        if (node.importClause?.name) record(node, 'use WorkflowCanvas from the design system');
        const bindings = node.importClause?.namedBindings;
        if (bindings && ts.isNamespaceImport(bindings) && !node.importClause?.isTypeOnly) record(node, 'workflow namespaces must use the design-system boundary');
        if (bindings && ts.isNamedImports(bindings)) for (const item of bindings.elements) if (vendorUi.has(item.propertyName?.text ?? item.name.text)) record(item, 'workflow UI must use the design-system boundary');
      }
    }
    if (ts.isCallExpression(node) && /^(?:React\.)?createElement$/.test(node.expression.getText(tree)) && node.arguments[0] && ts.isStringLiteral(node.arguments[0]) && primitives.has(node.arguments[0].text)) record(node, 'native visual elements must be implemented inside the design system');
    if (ts.isImportDeclaration(node)) return;
    ts.forEachChild(node, visit);
  };
  visit(tree);
}

if (rootArg < 0) for (const component of applicationComponents) {
  if (!catalogComponents.has(component)) violations.push(`Showcase coverage: ${component} is consumed by the application but has no catalog example`);
}

// Keep the operational typography floor independent of prototype export density.
if (rootArg < 0) {
  const theme = readFileSync(join(library, 'themes.css'), 'utf8');
  const floors = {
    'type-toolbar-control': 14, 'type-toolbar-caption': 13,
    'type-record-description': 14, 'type-record-body': 14,
    'type-record-secondary': 13, 'type-record-heading': 13,
    'type-record-field': 14, 'type-record-field-label': 14,
    'inbox-list-name': 14, 'inbox-list-preview': 13,
    'inbox-message-type': 15, 'inbox-meta-type': 12,
    'type-agenda-calendar-label': 13, 'type-agenda-calendar-event': 13,
    'finance-calendar-event-type': 13, 'type-dashboard-card-subtitle': 14,
    'type-dashboard-metric-label': 14, 'type-dashboard-metric-caption': 13,
  };
  for (const [token, floor] of Object.entries(floors)) {
    const declarations = [...theme.matchAll(new RegExp(`--${token}:\\s*([^;]+);`, 'g'))];
    if (!declarations.length || declarations.some(([, value]) => {
      const size = value.match(/(?:^|\\s)(\\d*\\.?\\d+)rem\\s*\\//);
      return !size || Number(size[1]) * 16 < floor;
    })) violations.push(`Workspace typography: --${token} must be at least ${floor}px at the default root size`);
  }
}

if (violations.length) {
  console.error(`Design-system contract failed (${violations.length} violations):\n${violations.join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(`Design-system contract passed: ${files} source files, ${controls} component usages, ${applicationComponents.size} application components covered by the showcase; no native visual primitives, local stylesheets or direct vendor UI.`);
}
