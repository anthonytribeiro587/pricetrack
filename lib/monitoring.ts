import { fetchMercadoLivreItem } from "@/lib/mercadolivre";
import { scorePrice } from "@/lib/pricing";
import { getServerSupabase } from "@/lib/server";

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export async function listMonitors() {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("pricetrack_monitors")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  return (data ?? []).map((monitor) => ({
    ...monitor,
    score: scorePrice(Number(monitor.current_price), Number(monitor.reference_price)),
  }));
}

export async function createMonitorFromItem(item: Awaited<ReturnType<typeof fetchMercadoLivreItem>>) {
  const supabase = getServerSupabase();
  const reference = item.originalPrice && item.originalPrice > item.price ? item.originalPrice : item.price;
  const now = new Date().toISOString();

  const { data: existing } = await supabase
    .from("pricetrack_monitors")
    .select("id")
    .eq("item_id", item.id)
    .maybeSingle();
  if (existing) throw new Error("Esse anúncio já está sendo monitorado.");

  const { data: monitor, error } = await supabase
    .from("pricetrack_monitors")
    .insert({
      marketplace: "mercadolivre",
      item_id: item.id,
      title: item.title,
      product_url: item.permalink,
      image_url: item.thumbnail,
      currency_id: item.currencyId,
      current_price: item.price,
      reference_price: reference,
      lowest_price: item.price,
      highest_price: item.price,
      available_quantity: item.availableQuantity,
      marketplace_status: item.status,
      last_checked_at: now,
      active: true,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  const { error: snapshotError } = await supabase.from("pricetrack_price_snapshots").insert({
    monitor_id: monitor.id,
    price: item.price,
    original_price: item.originalPrice,
    available_quantity: item.availableQuantity,
    captured_at: now,
  });
  if (snapshotError) throw new Error(snapshotError.message);

  return { ...monitor, score: scorePrice(item.price, reference) };
}

async function referenceFromHistory(monitorId: string, fallback: number) {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("pricetrack_price_snapshots")
    .select("price")
    .eq("monitor_id", monitorId)
    .order("captured_at", { ascending: false })
    .limit(30);
  if (error) throw new Error(error.message);
  const prices = (data ?? []).map((row) => Number(row.price)).filter((value) => Number.isFinite(value) && value > 0);
  return prices.length >= 3 ? median(prices) : fallback;
}

export async function checkMonitor(monitorId: string) {
  const supabase = getServerSupabase();
  const { data: monitor, error } = await supabase
    .from("pricetrack_monitors")
    .select("*")
    .eq("id", monitorId)
    .single();
  if (error) throw new Error(error.message);
  if (!monitor.active) return { ...monitor, skipped: true };

  try {
    const item = await fetchMercadoLivreItem(monitor.item_id);
    const fallback = Number(monitor.reference_price) || item.originalPrice || item.price;
    const reference = await referenceFromHistory(monitor.id, fallback);
    const score = scorePrice(item.price, reference);
    const now = new Date().toISOString();

    const { data: snapshot, error: snapshotError } = await supabase
      .from("pricetrack_price_snapshots")
      .insert({
        monitor_id: monitor.id,
        price: item.price,
        original_price: item.originalPrice,
        available_quantity: item.availableQuantity,
        captured_at: now,
      })
      .select("id")
      .single();
    if (snapshotError) throw new Error(snapshotError.message);

    const lowest = Math.min(Number(monitor.lowest_price || item.price), item.price);
    const highest = Math.max(Number(monitor.highest_price || item.price), item.price);
    const { data: updated, error: updateError } = await supabase
      .from("pricetrack_monitors")
      .update({
        title: item.title,
        product_url: item.permalink || monitor.product_url,
        image_url: item.thumbnail || monitor.image_url,
        current_price: item.price,
        reference_price: reference,
        lowest_price: lowest,
        highest_price: highest,
        available_quantity: item.availableQuantity,
        marketplace_status: item.status,
        last_checked_at: now,
        last_error: null,
        updated_at: now,
      })
      .eq("id", monitor.id)
      .select("*")
      .single();
    if (updateError) throw new Error(updateError.message);

    const threshold = Number(monitor.alert_threshold_percent || 15);
    if (score.signal !== "normal" && score.discountPercent >= threshold) {
      const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
      const { data: recentAlert } = await supabase
        .from("pricetrack_alerts")
        .select("id,price")
        .eq("monitor_id", monitor.id)
        .gte("created_at", sixHoursAgo)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const samePrice = recentAlert && Math.abs(Number(recentAlert.price) - item.price) < 0.01;
      if (!samePrice) {
        await supabase.from("pricetrack_alerts").insert({
          monitor_id: monitor.id,
          snapshot_id: snapshot.id,
          signal: score.signal,
          discount_percent: score.discountPercent,
          score: score.score,
          price: item.price,
          reference_price: reference,
        });
      }
    }

    return { ...updated, score };
  } catch (error) {
    await supabase
      .from("pricetrack_monitors")
      .update({ last_error: error instanceof Error ? error.message : "Erro desconhecido", updated_at: new Date().toISOString() })
      .eq("id", monitor.id);
    throw error;
  }
}

export async function checkAllMonitors() {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("pricetrack_monitors")
    .select("id")
    .eq("active", true)
    .order("last_checked_at", { ascending: true, nullsFirst: true })
    .limit(50);
  if (error) throw new Error(error.message);

  const results: Array<{ id: string; ok: boolean; error?: string }> = [];
  for (const monitor of data ?? []) {
    try {
      await checkMonitor(monitor.id);
      results.push({ id: monitor.id, ok: true });
    } catch (checkError) {
      results.push({ id: monitor.id, ok: false, error: checkError instanceof Error ? checkError.message : "Erro desconhecido" });
    }
  }
  return results;
}
