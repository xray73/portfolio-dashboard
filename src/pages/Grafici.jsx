import { useEffect, useState } from 'react'

const FINESTRE = [
  { key: 'week', label: '1S' },
  { key: 'month', label: '1M' },
  { key: '3m', label: '3M' },
  { key: '6m', label: '6M' },
  { key: 'ytd', label: 'YTD' },
]

function LineChart({ dates, values, flagEvents }) {
  if (!values.length) return <p>Nessun dato per questa finestra.</p>

  const w = 700, h = 260, pad = 40
  const min = Math.min(...values), max = Math.max(...values)
  const range = max - min || 1

  function xAt(i) { return pad + (i / (values.length - 1)) * (w - pad * 2) }
  function yAt(v) { return h - pad - ((v - min) / range) * (h - pad * 2) }

  const points = values.map((v, i) => `${xAt(i)},${yAt(v)}`).join(' ')

  const gridLevels = [0, 0.25, 0.5, 0.75, 1].map(t => min + range * t)

  const markers = (flagEvents || [])
    .map(f => {
      const idx = dates.indexOf(f.data_evento)
      if (idx === -1 || values[idx] == null) return null
      return { ...f, x: xAt(idx), y: yAt(values[idx]) }
    })
    .filter(Boolean)

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 'auto' }}>
      {gridLevels.map((lvl, i) => (
        <g key={i}>
          <line x1={pad} x2={w - pad} y1={yAt(lvl)} y2={yAt(lvl)} stroke="#2a2d35" strokeWidth="1" />
          <text x={2} y={yAt(lvl) + 4} fill="#888" fontSize="10">{lvl.toFixed(1)}</text>
        </g>
      ))}

      <polyline points={points} fill="none" stroke="#4f9eff" strokeWidth="2" />

      {markers.map((m, i) => (
        <g key={i}>
          <circle cx={m.x} cy={m.y} r="4" fill={m.tipo === '3d' ? '#ff6b6b' : m.tipo === '3b' ? '#ffb74d' : '#ffe082'} stroke="#0f1115" strokeWidth="1" />
        </g>
      ))}

      <text x={pad} y={h - 6} fill="#888" fontSize="11">{dates[0]}</text>
      <text x={w - pad - 60} y={h - 6} fill="#888" fontSize="11">{dates[dates.length - 1]}</text>
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
          <LineChart
            dates={data.portafoglio_ponderato.dates}
            values={data.portafoglio_ponderato.valori_euro}
            flagEvents={data.flag_eventi}
          />
          <p style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
            ● giallo = 3a (lieve) · ● arancio = 3b (moderato) · ● rosso = 3d (severo)
          </p>

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
