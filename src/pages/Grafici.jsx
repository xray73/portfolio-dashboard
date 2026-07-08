import { useEffect, useState } from 'react'

const FINESTRE = [
  { key: 'week', label: '1S' },
  { key: 'month', label: '1M' },
  { key: '3m', label: '3M' },
  { key: '6m', label: '6M' },
  { key: 'ytd', label: 'YTD' },
]

function LineChart({ dates, values }) {
  if (!values.length) return <p>Nessun dato per questa finestra.</p>

  const w = 700, h = 220, pad = 30
  const min = Math.min(...values), max = Math.max(...values)
  const range = max - min || 1

  const points = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (w - pad * 2)
    const y = h - pad - ((v - min) / range) * (h - pad * 2)
    return `${x},${y}`
  }).join(' ')

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 'auto' }}>
      <polyline points={points} fill="none" stroke="#4f9eff" strokeWidth="2" />
      <text x={pad} y={h - 8} fill="#888" fontSize="11">{dates[0]}</text>
      <text x={w - pad - 60} y={h - 8} fill="#888" fontSize="11">{dates[dates.length - 1]}</text>
      <text x={pad} y={16} fill="#888" fontSize="11">{max.toFixed(1)}</text>
      <text x={pad} y={h - pad + 4} fill="#888" fontSize="11">{min.toFixed(1)}</text>
    </svg>
  )
}

export default function Grafici() {
  const [finestra, setFinestra] = useState('6m')
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    setData(null)
    fetch(`/api/chart_data?finestra=${finestra}`)
      .then(r => r.json())
      .then(setData)
      .catch(err => setError(err.message))
  }, [finestra])

  return (
    <div>
      <h1>Grafici</h1>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {FINESTRE.map(f => (
          <button
            key={f.key}
            onClick={() => setFinestra(f.key)}
            style={{
              padding: '6px 14px',
              background: finestra === f.key ? '#4f9eff' : 'transparent',
              color: finestra === f.key ? '#fff' : '#888',
              border: '1px solid #2a2d35',
              borderRadius: 6,
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <p style={{ color: '#ff6b6b' }}>{error}</p>}
      {!data && !error && <p>Caricamento...</p>}

      {data && (
        <>
          <h2 style={{ fontSize: 15, marginBottom: 8 }}>Portafoglio ponderato (base 100)</h2>
          <LineChart dates={data.portafoglio_ponderato.dates} values={data.portafoglio_ponderato.valori_euro.filter(v => v != null)} />

          {data.flag_eventi.length > 0 && (
            <section style={{ marginTop: 24 }}>
              <h2 style={{ fontSize: 15, marginBottom: 8 }}>Flag eventi</h2>
              {data.flag_eventi.map((f, i) => (
                <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid #2a2d35', fontSize: 14 }}>
                  {f.tipo} — {f.ticker || 'portafoglio'} — {f.valore_pct}% ({f.data_evento})
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  )
}
