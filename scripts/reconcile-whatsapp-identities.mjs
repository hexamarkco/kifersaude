#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ENV_FILE = path.join(ROOT, ".env.local");
const APPLY = process.argv.includes("--apply");
const VERIFY_ONLY = process.argv.includes("--verify-only");
const PAGE_SIZE = 100;

function loadEnv() {
  const env = { ...process.env };
  if (!fs.existsSync(ENV_FILE)) return env;

  for (const rawLine of fs.readFileSync(ENV_FILE, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const index = line.indexOf("=");
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in env)) env[key] = value;
  }

  return env;
}

function phoneLookupKeys(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return [];

  const keys = new Set([digits]);
  const appendBrazilVariants = (national) => {
    if (national.length === 11 && national[2] === "9" && /[6-9]/.test(national[3] ?? "")) {
      keys.add(national.slice(0, 2) + national.slice(3));
    }
    if (national.length === 10 && /[6-9]/.test(national[2] ?? "")) {
      keys.add(`${national.slice(0, 2)}9${national.slice(2)}`);
    }
  };

  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    const national = digits.slice(2);
    keys.add(national);
    appendBrazilVariants(national);
    for (const key of [...keys]) {
      if (!key.startsWith("55") && (key.length === 10 || key.length === 11)) keys.add(`55${key}`);
    }
  } else if (digits.length === 10 || digits.length === 11) {
    keys.add(`55${digits}`);
    appendBrazilVariants(digits);
    for (const key of [...keys]) {
      if (!key.startsWith("55") && (key.length === 10 || key.length === 11)) keys.add(`55${key}`);
    }
  }

  return [...keys];
}

async function loadAll(supabase, table, columns, configure = (query) => query) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const query = configure(supabase.from(table).select(columns)).range(from, from + 999);
    const { data, error } = await query;
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data ?? []));
    if ((data ?? []).length < 1000) return rows;
  }
}

function buildDuplicateGroups(chats) {
  const parent = new Map(chats.map((chat) => [chat.id, chat.id]));
  const find = (id) => {
    let root = parent.get(id);
    while (root && root !== parent.get(root)) root = parent.get(root);
    let cursor = id;
    while (root && parent.get(cursor) !== root) {
      const next = parent.get(cursor);
      parent.set(cursor, root);
      cursor = next;
    }
    return root || id;
  };
  const union = (left, right) => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) parent.set(rightRoot, leftRoot);
  };

  const ownerByKey = new Map();
  for (const chat of chats) {
    for (const key of phoneLookupKeys(chat.phone_digits || chat.phone_number)) {
      const owner = ownerByKey.get(`${chat.channel_id}:${key}`);
      if (owner) union(chat.id, owner);
      else ownerByKey.set(`${chat.channel_id}:${key}`, chat.id);
    }
  }

  const groups = new Map();
  for (const chat of chats) {
    const root = find(chat.id);
    const group = groups.get(root) ?? [];
    group.push(chat);
    groups.set(root, group);
  }
  return [...groups.values()].filter((group) => group.length > 1);
}

async function countRowsForChatIds(supabase, table, column, chatIds) {
  let total = 0;
  for (let index = 0; index < chatIds.length; index += 50) {
    const { count, error } = await supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .in(column, chatIds.slice(index, index + 50));
    if (error) throw new Error(`${table}: ${error.message}`);
    total += count ?? 0;
  }
  return total;
}

