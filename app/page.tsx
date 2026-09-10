import { monitoredProducts } from "@/lib/demo-data";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function signalClass(signal: string) {
  return `signal signal-${signal.replace("_", "-")}`;
}

export default function Home() {
  const alerts = monitoredProducts.filter((item) => item.result.signal !== "normal").length;
  const possibleBugs = monitoredProducts.filter((item) => item.result.signal === "possible_bug").length;

  return (
    <main className="shell">
      <aside className="sidebar">
        <div>
          <div className="brand"><span className="brand-mark">↘</span><span>PriceTrack</span></div>
          <nav className="nav">
            <a className="active" href="#dashboard">Visão geral</a>
            <a href="#monitors">Monitores</a>
            <a href="#alerts">Alertas</a>
            <a href="#marketplaces">Marketplaces</a>
          </nav>
        </div>
        <div className="sidebar-foot">
          <span className="status-dot" /> Motor de monitoramento pronto
        </div>
      </aside>

      <section className="content" id="dashboard">
        <header className="topbar">
          <div>
            <p className="eyebrow">RADAR DE OPORTUNIDADES</p>
            <h1>Encontre o preço antes de todo mundo.</h1>
            <p className="subtitle">Acompanhe quedas reais, promoções fortes e anomalias que podem indicar bug de preço.</p>
          </div>
          <button className="primary">+ Novo monitor</button>
        </header>

        <section className="stats">
          <article className="stat-card"><span>Produtos monitorados</span><strong>{monitoredProducts.length}</strong><small>Demo inicial</small></article>
          <article className="stat-card"><span>Alertas ativos</span><strong>{alerts}</strong><small>Acima de 15% de queda</small></article>
          <article className="stat-card accent"><span>Possíveis bugs</span><strong>{possibleBugs}</strong><small>Queda acima de 65%</small></article>
          <article className="stat-card"><span>Maior desconto</span><strong>{Math.max(...monitoredProducts.map((p) => Math.round(p.result.discountPercent)))}%</strong><small>Nas últimas leituras</small></article>
        </section>

        <section className="panel" id="monitors">
          <div className="panel-head">
            <div><p className="eyebrow">MONITORAMENTO</p><h2>Produtos no radar</h2></div>
            <span className="live"><span className="status-dot" /> ao vivo</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Produto</th><th>Marketplace</th><th>Referência</th><th>Agora</th><th>Queda</th><th>Sinal</th></tr></thead>
              <tbody>
                {monitoredProducts.map((product) => (
                  <tr key={product.name}>
                    <td><div className="product-name">{product.name}</div><small>Score {product.result.score}/100</small></td>
                    <td>{product.marketplace}</td>
                    <td className="muted-price">{money.format(product.reference)}</td>
                    <td className="current-price">{money.format(product.current)}</td>
                    <td>-{product.result.discountPercent.toFixed(0)}%</td>
                    <td><span className={signalClass(product.result.signal)}>{product.result.label}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid-bottom">
          <article className="panel compact" id="alerts">
            <p className="eyebrow">COMO O ROBÔ DECIDE</p>
            <h2>Score de oportunidade</h2>
            <div className="score-list">
              <div><span className="score-dot normal" /><b>0–14%</b><span>Preço normal</span></div>
              <div><span className="score-dot deal" /><b>15–34%</b><span>Boa oferta</span></div>
              <div><span className="score-dot hot" /><b>35–64%</b><span>Oferta quente</span></div>
              <div><span className="score-dot bug" /><b>65%+</b><span>Possível bug</span></div>
            </div>
          </article>
          <article className="panel compact" id="marketplaces">
            <p className="eyebrow">PRÓXIMA ETAPA</p>
            <h2>Conectar coletores</h2>
            <p className="panel-copy">A base já está preparada para receber preços de APIs oficiais, feeds ou coletores específicos de cada marketplace e salvar o histórico no Supabase.</p>
            <div className="chips"><span>Mercado Livre</span><span>Amazon</span><span>Shopee</span></div>
          </article>
        </section>
      </section>
    </main>
  );
}
