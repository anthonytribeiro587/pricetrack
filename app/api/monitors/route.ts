import { fetchMercadoLivreItem, resolveMercadoLivreItemId } from "@/lib/mercadolivre";
import { createMonitorFromItem, listMonitors } from "@/lib/monitoring";
import { assertAdmin } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    assertAdmin(request);
    return Response.json({ monitors: await listMonitors() });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ error: error instanceof Error ? error.message : "Erro ao listar monitores." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    assertAdmin(request);
    const body = await request.json();
    const url = String(body?.url || "").trim();
    if (!url) return Response.json({ error: "Cole o link do anúncio." }, { status: 400 });
    const itemId = await resolveMercadoLivreItemId(url);
    const item = await fetchMercadoLivreItem(itemId);
    return Response.json({ monitor: await createMonitorFromItem(item) }, { status: 201 });
  } catch (error) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : "Erro ao criar monitor.";
    return Response.json({ error: message }, { status: message.includes("já está") ? 409 : 400 });
  }
}
