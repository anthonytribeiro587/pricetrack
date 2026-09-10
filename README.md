# PriceTrack

Radar de preços para acompanhar produtos, promoções fortes e possíveis bugs em marketplaces.

## MVP atual

- Dashboard responsivo com produtos monitorados.
- Motor de score por percentual de queda.
- Endpoint `POST /api/score` para classificar uma leitura.
- Endpoint `GET /api/health` para health check.
- Cliente Supabase preparado por variáveis de ambiente.
- Schema inicial com monitores, histórico de preços e alertas, RLS e grants explícitos.

## Score inicial

- 0–14%: preço normal
- 15–34%: boa oferta
- 35–64%: oferta quente
- 65%+: possível bug

O score é apenas um primeiro filtro. A próxima fase deve considerar histórico, mediana, concorrentes, frete, estoque e confiabilidade do anúncio antes de disparar um alerta de bug.

## Rodar localmente

```bash
npm install
cp .env.example .env.local
npm run dev
```

Use Node.js 22 ou superior.

## Supabase

Quando escolhermos o projeto Supabase do PriceTrack, configure:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
CRON_SECRET=
```

Depois execute `supabase/schema.sql` no SQL Editor. O schema usa RLS e grants explícitos para os usuários autenticados.

## Próximas fases

1. Cadastro real de monitores.
2. Autenticação.
3. Adaptadores de coleta por marketplace, priorizando APIs oficiais e métodos permitidos.
4. Histórico e preço de referência dinâmico.
5. Cron de verificação.
6. Alertas via WhatsApp/Evolution API.
7. Score antifalso-positivo para bugs de preço.
