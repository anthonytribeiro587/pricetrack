import { checkMonitor } from "@/lib/monitoring";
import { assertAdmin } from "@/lib/server";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertAdmin(request);
    const { id } = await context.params;
    return Response.json({ monitor: await checkMonitor(id) });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ error: error instanceof Error ? error.message : "Erro ao verificar monitor." }, { status: 500 });
  }
}
