import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveModelForFeature } from "../_shared/ai-router.ts";
import type { AiTask } from "../_shared/ai-router.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { featureKey, aiTask } = await req.json();

    if (!featureKey || !aiTask) {
      return new Response(
        JSON.stringify({ error: "featureKey and aiTask are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const resolved = await resolveModelForFeature(supabaseAdmin, featureKey, aiTask as AiTask);

    return new Response(
      JSON.stringify({
        provider: resolved.provider,
        model: resolved.model,
        source: resolved.source,
        sourceLabel:
          resolved.source === "feature"
            ? "Personalizado (esta feature)"
            : resolved.source === "ai_routing"
              ? "Roteamento por funcionalidade"
              : resolved.source === "provider_default"
                ? "Default do provider"
                : "Fallback",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
