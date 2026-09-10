# PriceTrack

Radar de preços para monitorar anúncios reais, guardar histórico e detectar promoções fortes ou possíveis bugs de preço.

## O que já funciona

- Cadastro por URL completa do Mercado Livre ou link curto `meli.la`.
- OAuth do Mercado Livre com PKCE e validação de `state`.
- Renovação automática do access token usando refresh token.
- Tokens do marketplace criptografados com AES-256-GCM antes de irem para o Supabase.
- Histórico de preços no Supabase.
- Referência dinâmica pela mediana das últimas 30 leituras após haver histórico suficiente.
- Score: normal, boa oferta, oferta quente e possível bug.
- Cooldown de 6 horas para não gerar alertas repetidos no mesmo preço.
- Verificação manual por produto ou de todos os monitores.
- Vercel Cron configurado para rodar de hora em hora.
- Painel protegido por `PRICE_TRACK_API_KEY`.

## Arquitetura

`Mercado Livre -> Route Handler Next.js -> Supabase -> motor de score -> alertas`

O navegador não acessa o banco diretamente. Todas as tabelas do PriceTrack têm RLS habilitada e acesso de `anon`/`authenticated` revogado; o backend usa uma Secret Key do Supabase.

## 1. Supabase

Crie ou escolha um projeto e rode `supabase/schema.sql` no SQL Editor. Depois configure:

```env
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SECRET_KEY=sb_secret_xxx
```

## 2. Chaves locais

Gere valores aleatórios. Exemplos com Node:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Use um valor para `PRICE_TRACK_API_KEY`, outro para `CRON_SECRET` e um de 32 bytes para `CREDENTIAL_ENCRYPTION_KEY`.

## 3. Aplicativo no Mercado Livre

Crie um aplicativo em Mercado Livre Developers, habilite PKCE e cadastre exatamente a URL de callback do PriceTrack:

```text
https://SEU-DOMINIO.vercel.app/api/mercadolivre/callback
```

Depois configure:

```env
MELI_CLIENT_ID=
MELI_CLIENT_SECRET=
MELI_REDIRECT_URI=https://SEU-DOMINIO.vercel.app/api/mercadolivre/callback
APP_URL=https://SEU-DOMINIO.vercel.app
```

O access token do Mercado Livre expira em poucas horas; o PriceTrack guarda e troca automaticamente o refresh token pelo novo par de tokens.

## 4. Cron

Configure `CRON_SECRET` na Vercel. O `vercel.json` chama `GET /api/cron/check` de hora em hora. O handler aceita somente `Authorization: Bearer <CRON_SECRET>`.

## 5. Uso

1. Abra o painel e informe a mesma `PRICE_TRACK_API_KEY` configurada na Vercel.
2. Clique em **Conectar Mercado Livre** e autorize o aplicativo.
3. Cole um link de anúncio e clique em **Monitorar**.
4. O preço inicial é salvo imediatamente.
5. A cada nova leitura o histórico e a referência são recalculados.

## Score atual

- 0–14%: preço normal
- 15–34%: boa oferta
- 35–64%: oferta quente
- 65%+: possível bug

O rótulo “possível bug” é heurístico. Não garante que a loja honrará o preço nem que o anúncio seja válido.

## Próximas fases

- Alertas reais via WhatsApp/Evolution API.
- Página de histórico/gráfico por produto.
- Categorias e descoberta automática, sem cadastrar URL por URL.
- Amazon e Shopee usando integrações permitidas para cada plataforma.
- Autenticação multiusuário e planos SaaS.
