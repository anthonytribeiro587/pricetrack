import { createClient } from "@supabase/supabase-js";
import { getAppUrl, getMercadoLivreRedirectUri } from "@/lib/mercadolivre";
import { getSupabaseUrl } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function has(name: string) {
  return Boolean(process.env[name]?.trim());
}

export async function GET() {
  const supabaseUrl = getSupabaseUrl();
  const appUrl = getAppUrl();
  const redirectUri = getMercadoLivreRedirectUri();

  const variables = {
    SUPABASE_URL: true,
    SUPABASE_SECRET_KEY: has("SUPABASE_SECRET_KEY"),
    PRICE_TRACK_API_KEY: has("PRICE_TRACK_API_KEY"),
    CREDENTIAL_ENCRYPTION_KEY: has("CREDENTIAL_ENCRYPTION_KEY"),
    MELI_CLIENT_ID: has("MELI_CLIENT_ID"),
    MELI_CLIENT_SECRET: has("MELI_CLIENT_SECRET"),
    MELI_REDIRECT_URI: true,
    APP_URL: true,
  };

  let databaseReachable = false;
  let databaseError: string | null = null;

  if (variables.SUPABASE_SECRET_KEY) {
    try {
      const client = createClient(supabaseUrl, process.env.SUPABASE_SECRET_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
      const { error } = await client.from("pricetrack_monitors").select("id", { head: true, count: "exact" });
      if (error) databaseError = error.message;
      else databaseReachable = true;
    } catch (error) {
      databaseError = error instanceof Error ? error.message : "Falha ao testar Supabase.";
    }
  }

  return Response.json({
    ok: true,
    variables,
    effective: {
      supabaseUrl,
      appUrl,
      mercadoLivreRedirectUri: redirectUri,
    },
    database: {
      configured: variables.SUPABASE_SECRET_KEY,
      reachable: databaseReachable,
      error: databaseError,
    },
    encryption: {
      mode: variables.CREDENTIAL_ENCRYPTION_KEY ? "dedicated" : variables.PRICE_TRACK_API_KEY ? "derived_from_panel_key" : "missing",
    },
    readyForDashboard:
      variables.SUPABASE_SECRET_KEY &&
      variables.PRICE_TRACK_API_KEY &&
      databaseReachable,
    readyForMercadoLivre:
      variables.PRICE_TRACK_API_KEY &&
      variables.MELI_CLIENT_ID &&
      variables.MELI_CLIENT_SECRET,
  });
}
