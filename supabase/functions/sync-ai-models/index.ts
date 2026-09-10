import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type SyncResult = {
  provider: string;
  fetched: number;
  upserted: number;
  deprecated: string[];
  error?: string;
};

/** Determine capabilities from model ID patterns */
function inferCapabilities(modelId: string): string[] {
  const id = modelId.toLowerCase();
  const caps: string[] = [];

  if (id.includes("transcribe") || id.includes("whisper")) {
    caps.push("transcription");
  } else {
    caps.push("text", "structured_output");
    if (id.includes("o3") || id.includes("o4") || id.includes("reason")) {
      caps.push("reasoning");
    }
    if (!id.includes("nano")) {
      caps.push("multimodal");
    }
  }

  return caps;
}

/** Display-friendly name from model ID */
function inferDisplayName(modelId: string): string {
  return modelId
    .replace(/^gpt-/, "GPT-")
    .replace(/^o([0-9])/, "o$1")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

async function syncOpenAI(): Promise<SyncResult> {
  const apiKey = Deno.env.get("OPENAI_API_KEY")?.trim();
  if (!apiKey) return { provider: "openai", fetched: 0, upserted: 0, deprecated: [], error: "No API key" };

  try {
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return { provider: "openai", fetched: 0, upserted: 0, deprecated: [], error: `HTTP ${res.status}` };

    const data = await res.json();
    const models: Array<{ id: string; owned_by?: string; shutdown_date?: string | null }> = data.data ?? [];

    // Filter to relevant models (chat/transcription, not embeddings/moderations/etc)
    const relevant = models.filter((m) => {
      const id = m.id.toLowerCase();
      return (
        id.startsWith("gpt-") ||
        id.startsWith("o1") ||
        id.startsWith("o3") ||
        id.startsWith("o4") ||
        id.includes("transcribe") ||
        id.includes("whisper")
      );
    });

    return { provider: "openai", fetched: relevant.length, upserted: 0, deprecated: [], ...await upsertModels(relevant) };
  } catch (e) {
    return { provider: "openai", fetched: 0, upserted: 0, deprecated: [], error: String(e) };
  }
}

async function upsertModels(
  remoteModels: Array<{ id: string }>,
): Promise<{ upserted: number; deprecated: string[] }> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const remoteIds = new Set(remoteModels.map((m) => m.id));

  // Upsert each remote model
  let upserted = 0;
  for (const m of remoteModels) {
    const capabilities = inferCapabilities(m.id);
    const { error } = await supabase
      .from("ai_models")
      .upsert(
        {
          provider: "openai",
          model: m.id,
          display_name: inferDisplayName(m.id),
          capabilities,
          active: true,
          deprecated_at: null,
        },
        { onConflict: "provider,model" },
      );
    if (!error) upserted++;
  }

  // Mark models not in remote as deprecated (only if they were previously active and not already deprecated)
  const { data: existingModels } = await supabase
    .from("ai_models")
    .select("model, deprecated_at")
    .eq("provider", "openai")
    .eq("active", true)
    .is("deprecated_at", null);

  const deprecated: string[] = [];
  for (const m of existingModels ?? []) {
    if (!remoteIds.has(m.model)) {
      await supabase
        .from("ai_models")
        .update({ deprecated_at: new Date().toISOString() })
        .eq("provider", "openai")
        .eq("model", m.model);
      deprecated.push(m.model);
    }
  }

  return { upserted, deprecated };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const results = [await syncOpenAI()];

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
