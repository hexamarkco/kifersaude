import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const ENV_FILE = path.join(ROOT, ".env.local");

function loadEnv() {
  const env = {};
  if (fs.existsSync(ENV_FILE)) {
    for (const rawLine of fs.readFileSync(ENV_FILE, "utf8").split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#") || !line.includes("=")) continue;
      const idx = line.indexOf("=");
      const key = line.slice(0, idx).trim();
      let value = line.slice(idx + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      env[key] = value;
    }
  }
  return env;
}

async function main() {
  const env = loadEnv();
  const url = env.VITE_SUPABASE_URL;
  const serviceKey = env.VITE_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("Faltam VITE_SUPABASE_URL / VITE_SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  console.log("=== 1. Invocando comm-whatsapp-resolve-lids ===");
  const res = await fetch(`${url}/functions/v1/comm-whatsapp-resolve-lids`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
  });
  const body = await res.json();
  console.log("Status:", res.status);
  console.log(
    JSON.stringify(
      {
        totalLidChats: body.totalLidChats,
        resolved: body.resolved,
        named: body.named,
        updated: body.updated,
        linked: body.linked,
        skippedOwnNumber: body.skippedOwnNumber,
        notFound: body.notFound,
        failed: body.failed,
      },
      null,
      2,
    ),
  );
  const named = (body.details || []).filter((d) => d.name);
  console.log("Com nome resolvido:", named.length);
  named.slice(0, 12).forEach((d) =>
    console.log("  ", d.chat?.substring(0, 20), "|", d.phone || "-", "|", (d.name || "").substring(0, 30), "|", d.lead ? "lead" : "-"),
  );

  console.log("");
  console.log("=== 2. Leads Delcio e Ana ===");
  const supabase = createClient(url, serviceKey);
  const { data: leads } = await supabase
    .from("leads")
    .select("id, nome_completo, telefone, status")
    .ilike("nome_completo", "%delcio%")
    .limit(5);
  const { data: leadsAna } = await supabase
    .from("leads")
    .select("id, nome_completo, telefone, status")
    .ilike("nome_completo", "%ana%")
    .limit(10);
  [...(leads || []), ...(leadsAna || [])].forEach((l) =>
    console.log("  ", l.nome_completo, "| tel:", l.telefone, "| status:", l.status),
  );
}

main().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
