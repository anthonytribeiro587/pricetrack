import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { exchangeAuthorizationCode, saveMercadoLivreTokens } from "@/lib/mercadolivre";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const store = await cookies();
  const expectedState = store.get("pt_meli_state")?.value;
  const verifier = store.get("pt_meli_verifier")?.value;
  const origin = new URL(process.env.APP_URL || request.url).origin;

  if (!code || !state || !expectedState || state !== expectedState || !verifier) {
    return NextResponse.redirect(`${origin}/?meli=invalid_state`);
  }

  try {
    const tokens = await exchangeAuthorizationCode(code, verifier);
    await saveMercadoLivreTokens(tokens);
    const response = NextResponse.redirect(`${origin}/?meli=connected`);
    response.cookies.delete("pt_meli_state");
    response.cookies.delete("pt_meli_verifier");
    return response;
  } catch (error) {
    console.error("Mercado Livre OAuth callback", error);
    return NextResponse.redirect(`${origin}/?meli=error`);
  }
}