async function auditIdentityModel(supabase) {
  const [chats, identifiers, conflicts] = await Promise.all([
    loadAll(
      supabase,
      "comm_whatsapp_chats",
      "id,channel_id,external_chat_id,phone_number,phone_digits,merged_into_chat_id,deleted_at,identity_conflict",
    ),
    loadAll(
      supabase,
      "comm_whatsapp_chat_identifiers",
      "channel_id,external_chat_id,chat_id,identifier_kind,is_verified",
    ),
    loadAll(
      supabase,
      "comm_whatsapp_identity_conflicts",
      "id,chat_id,conflict_type,status",
      (query) => query.eq("status", "open"),
    ),
  ]);

  const activeChats = chats.filter((chat) => !chat.merged_into_chat_id && !chat.deleted_at);
  const mergedChats = chats.filter((chat) => chat.merged_into_chat_id);
  const mergedIds = new Set(mergedChats.map((chat) => chat.id));
  const verifiedWaIdByChat = new Set(
    identifiers
      .filter((identifier) => identifier.identifier_kind === "wa_id" && identifier.is_verified)
      .map((identifier) => identifier.chat_id),
  );
  const duplicateGroups = buildDuplicateGroups(activeChats);
  const lidPhonePollution = activeChats.filter((chat) => {
    if (!/@lid$/i.test(chat.external_chat_id)) return false;
    const lidDigits = chat.external_chat_id.replace(/@lid$/i, "").replace(/\D/g, "");
    return Boolean(lidDigits && String(chat.phone_digits ?? "").replace(/\D/g, "") === lidDigits);
  });
  const unresolvedLidChats = activeChats.filter(
    (chat) => /@lid$/i.test(chat.external_chat_id) && !verifiedWaIdByChat.has(chat.id),
  );
  const identifiersOnLosers = identifiers.filter((identifier) => mergedIds.has(identifier.chat_id));
  const openConflictChatIds = new Set(conflicts.map((conflict) => conflict.chat_id).filter(Boolean));
  const conflictFlagMismatch = chats.filter(
    (chat) => Boolean(chat.identity_conflict) !== openConflictChatIds.has(chat.id),
  );
  const mergedChatIds = [...mergedIds];
  const [
    messagesOnLosers,
    campaignTargetsOnLosers,
    aiSuggestionsOnLosers,
    optOutsOnLosers,
    enrichmentJobsOnLosers,
    conflictsOnLosers,
    followUpAuditOnLosers,
  ] = await Promise.all([
    countRowsForChatIds(supabase, "comm_whatsapp_messages", "chat_id", mergedChatIds),
    countRowsForChatIds(supabase, "comm_whatsapp_campaign_targets", "chat_id", mergedChatIds),
    countRowsForChatIds(supabase, "comm_whatsapp_ai_intent_suggestions", "chat_id", mergedChatIds),
    countRowsForChatIds(supabase, "comm_whatsapp_opt_outs", "source_chat_id", mergedChatIds),
    countRowsForChatIds(supabase, "comm_whatsapp_enrichment_jobs", "chat_id", mergedChatIds),
    countRowsForChatIds(supabase, "comm_whatsapp_identity_conflicts", "chat_id", mergedChatIds),
    countRowsForChatIds(supabase, "comm_follow_up_audit_log", "chat_id", mergedChatIds),
  ]);

  const hardConflicts = conflicts.filter(
    (conflict) => conflict.conflict_type === "identifier_conflict" || conflict.conflict_type === "reverse_mapping_conflict",
  );
  const failures = {
    activeDuplicateGroups: duplicateGroups.length,
    lidPhonePollution: lidPhonePollution.length,
    unresolvedLidChats: unresolvedLidChats.length,
    identifiersOnMergedChats: identifiersOnLosers.length,
    messagesOnMergedChats: messagesOnLosers,
    campaignTargetsOnMergedChats: campaignTargetsOnLosers,
    aiSuggestionsOnMergedChats: aiSuggestionsOnLosers,
    optOutsOnMergedChats: optOutsOnLosers,
    enrichmentJobsOnMergedChats: enrichmentJobsOnLosers,
    conflictsOnMergedChats: conflictsOnLosers,
    followUpAuditOnMergedChats: followUpAuditOnLosers,
    hardIdentityConflicts: hardConflicts.length,
    conflictFlagMismatch: conflictFlagMismatch.length,
  };
  const ok = Object.values(failures).every((value) => value === 0);

  console.log("\n[identity-audit]", JSON.stringify({
    ok,
    totals: {
      chats: chats.length,
      activeChats: activeChats.length,
      mergedChats: mergedChats.length,
      identifiers: identifiers.length,
      openConflicts: conflicts.length,
    },
    failures,
    reviewOnlyLeadConflicts: conflicts.length - hardConflicts.length,
    duplicateGroups: duplicateGroups.slice(0, 20).map((group) => group.map((chat) => ({
      id: chat.id,
      externalChatId: chat.external_chat_id,
      phone: chat.phone_digits,
    }))),
    unresolvedLidChatIds: unresolvedLidChats.slice(0, 50).map((chat) => chat.id),
  }, null, 2));

  return ok;
}

async function reconcile(supabase) {
  let cursor = null;
  let page = 0;
  const totals = { processed: 0, resolved: 0, reconciled: 0, invalidPhones: 0, unresolved: 0, conflicts: 0, errors: 0 };

  do {
    page += 1;
    if (page > 100) throw new Error("Limite de 100 paginas excedido; interrompendo por seguranca.");

    const { data, error } = await supabase.functions.invoke("comm-whatsapp-resolve-lids", {
      body: { apply: APPLY, cursor, limit: PAGE_SIZE },
    });
    if (error) throw new Error(`comm-whatsapp-resolve-lids: ${error.message}`);
    if (!data?.success) throw new Error(data?.error || "Resolver retornou resposta invalida.");

    for (const key of Object.keys(totals)) totals[key] += Number(data[key]) || 0;
    for (const detail of data.details ?? []) {
      if (["conflict", "error", "unresolved", "clear_invalid_phone"].includes(detail.action)) {
        console.log("[identity-detail]", JSON.stringify(detail));
      }
    }
    cursor = data.nextCursor || null;
    console.log(`[identity-repair] pagina=${page} processados=${data.processed} proximo=${cursor || "fim"}`);
  } while (cursor);

  console.log("\n[identity-repair] resumo", JSON.stringify({ mode: APPLY ? "apply" : "dry-run", ...totals }, null, 2));
  if (totals.errors > 0 || totals.conflicts > 0) process.exitCode = 1;
}

async function main() {
  const env = loadEnv();
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const serviceKey = env.VITE_SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Credenciais Supabase ausentes em .env.local.");

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  console.log(`[identity-repair] projeto=${url} modo=${VERIFY_ONLY ? "verify" : APPLY ? "apply" : "dry-run"}`);

  if (VERIFY_ONLY) {
    if (!(await auditIdentityModel(supabase))) process.exitCode = 1;
    return;
  }

  console.log("[identity-repair] auditoria anterior");
  await auditIdentityModel(supabase);
  await reconcile(supabase);

  if (APPLY) {
    console.log("[identity-repair] auditoria posterior");
    if (!(await auditIdentityModel(supabase))) process.exitCode = 1;
  } else {
    console.log("\nDry-run concluido. Use `npm run repair:whatsapp-identities -- --apply` para aplicar.");
  }
}

main().catch((error) => {
  console.error("[identity-repair] FALHA:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
