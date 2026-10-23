#!/usr/bin/env node
// Audits the provider inventory and recovers available history with the same
// authenticated, deduplicated endpoint used by the Inbox. Never sends messages.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const since = args.find((arg) => arg.startsWith('--since='))?.slice(8);
const apply = args.includes('--apply');
if (!since || !Number.isFinite(Date.parse(since))) {
  throw new Error('Informe --since=<data ISO com fuso>. Use --apply para recuperar; sem ele, apenas lista os candidatos.');
}
const env = { ...process.env };
for (const name of ['.env.local', '.env', 'supabase.local.ini']) {
  const file = path.join(root, name);
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/);
    if (match && !env[match[1]]) env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}
const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
if (!url) throw new Error('URL Supabase ausente.');
const projectRef = new URL(url).hostname.split('.')[0];
let serverKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!serverKey) {
  // Capture credentials in memory; never print or persist CLI key output.
  const keys = JSON.parse(execFileSync(process.platform === 'win32' ? 'supabase.exe' : 'supabase', [
    'projects', 'api-keys', '--project-ref', projectRef, '--output', 'json',
  ], { encoding: 'utf8', cwd: root, stdio: ['ignore', 'pipe', 'pipe'] }));
  serverKey = keys.find((key) => key.name === 'service_role')?.api_key;
}
if (!serverKey) throw new Error('Credencial de servidor ausente.');
const db = createClient(url, serverKey, { auth: { persistSession: false, autoRefreshToken: false } });
const startedAt = new Date().toISOString();
const timeTo = Math.floor(Date.now() / 1000);
const sinceSeconds = Math.floor(Date.parse(since) / 1000);
const report = { startedAt, since, apply, localChats: 0, providerChats: 0, candidates: 0, outcomes: [] };
const reportDir = path.join(root, 'local-artifacts');
fs.mkdirSync(reportDir, { recursive: true });
const reportPath = path.join(reportDir, `whatsapp-recovery-${startedAt.replace(/[:.]/g, '-')}.json`);
const save = () => fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

async function invoke(name, body) {
  const response = await fetch(`${url}/functions/v1/${name}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${serverKey}`, apikey: serverKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(140_000),
  });
  const payload = await response.json();
  if (!response.ok || payload.success !== true) {
    throw new Error(payload.error || `Falha HTTP ${response.status} em ${name}.`);
  }
  return payload;
}

async function main() {
  const local = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.from('comm_whatsapp_chats')
      .select('id,external_chat_id,last_message_at,deleted_at,merged_into_chat_id')
      .order('id').range(offset, offset + 999);
    if (error) throw new Error(error.message);
    local.push(...data);
    if (data.length < 1000) break;
  }
  report.localChats = local.length;
  const excluded = new Set(local.filter((chat) => chat.deleted_at || chat.merged_into_chat_id).map((chat) => chat.external_chat_id));
  const targets = new Set(local.filter((chat) => !excluded.has(chat.external_chat_id)
    && Date.parse(chat.last_message_at) >= Date.parse(since)).map((chat) => chat.external_chat_id));
  const provider = new Set();
  let chatOffset = 0;
  for (;;) {
    const page = await invoke('comm-whatsapp-sync-all-chats', { mode: 'discover', chatOffset, chatCount: 100 });
    for (const chat of page.chats) {
      provider.add(chat.externalChatId);
      if (!excluded.has(chat.externalChatId) && (chat.lastMessageAt === null || chat.lastMessageAt >= sinceSeconds)) {
        targets.add(chat.externalChatId);
      }
    }
    if (!page.hasMoreChats) break;
    if (!(page.nextChatOffset > chatOffset)) throw new Error('A descoberta não avançou; recuperação interrompida.');
    chatOffset = page.nextChatOffset;
  }
  report.providerChats = provider.size;
  report.candidates = targets.size;
  save();
  console.log(JSON.stringify({ phase: 'inventory', localChats: report.localChats, providerChats: provider.size, candidates: targets.size, apply, reportPath }));
  if (!apply) return;

  const queue = [...targets];
  let next = 0;
  async function worker() {
    while (next < queue.length) {
      const externalChatId = queue[next++];
      const outcome = { externalChatId, imported: 0, updated: 0, fetched: 0, pages: 0, complete: false };
      let offset = 0;
      try {
        for (let page = 0; page < 1000; page++) {
          const result = await invoke('comm-whatsapp-sync-chat', { chatId: externalChatId, offset, count: 25, timeTo, timeFrom: sinceSeconds });
          outcome.imported += result.imported;
          outcome.updated += result.updated;
          outcome.fetched += result.fetched;
          outcome.pages++;
          if (!result.hasMore) { outcome.complete = true; break; }
          if (!(result.nextOffset > offset)) throw new Error('O cursor do histórico não avançou.');
          offset = result.nextOffset;
        }
        if (!outcome.complete) throw new Error('Limite de páginas atingido; histórico incompleto.');
      } catch (error) {
        outcome.error = error.message;
        outcome.nextOffset = offset;
      }
      report.outcomes.push(outcome);
      save();
      console.log(JSON.stringify({ phase: 'progress', completed: report.outcomes.length, total: queue.length,
        imported: report.outcomes.reduce((sum, item) => sum + item.imported, 0),
        failed: report.outcomes.filter((item) => !item.complete).length }));
    }
  }
  // Bound provider traffic, including each function's identity and name reads.
  await Promise.all([worker(), worker()]);
  report.finishedAt = new Date().toISOString();
  save();
  console.log(JSON.stringify({ phase: 'finished', checked: report.outcomes.length,
    chatsRecovered: report.outcomes.filter((item) => item.imported > 0).length,
    imported: report.outcomes.reduce((sum, item) => sum + item.imported, 0),
    failed: report.outcomes.filter((item) => !item.complete).length, reportPath }));
  if (report.outcomes.some((item) => !item.complete)) process.exitCode = 1;
}

main().catch((error) => {
  report.error = error.message;
  save();
  console.error(error.message);
  process.exitCode = 1;
});
