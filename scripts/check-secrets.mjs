import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const textExtensions = new Set([
  '.bat', '.bash', '.cjs', '.conf', '.config', '.css', '.cs', '.csv', '.env',
  '.example', '.go', '.html', '.ini', '.java', '.js', '.json', '.md', '.mdx',
  '.mjs', '.php', '.properties', '.ps1', '.py', '.rb', '.sh', '.sql', '.toml',
  '.ts', '.tsx', '.txt', '.xml', '.yaml', '.yml',
]);
const ignoredPath = /(^|[\\/])(?:\.git|node_modules|dist|coverage|\.next)(?:[\\/]|$)/i;
const jwtPattern = /\b(eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,})\b/g;
const providerKeyPatterns = [
  /\bAIza[0-9A-Za-z_-]{30,}\b/g,
  /\b(?:sk_live_|sk_test_|rk_live_|rk_test_)[A-Za-z0-9]{16,}\b/g,
  /\bgh[pousr]_[A-Za-z0-9]{30,}\b/g,
  /\bgithub_pat_[A-Za-z0-9_]{30,}\b/g,
  /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bwhsec_[A-Za-z0-9_-]{20,}\b/g,
];
const privateKeyPattern = /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g;
const credentialUrlPattern = /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^\s:@/]+:[^\s@/]+@[^\s/]+/gi;
const bearerPattern = /\bBearer\s+([A-Za-z0-9._~+\/-]{30,})/gi;
const sensitiveAssignmentPattern = /\b([A-Za-z][A-Za-z0-9_-]*)\b\s*[:=]\s*(["'])([^\r\n"']{16,})\2/g;
const placeholderPattern = /(?:your[-_ ]|example|placeholder|replace[-_ ]?me|change[-_ ]?me|<[^>]+>|\$\{|process\.env|seu[-_])/i;
const isSensitiveIdentifier = (name) =>
  /(?:^|_)(?:secret|token|password|api[_-]?key|private[_-]?key|service[_-]?role[_-]?key)$/i.test(name)
  || /(?:Secret|Token|Password|ApiKey|PrivateKey|ServiceRoleKey)$/.test(name);

const decodeJwtRole = (token) => {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(Buffer.from(payload, 'base64').toString('utf8')).role;
  } catch {
    return null;
  }
};

const fileList = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
  cwd: repoRoot,
  encoding: 'utf8',
  maxBuffer: 16 * 1024 * 1024,
});
const paths = [...new Set(fileList.split('\0').filter(Boolean))]
  .filter((path) => !ignoredPath.test(path) && textExtensions.has(extname(path).toLowerCase()))
  .sort();
const findings = [];

for (const path of paths) {
  let content;
  try {
    content = readFileSync(resolve(repoRoot, path), 'utf8');
  } catch {
    continue;
  }
  if (content.includes('\0')) continue;

  const lines = content.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    let category = null;

    if (privateKeyPattern.test(line)) category = 'private key';
    privateKeyPattern.lastIndex = 0;

    if (!category && credentialUrlPattern.test(line)) category = 'credentialed connection string';
    credentialUrlPattern.lastIndex = 0;

    if (!category) {
      for (const match of line.matchAll(bearerPattern)) {
        if (decodeJwtRole(match[1]) !== 'anon') {
          category = 'hardcoded bearer token';
          break;
        }
      }
    }
    bearerPattern.lastIndex = 0;

    if (!category) {
      for (const pattern of providerKeyPatterns) {
        if (pattern.test(line)) {
          category = 'provider API credential';
          pattern.lastIndex = 0;
          break;
        }
        pattern.lastIndex = 0;
      }
    }

    if (!category) {
      sensitiveAssignmentPattern.lastIndex = 0;
      for (const match of line.matchAll(sensitiveAssignmentPattern)) {
        if (
          isSensitiveIdentifier(match[1])
          && !placeholderPattern.test(match[3])
          && decodeJwtRole(match[3]) !== 'anon'
        ) {
          category = 'literal assigned to sensitive setting';
          break;
        }
      }
    }

    if (!category) {
      jwtPattern.lastIndex = 0;
      for (const match of line.matchAll(jwtPattern)) {
        if (decodeJwtRole(match[1]) === 'service_role') {
          category = 'Supabase service_role JWT';
          break;
        }
      }
    }

    if (category) findings.push({ path, line: index + 1, category });
  }
}

if (findings.length > 0) {
  const details = findings.map(({ path, line, category }) => `  ${relative(repoRoot, resolve(repoRoot, path))}:${line} (${category})`);
  console.error(`secrets:check bloqueou ${findings.length} possível(is) credencial(is); valores foram omitidos.\n${details.join('\n')}`);
  process.exit(1);
}

console.log(`secrets:check aprovado (${paths.length} arquivos rastreados ou não ignorados verificados; nenhum valor de credencial foi exibido).`);
