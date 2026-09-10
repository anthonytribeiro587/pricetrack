import { checkAllMonitors } from "@/lib/monitoring";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected || request.headers.get("authorization") !== `Bearer ${expected}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    const results = await checkAllMonitors();
    return Response.json({ ok: true, checked: results.length, results });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Erro no cron." }, { status: 500 });
  }
}
