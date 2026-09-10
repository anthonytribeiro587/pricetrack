export type PriceSignal = "normal" | "deal" | "hot" | "possible_bug";

export type PriceScore = {
  signal: PriceSignal;
  discountPercent: number;
  score: number;
  label: string;
};

export function scorePrice(currentPrice: number, referencePrice: number): PriceScore {
  if (!Number.isFinite(currentPrice) || !Number.isFinite(referencePrice) || currentPrice <= 0 || referencePrice <= 0) {
    throw new Error("Prices must be positive numbers.");
  }

  const discountPercent = Math.max(0, ((referencePrice - currentPrice) / referencePrice) * 100);
  const score = Math.min(100, Math.round(discountPercent * 1.25));

  if (discountPercent >= 65) {
    return { signal: "possible_bug", discountPercent, score, label: "Possível bug" };
  }

  if (discountPercent >= 35) {
    return { signal: "hot", discountPercent, score, label: "Oferta quente" };
  }

  if (discountPercent >= 15) {
    return { signal: "deal", discountPercent, score, label: "Boa oferta" };
  }

  return { signal: "normal", discountPercent, score, label: "Preço normal" };
}
