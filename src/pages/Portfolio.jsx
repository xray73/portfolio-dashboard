import { useEffect, useState } from 'react'

export default function Portfolio() {
  const [portfolio, setPortfolio] = useState(null)
  const [ytd, setYtd] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/portfolio').then(r => r.json()),
      fetch('/api/ytd').then(r => r.json()),
    ])
      .then(([p, y]) => {
        setPortfolio(p)
        setYtd(y)
      })
      .catch(err => setError(err.message))
  }, [])

  if (error) return <div><h1>Portfolio</h1><p style={{ color: '#ff6b6b' }}>{error}</p></div>
  if (!portfolio || !ytd) return <div><h1>Portfolio</h1><p>Caricamento...</p></div>

  const ytdMap = {}
  ytd.etf.forEach(e => { ytdMap[e.ticker] = e })
  const ytdPortafoglio = ytd.etf.reduce((acc, e) => acc + (e.contributo_ponderato || 0), 0)

  return (
    <div>
      <h1>Portfolio</h1>

      <div style={{
        background: '#181b21', border: '1px solid #2a2d35', borderRadius: 10,
        padding: 16, marginBottom: 16,
      }}>
        <div style={{ fontSize: 13, color: '#888', marginBottom: 6 }}>YTD portafoglio (ponderato)</div>
        <div style={{ fontSize: 22, fontWeight: 600, color: ytdPortafoglio >= 0 ? '#4caf50' : '#ff6b6b' }}>
          {ytdPortafoglio >= 0 ? '+' : ''}{ytdPortafoglio.toFixed(2)}%
        </div>
      </div>

      <section>
        {portfolio.portafoglio.map((p, i) => {
          const y = ytdMap[p.ticker]
          return (
            <div key={i} style={{ padding: '12px 0', borderBottom: '1px solid #2a2d35' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong>{p.ticker}</strong>
                <span>{p.categoria}</span>
              </div>
              <div style={{ fontSize: 13, color: '#888' }}>{p.nome}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <span>Peso target: {p.peso_target}%</span>
                <span style={{ color: y?.ytd_pct >= 0 ? '#4caf50' : '#ff6b6b' }}>
                  YTD: {y?.ytd_pct != null ? `${y.ytd_pct}%` : '—'}
                </span>
              </div>
              <div style={{ fontSize: 13, color: '#888' }}>
                Prezzo: {p.prezzo_attuale != null ? `€${p.prezzo_attuale}` : '—'}
              </div>
            </div>
          )
        })}
      </section>
    </div>
  )
}
