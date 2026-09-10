import { scorePrice } from "@/lib/pricing";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const currentPrice = Number(body.currentPrice);
    const referencePrice = Number(body.referencePrice);

    return Response.json(scorePrice(currentPrice, referencePrice));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Invalid payload" },
      { status: 400 },
    );
  }
}
