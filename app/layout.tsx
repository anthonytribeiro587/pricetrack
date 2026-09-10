import type { Metadata } from "next";
import "./globals.css";
import "./dashboard-extra.css";

export const metadata: Metadata = {
  title: "PriceTrack — Radar de preços",
  description: "Monitore preços, promoções fortes e possíveis bugs em marketplaces.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
