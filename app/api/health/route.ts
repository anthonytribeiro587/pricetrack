export async function GET() {
  return Response.json({
    ok: true,
    service: "pricetrack",
    timestamp: new Date().toISOString(),
  });
}
