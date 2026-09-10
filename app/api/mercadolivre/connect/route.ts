import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/server";
import { createOAuthState, createPkce, getAuthorizationUrl } from "@/lib/mercadolivre";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    assertAdmin(request);
    const state = createOAuthState();
    const { verifier, challenge } = createPkce();
    const response = NextResponse.json({ authorizationUrl: getAuthorizationUrl(state, challenge) });
    const secure = process.env.NODE_ENV === "production";
    response.cookies.set("pt_meli_state", state, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 600 });
    response.cookies.set("pt_meli_verifier", verifier, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 600 });
    return response;
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ error: error instanceof Error ? error.message : "Erro ao iniciar conexão." }, { status: 500 });
  }
}
