import { createHash, randomBytes } from "node:crypto";
import { decryptSecret, encryptSecret, getServerSupabase } from "@/lib/server";

export type MercadoLivreItem = {
  id: string;
  title: string;
  price: number;
  originalPrice: number | null;
  currencyId: string;
  availableQuantity: number | null;
  thumbnail: string | null;
  permalink: string;
  status: string;
};

type TokenPayload = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user_id: number;
};

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} não configurada.`);
  return value;
}

export function createPkce() {
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function createOAuthState() {
  return randomBytes(24).toString("base64url");
}

export function getAuthorizationUrl(state: string, codeChallenge: string) {
  const url = new URL("https://auth.mercadolivre.com.br/authorization");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", env("MELI_CLIENT_ID"));
  url.searchParams.set("redirect_uri", env("MELI_REDIRECT_URI"));
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

async function exchangeToken(params: URLSearchParams): Promise<TokenPayload> {
  const response = await fetch("https://api.mercadolibre.com/oauth/token", {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
    body: params,
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body?.error_description || body?.message || `OAuth Mercado Livre: HTTP ${response.status}`);
  }
  return body as TokenPayload;
}

export async function exchangeAuthorizationCode(code: string, codeVerifier: string) {
  return exchangeToken(new URLSearchParams({
    grant_type: "authorization_code",
    client_id: env("MELI_CLIENT_ID"),
    client_secret: env("MELI_CLIENT_SECRET"),
    code,
    redirect_uri: env("MELI_REDIRECT_URI"),
    code_verifier: codeVerifier,
  }));
}

async function refreshAccessToken(refreshToken: string) {
  return exchangeToken(new URLSearchParams({
    grant_type: "refresh_token",
    client_id: env("MELI_CLIENT_ID"),
    client_secret: env("MELI_CLIENT_SECRET"),
    refresh_token: refreshToken,
  }));
}

export async function saveMercadoLivreTokens(tokens: TokenPayload) {
  const supabase = getServerSupabase();
  const expiresAt = new Date(Date.now() + Math.max(60, tokens.expires_in - 120) * 1000).toISOString();
  const { error } = await supabase.from("pricetrack_credentials").upsert({
    marketplace: "mercadolivre",
    access_token_enc: encryptSecret(tokens.access_token),
    refresh_token_enc: encryptSecret(tokens.refresh_token),
    expires_at: expiresAt,
    external_user_id: tokens.user_id,
    updated_at: new Date().toISOString(),
  }, { onConflict: "marketplace" });
  if (error) throw new Error(`Supabase credenciais: ${error.message}`);
}

async function readCredential() {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("pricetrack_credentials")
    .select("access_token_enc,refresh_token_enc,expires_at,external_user_id,updated_at")
    .eq("marketplace", "mercadolivre")
    .maybeSingle();
  if (error) throw new Error(`Supabase credenciais: ${error.message}`);
  return data;
}

export async function getMercadoLivreConnectionStatus() {
  const credential = await readCredential();
  return {
    connected: Boolean(credential),
    externalUserId: credential?.external_user_id ?? null,
    expiresAt: credential?.expires_at ?? null,
    updatedAt: credential?.updated_at ?? null,
  };
}

export async function getValidAccessToken() {
  let credential = await readCredential();
  if (!credential) throw new Error("Mercado Livre ainda não conectado.");

  if (new Date(credential.expires_at).getTime() > Date.now() + 5 * 60 * 1000) {
    return decryptSecret(credential.access_token_enc);
  }

  try {
    const refreshed = await refreshAccessToken(decryptSecret(credential.refresh_token_enc));
    await saveMercadoLivreTokens(refreshed);
    return refreshed.access_token;
  } catch (error) {
    credential = await readCredential();
    if (credential && new Date(credential.expires_at).getTime() > Date.now() + 5 * 60 * 1000) {
      return decryptSecret(credential.access_token_enc);
    }
    throw error;
  }
}

export function extractMercadoLivreItemId(value: string) {
  const match = value.toUpperCase().match(/\bMLB[-_ ]?(\d{6,})\b/);
  return match ? `MLB${match[1]}` : null;
}

export async function resolveMercadoLivreItemId(value: string) {
  const direct = extractMercadoLivreItemId(value);
  if (direct) return direct;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Cole um link válido do anúncio do Mercado Livre.");
  }

  const host = url.hostname.toLowerCase();
  if (host !== "meli.la" && !host.endsWith("mercadolivre.com.br")) {
    throw new Error("Neste MVP aceitamos apenas links do Mercado Livre Brasil.");
  }

  if (host === "meli.la") {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: { "user-agent": "PriceTrack/1.0" },
      cache: "no-store",
    });
    const resolved = extractMercadoLivreItemId(response.url);
    if (resolved) return resolved;
  }

  throw new Error("Não encontrei o código MLB do anúncio nesse link. Tente abrir o anúncio e copiar a URL completa.");
}

export async function fetchMercadoLivreItem(itemId: string): Promise<MercadoLivreItem> {
  const token = await getValidAccessToken();
  const response = await fetch(`https://api.mercadolibre.com/items/${encodeURIComponent(itemId)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({}));
  if (!(response.ok || response.status === 206)) {
    throw new Error(body?.message || `Mercado Livre: HTTP ${response.status}`);
  }
  if (!body?.id || !Number.isFinite(Number(body?.price))) {
    throw new Error("O Mercado Livre retornou um anúncio sem preço válido.");
  }
  return {
    id: String(body.id),
    title: String(body.title || body.id),
    price: Number(body.price),
    originalPrice: Number.isFinite(Number(body.original_price)) ? Number(body.original_price) : null,
    currencyId: String(body.currency_id || "BRL"),
    availableQuantity: Number.isFinite(Number(body.available_quantity)) ? Number(body.available_quantity) : null,
    thumbnail: body.thumbnail ? String(body.thumbnail).replace(/^http:/, "https:") : null,
    permalink: String(body.permalink || ""),
    status: String(body.status || "unknown"),
  };
}
