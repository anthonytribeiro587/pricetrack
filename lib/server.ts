import { createDecipheriv, createCipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_SUPABASE_URL = "https://iwfzbelugzowzskrxhvj.supabase.co";

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} não configurada.`);
  return value;
}

export function getSupabaseUrl() {
  return process.env.SUPABASE_URL?.trim() || DEFAULT_SUPABASE_URL;
}

export function getServerSupabase() {
  return createClient(getSupabaseUrl(), required("SUPABASE_SECRET_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export function isAdminRequest(request: Request) {
  const expected = process.env.PRICE_TRACK_API_KEY;
  if (!expected) return process.env.NODE_ENV !== "production";
  const received = request.headers.get("x-pricetrack-key") ?? "";
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function assertAdmin(request: Request) {
  if (!isAdminRequest(request)) {
    const message = process.env.PRICE_TRACK_API_KEY
      ? "Informe a chave correta do painel no campo à esquerda."
      : "PRICE_TRACK_API_KEY ainda não foi configurada na Vercel.";
    throw Response.json({ error: message }, { status: 401 });
  }
}

function credentialKey() {
  const raw = process.env.CREDENTIAL_ENCRYPTION_KEY?.trim();

  if (raw) {
    const key = /^[a-f0-9]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
    if (key.length !== 32) {
      throw new Error("CREDENTIAL_ENCRYPTION_KEY deve representar exatamente 32 bytes.");
    }
    return key;
  }

  const adminKey = required("PRICE_TRACK_API_KEY");
  if (adminKey.length < 24) {
    throw new Error("PRICE_TRACK_API_KEY deve ter pelo menos 24 caracteres para proteger os tokens do Mercado Livre.");
  }

  return createHash("sha256").update(`pricetrack:credentials:v1:${adminKey}`).digest();
}

export function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", credentialKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptSecret(value: string) {
  const packed = Buffer.from(value, "base64");
  const iv = packed.subarray(0, 12);
  const tag = packed.subarray(12, 28);
  const encrypted = packed.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", credentialKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
