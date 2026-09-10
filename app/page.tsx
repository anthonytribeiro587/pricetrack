"use client";

import Image from "next/image";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type PriceSignal = "normal" | "deal" | "hot" | "possible_bug";
type Monitor = {
  id: string;
  title: string;
  item_id: string;
  product_url: string;
  image_url: string | null;
  current_price: number | string;
  reference_price: number | string;
  lowest_price: number | string;
  marketplace_status: string;
  active: boolean;
  available_quantity: number | null;
  last_checked_at: string | null;
  last_error: string | null;
  score: { signal: PriceSignal; discountPercent: number; score: number; label: string };
};

type MeliStatus = { connected: boolean; externalUserId?: number | null; expiresAt?: string | null; error?: string };

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function formatMoney(value: number | string) {
  return money.format(Number(value || 0));
}

function formatDate(value: string | null) {
  if (!value) return "Nunca";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function signalClass(signal: PriceSignal) {
  return `signal signal-${signal.replace("_", "-")}`;
}

export default function Home() {
  const [apiKey, setApiKey] = useState("");
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [meli, setMeli] = useState<MeliStatus>({ connected: false });
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const api = useCallback(async (path: string, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    if (apiKey) headers.set("x-pricetrack-key", apiKey);
    if (init?.body) headers.set("content-type", "application/json");
    const response = await fetch(path, { ...init, headers, cache: "no-store" });
    const body = await response.json().catch(async () => ({ error: await response.text().catch(() => "Erro inesperado") }));
    if (!response.ok) throw new Error(body?.error || `HTTP ${response.status}`);
    return body;
  }, [apiKey]);

  const refresh = useCallback(async () => {
    if (!apiKey && process.env.NODE_ENV === "production") return;
    try {
      const [monitorData, meliData] = await Promise.all([
        api("/api/monitors"),
        api("/api/mercadolivre/status"),
      ]);
      setMonitors(monitorData.monitors || []);
      setMeli(meliData);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao carregar o painel.");
    }
  }, [api, apiKey]);

  useEffect(() => {
    setApiKey(window.localStorage.getItem("pricetrack-key") || "");
  }, []);

  useEffect(() => {
    if (apiKey || process.env.NODE_ENV !== "production") void refresh();
  }, [apiKey, refresh]);

  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get("meli");
    if (status === "connected") setMessage("Mercado Livre conectado com sucesso.");
    if (status === "error") setMessage("Não foi possível concluir a conexão com o Mercado Livre.");
    if (status === "invalid_state") setMessage("A conexão expirou ou o estado OAuth não confere. Tente novamente.");
  }, []);

  const stats = useMemo(() => {
    const alerts = monitors.filter((item) => item.score.signal !== "normal").length;
    const bugs = monitors.filter((item) => item.score.signal === "possible_bug").length;
    const maxDiscount = monitors.length ? Math.max(...monitors.map((item) => item.score.discountPercent)) : 0;
    return { alerts, bugs, maxDiscount };
  }, [monitors]);

  function saveKey(value: string) {
    setApiKey(value);
    window.localStorage.setItem("pricetrack-key", value);
  }

  async function connectMeli() {
    setLoading(true);
    setMessage(null);
    try {
      const data = await api("/api/mercadolivre/connect");
      window.location.href = data.authorizationUrl;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao conectar Mercado Livre.");
      setLoading(false);
    }
  }

  async function addMonitor(event: FormEvent) {
    event.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setMessage(null);
    try {
      await api("/api/monitors", { method: "POST", body: JSON.stringify({ url }) });
      setUrl("");
      setMessage("Produto adicionado ao radar.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao adicionar produto.");
    } finally {
      setLoading(false);
    }
  }

  async function checkOne(id: string) {
    setChecking(id);
    setMessage(null);
    try {
      await api(`/api/monitors/${id}/check`, { method: "POST" });
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao verificar preço.");
    } finally {
      setChecking(null);
    }
  }

  async function checkAll() {
    setChecking("all");
    setMessage(null);
    try {
      const data = await api("/api/monitors/check-all", { method: "POST" });
      const failed = (data.results || []).filter((item: { ok: boolean }) => !item.ok).length;
      setMessage(failed ? `Verificação concluída com ${failed} erro(s).` : "Todos os monitores foram atualizados.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao verificar produtos.");
    } finally {
      setChecking(null);
    }
  }

  async function removeMonitor(id: string) {
    if (!window.confirm("Remover este produto do radar?")) return;
    try {
      await api(`/api/monitors/${id}`, { method: "DELETE" });
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao remover produto.");
    }
  }

  return (
    <main className="shell">
      <aside className="sidebar">
        <div>
          <div className="brand"><span className="brand-mark">↘</span><span>PriceTrack</span></div>
          <nav className="nav">
            <a className="active" href="#dashboard">Visão geral</a>
            <a href="#novo">Novo monitor</a>
            <a href="#monitors">Monitores</a>
            <a href="#marketplaces">Marketplaces</a>
          </nav>
        </div>
        <div className="sidebar-foot">
          <label className="key-label" htmlFor="api-key">Chave do painel</label>
          <input id="api-key" className="key-input" type="password" value={apiKey} placeholder="PRICE_TRACK_API_KEY" onChange={(event) => saveKey(event.target.value)} />
          <span className="tiny">Fica salva somente neste navegador.</span>
        </div>
      </aside>

      <section className="content" id="dashboard">
        <header className="topbar">
          <div>
            <p className="eyebrow">RADAR DE OPORTUNIDADES</p>
            <h1>Preço baixo não passa despercebido.</h1>
            <p className="subtitle">Cole um anúncio do Mercado Livre. O PriceTrack salva o histórico, recalcula a referência e procura quedas fora do normal.</p>
          </div>
          <button className="secondary" onClick={checkAll} disabled={checking === "all" || !meli.connected}>{checking === "all" ? "Verificando…" : "↻ Verificar todos"}</button>
        </header>

        {message && <div className="notice">{message}</div>}

        <section className="stats">
          <article className="stat-card"><span>Produtos monitorados</span><strong>{monitors.length}</strong><small>Ativos no radar</small></article>
          <article className="stat-card"><span>Ofertas detectadas</span><strong>{stats.alerts}</strong><small>Queda atual acima de 15%</small></article>
          <article className="stat-card accent"><span>Possíveis bugs</span><strong>{stats.bugs}</strong><small>Queda atual acima de 65%</small></article>
          <article className="stat-card"><span>Maior queda agora</span><strong>{stats.maxDiscount.toFixed(0)}%</strong><small>Contra a referência</small></article>
        </section>

        <section className="grid-top">
          <article className="panel compact" id="novo">
            <p className="eyebrow">NOVO MONITOR</p>
            <h2>Cole o link do anúncio</h2>
            <p className="panel-copy">Use a URL completa do anúncio ou um link curto meli.la.</p>
            <form className="monitor-form" onSubmit={addMonitor}>
              <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://produto.mercadolivre.com.br/MLB-..." disabled={!meli.connected || loading} />
              <button className="primary" disabled={!meli.connected || loading || !url.trim()}>{loading ? "Salvando…" : "+ Monitorar"}</button>
            </form>
          </article>

          <article className="panel compact connection" id="marketplaces">
            <p className="eyebrow">MARKETPLACE</p>
            <div className="connection-head">
              <div><h2>Mercado Livre</h2><p className="panel-copy">OAuth com renovação automática do token.</p></div>
              <span className={meli.connected ? "connection-pill online" : "connection-pill"}><span className="status-dot" /> {meli.connected ? "Conectado" : "Desconectado"}</span>
            </div>
            <button className={meli.connected ? "secondary" : "primary"} onClick={connectMeli} disabled={loading}>{meli.connected ? "Reconectar conta" : "Conectar Mercado Livre"}</button>
          </article>
        </section>

        <section className="panel" id="monitors">
          <div className="panel-head"><div><p className="eyebrow">MONITORAMENTO REAL</p><h2>Produtos no radar</h2></div><span className="live"><span className="status-dot" /> cron horário</span></div>
          {monitors.length === 0 ? (
            <div className="empty-state"><strong>Nenhum produto ainda.</strong><span>{meli.connected ? "Cole o primeiro link acima para começar." : "Conecte o Mercado Livre para começar."}</span></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Produto</th><th>Referência</th><th>Agora</th><th>Queda</th><th>Sinal</th><th>Última leitura</th><th /></tr></thead>
                <tbody>
                  {monitors.map((product) => (
                    <tr key={product.id}>
                      <td><div className="product-cell">{product.image_url ? <Image src={product.image_url} alt="" width={46} height={46} unoptimized /> : <div className="product-placeholder">ML</div>}<div><a className="product-name" href={product.product_url} target="_blank" rel="noreferrer">{product.title}</a><small>{product.item_id} · score {product.score.score}/100</small>{product.last_error && <small className="row-error">{product.last_error}</small>}</div></div></td>
                      <td className="muted-price">{formatMoney(product.reference_price)}</td>
                      <td className="current-price">{formatMoney(product.current_price)}</td>
                      <td>{product.score.discountPercent > 0 ? `-${product.score.discountPercent.toFixed(0)}%` : "—"}</td>
                      <td><span className={signalClass(product.score.signal)}>{product.score.label}</span></td>
                      <td className="date-cell">{formatDate(product.last_checked_at)}</td>
                      <td><div className="row-actions"><button className="icon-button" title="Verificar agora" onClick={() => checkOne(product.id)} disabled={checking === product.id}>↻</button><button className="icon-button danger" title="Remover" onClick={() => removeMonitor(product.id)}>×</button></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="grid-bottom">
          <article className="panel compact"><p className="eyebrow">COMO O ROBÔ DECIDE</p><h2>Score de oportunidade</h2><div className="score-list"><div><span className="score-dot normal" /><b>0–14%</b><span>Preço normal</span></div><div><span className="score-dot deal" /><b>15–34%</b><span>Boa oferta</span></div><div><span className="score-dot hot" /><b>35–64%</b><span>Oferta quente</span></div><div><span className="score-dot bug" /><b>65%+</b><span>Possível bug</span></div></div></article>
          <article className="panel compact"><p className="eyebrow">REFERÊNCIA DINÂMICA</p><h2>Ele aprende com o histórico</h2><p className="panel-copy">Após três leituras, a referência passa a usar a mediana das últimas 30 capturas. Isso reduz falsos descontos causados por preço artificialmente inflado.</p><div className="chips"><span>Histórico</span><span>Mediana</span><span>Cooldown 6h</span><span>Até 50 itens/rodada</span></div></article>
        </section>
      </section>
    </main>
  );
}
