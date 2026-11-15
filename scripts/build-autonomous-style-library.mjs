import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const normalize = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const hash = value => createHash('sha256').update(value).digest('hex').slice(0, 12);

export function sanitizeStyleText(text, names) {
  let result = text.replace(/\*/g, '').replace(/https?:\/\/\S+|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/gi, '[contato]').trim();
  for (const name of names) {
    for (const token of [name, name.trim().split(/\s+/)[0]]) {
      if (token.length > 2) result = result.replace(new RegExp(`(?<![\\p{L}])${escape(token)}(?![\\p{L}])`, 'giu'), '[cliente]');
    }
  }
  result = result.replace(/\b(?:\d[\s()./-]*){8,}\b/g, '[documento]')
    .replace(/\[cliente\]\s*[,!]\s*/gi, '').replace(/,\s*\[cliente\](?=[.!?])/gi, '')
    .replace(/,\s+E\b/g, ', e')
    .replace(/\s+/g, ' ').trim();
  return result.charAt(0).toUpperCase() + result.slice(1);
}

export function classifyStyleQuestion(text) {
  const value = normalize(text.split(/[.!]/).find(sentence => sentence.includes('?')) ?? '');
  if (/\b(?:idade|idades|anos)\b/.test(value)) return 'beneficiaries';
  if (/\bcnpj\b|\bmei\b/.test(value)) return /numero|numeracao|envi|passar|fornecer/.test(value) ? 'companyNumber' : 'companyPresence';
  if (/cidade|bairro|onde (?:voce |voces )?(?:mora|reside)/.test(value)) return /cidade/.test(value) ? 'city' : 'neighborhood';
  if (/o que (?:te |levou|fez|espera|seria)|mais importante|pesa mais|busca|buscar|procur|priorizar/.test(value)) return 'goal';
  if (/\bqual\b[^?]*(?:plano|operadora)\b/.test(value)) return 'currentOperator';
  if (/(?:ja (?:tem|possui|possuem)|tem algum|sem (?:plano|cobertura))/.test(value)) return 'hasCurrentPlan';
  if (/somente para voce|so para voce|mais alguem|quantas pessoas|quantas vidas/.test(value)) return 'beneficiaryCount';
  return null;
}

export function buildStyleLibrary(rows) {
  const names = [...new Set(rows.flatMap(row => row.contact_names ?? []).filter(name => typeof name === 'string' && name.trim()))];
  const examples = []; const provenance = []; const rejected = {}; const seen = new Set();
  const reject = reason => { rejected[reason] = (rejected[reason] ?? 0) + 1; };
  for (const row of rows) {
    const metadata = row.metadata ?? {};
    if (row.source !== 'api' || !['nick', 'luiza.kifer'].includes(row.author) || !row.id || !row.chat_id
      || metadata.automation && metadata.automation !== 'false' || metadata.ai_generated && metadata.ai_generated !== 'false'
      || metadata.campaign_id || metadata.deleted || metadata.forwarded || String(metadata.provider ?? '').startsWith('ai_')) { reject('unverified_or_automated'); continue; }
    const text = sanitizeStyleText(String(row.text_content ?? ''), names);
    const value = normalize(text);
    // Only initial qualification questions. No clinical discussion, personal details, quotes, or product rules.
    if (text.length < 10 || text.length > 480 || (text.match(/\?/g) ?? []).length !== 1
      || text.split(/[.!?]+\s*/).filter(Boolean).length > 3) { reject('not_short_single_question'); continue; }
    if (/[\d\[\]:—–]|\b(?:cpf|cep|pix|boleto|endereco|nascimento|diagnost|cirurg|tratamento|acompanhamento|especialidade|doenca|carencia|portabilidade|coparticip|reembolso|cobre|cobertura nacional|garant|aprov|aceito|elegivel|sempre|amil|klini|leve saude|assim max|unimed|prompt|sistema|instrucoes|ignore|chave)\w*/.test(value)
      || /r\$|mais em conta|mais barato|menor valor|valor mensal|mensalidade|apartamento|contrat|documento|contato\]|desses dois|entre (?:essas|essas|as|os)|opcoes que te (?:enviei|mandei)/.test(value)) { reject('sensitive_or_product_content'); continue; }
    const field = classifyStyleQuestion(text);
    if (!field) { reject('outside_qualification'); continue; }
    const key = normalize(text).replace(/[^\p{L}\s]/gu, '').replace(/\s+/g, ' ').trim();
    if (seen.has(key)) { reject('duplicate'); continue; }
    seen.add(key);
    const audience = /\bvoces\b|\bvcs\b|\bidades\b|\bmoram\b/.test(value) ? 'family'
      : /\bvoce\b|\bsua idade\b|\bvc\b/.test(value) ? 'individual' : 'any';
    const id = `style-${hash(row.id)}`;
    examples.push({ id, field, text, audience });
    provenance.push({ id, messageId: row.id, chatId: row.chat_id, author: row.author, messageAt: row.message_at });
  }
  return { library: { version: `kifer-human-${hash(JSON.stringify(examples))}`, examples }, provenance,
    summary: { sourceMessages: rows.length, sourceChats: new Set(rows.map(row => row.chat_id)).size,
      selectedExamples: examples.length, selectedChats: new Set(provenance.map(row => row.chatId)).size,
      byField: Object.fromEntries([...new Set(examples.map(row => row.field))].map(field => [field, examples.filter(row => row.field === field).length])),
      byAuthor: Object.fromEntries([...new Set(rows.map(row => row.author))].map(author => [author, { scanned: rows.filter(row => row.author === author).length,
        selected: provenance.filter(row => row.author === author).length }])), rejected } };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const directory = resolve('local-artifacts/autonomous-v2-style');
  const source = JSON.parse(await readFile(resolve(directory, 'source-private.json'), 'utf8'));
  const built = buildStyleLibrary(source.rows);
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, 'library.json'), JSON.stringify(built.library, null, 2));
  await writeFile(resolve(directory, 'provenance-private.json'), JSON.stringify(built.provenance, null, 2));
  await writeFile(resolve(directory, 'summary.json'), JSON.stringify(built.summary, null, 2));
  console.log(JSON.stringify(built.summary));
}
