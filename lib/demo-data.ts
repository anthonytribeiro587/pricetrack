import { scorePrice } from "./pricing";

export const monitoredProducts = [
  { name: "PlayStation 5 Slim", marketplace: "Amazon", reference: 3399, current: 2799 },
  { name: "iPhone 16 128 GB", marketplace: "Mercado Livre", reference: 5299, current: 4449 },
  { name: "Smart TV 55\" 4K", marketplace: "Shopee", reference: 2499, current: 1299 },
  { name: "Notebook Gamer RTX", marketplace: "Amazon", reference: 6499, current: 2199 },
].map((product) => ({ ...product, result: scorePrice(product.current, product.reference) }));
