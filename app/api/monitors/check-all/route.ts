import { checkAllMonitors } from "@/lib/monitoring";
import { assertAdmin } from "@/lib/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertAdmin(request);
    const results = await checkAllMonitors();
    return Response.json({ ok: true, checked: results.length, results });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ error: error instanceof Error ? error.message : "Erro na verificação." }, { status: 500 });
  }
}
