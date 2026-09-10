import { getMercadoLivreConnectionStatus } from "@/lib/mercadolivre";
import { assertAdmin } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    assertAdmin(request);
    return Response.json(await getMercadoLivreConnectionStatus());
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ connected: false, error: error instanceof Error ? error.message : "Erro ao consultar conexão." }, { status: 500 });
  }
}
