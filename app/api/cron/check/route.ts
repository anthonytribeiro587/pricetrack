import { checkAllMonitors } from "@/lib/monitoring";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const expected = process.env.PRICE_TRACK_API_KEY;
  if (!expected || request.headers.get("authorization") !== `Bearer ${expected}`) {
    return Response.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const results = await checkAllMonitors();
    return Response.json({ ok: true, checked: results.length, results });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Erro no cron." }, { status: 500 });
  }
}
