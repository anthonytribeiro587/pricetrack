import { assertAdmin, getServerSupabase } from "@/lib/server";

export const runtime = "nodejs";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertAdmin(request);
    const { id } = await context.params;
    const supabase = getServerSupabase();
    const { error } = await supabase.from("pricetrack_monitors").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ error: error instanceof Error ? error.message : "Erro ao remover monitor." }, { status: 500 });
  }
}
