import { useEffect, useState } from 'react'

const FINESTRE = [
  { key: 'week', label: '1S' },
  { key: 'month', label: '1M' },
  { key: '3m', label: '3M' },
  { key: '6m', label: '6M' },
  { key: 'ytd', label: 'YTD' },
]

const TIPO_COLOR = { '3a': '#ffe082', '3b': '#ffb74d', '3d': '#ff6b6b' }

function assignIds(flagEvents) {
  const counters = {}
  return flagEvents.map(f => {
    counters[f.tipo] = (counters[f.tipo] || 0) + 1
    return { ...f, id: `${f.tipo}.${counters[f.tipo]}` }
  })
}

function nearestIdxForTime(dates, targetMs) {
  let best = 0, bestDiff = Infinity
  dates.forEach((d, i) => {
    const diff = Math.abs(new Date(d).getTime() - targetMs)
    if (diff < bestDiff) { bestDiff = diff; best = i }
  })
  return best
}

function layoutLabels(markers, xThreshold = 22) {
  const sorted = [...markers].sort((a, b) => a.x - b.x)
  let clusterStart = 0
  return sorted.map((m, i) => {
    if (i > 0 && m.x - sorted[i - 1].x > xThreshold) clusterStart = i
    return { ...m, labelOffset: 10 + (i - clusterStart) * 13 }
  })
}

function LineChart({ dates, values, flagEventsWithId }) {
  if (!values.length) return <p>Nessun dato per questa finestra.</p>

  const w = 700, h = 300, pad = 40
  const min = Math.min(...values), max = Math.max(...values)
  const range = max - min || 1

  function xAt(i) { return pad + (i / (values.length - 1)) * (w - pad * 2) }
  function yAt(v) { return h - pad - ((v - min) / range) * (h - pad * 2) }

  const points = values.map((v, i) => `${xAt(i)},${yAt(v)}`).join(' ')
  const gridLevels = [0, 0.25, 0.5, 0.75, 1].map(t => min + range * t)
  const showBaseline = 100 >= min && 100 <= max

  const nTicks = Math.min(5, dates.length)
  const startMs = new Date(dates[0]).getTime()
  const endMs = new Date(dates[dates.length - 1]).getTime()
  const tickIdxs = Array.from({ length: nTicks }, (_, i) => {
    const targetMs = startMs + (i / (nTicks - 1 || 1)) * (endMs - startMs)
    return nearestIdxForTime(dates, targetMs)
  })

  const rawMarkers = flagEventsWithId
    .map(f => {
      const idx = dates.indexOf(f.data_evento)
      if (idx === -1 || values[idx] == null) return null
      return { ...f, x: xAt(idx), y: yAt(values[idx]) }
    })
    .filter(Boolean)
  const markers = layoutLabels(rawMarkers)

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 'auto' }}>
      {gridLevels.map((lvl, i) => (
        <g key={i}>
          <line x1={pad} x2={w - pad} y1={yAt(lvl)} y2={yAt(lvl)} stroke="#2a2d35" strokeWidth="1" />
          <text x={2} y={yAt(lvl) + 4} fill="#888" fontSize="10">{lvl.toFixed(1)}</text>
        </g>
      ))}

      {tickIdxs.map((idx, i) => (
        <g key={i}>
          <line x1={xAt(idx)} x2={xAt(idx)} y1={pad - 10} y2={h - pad} stroke="#1e2128" strokeWidth="1" />
          <text x={xAt(idx)} y={h - pad + 16} fill="#888" fontSize="9" textAnchor="middle">
            {dates[idx]?.slice(5)}
          </text>
        </g>
      ))}

      {showBaseline && (
        <line x1={pad} x2={w - pad} y1={yAt(100)} y2={yAt(100)} stroke="#555" strokeWidth="1" strokeDasharray="4,4" />
      )}

      <polyline points={points} fill="none" stroke="#4f9eff" strokeWidth="2" />

      {markers.map((m, i) => (
        <g key={i}>
          <circle cx={m.x} cy={m.y} r="4" fill={TIPO_COLOR[m.tipo] || '#fff'} stroke="#0f1115" strokeWidth="1" />
          <text x={m.x} y={m.y - m.labelOffset} fill={TIPO_COLOR[m.tipo] || '#fff'} fontSize="9" textAnchor="middle">
            {m.id}
          </text>
        </g>
      ))}
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

      {data && (() => {
        const flagEventsWithId = assignIds(data.flag_eventi)
        return (
          <>
            <h2 style={{ fontSize: 15, marginBottom: 8 }}>Portafoglio ponderato (base 100, linea tratteggiata)</h2>
            <LineChart
              dates={data.portafoglio_ponderato.dates}
              values={data.portafoglio_ponderato.valori_euro}
              flagEventsWithId={flagEventsWithId}
            />
            <p style={{ fontSize: 12, color: '#888', marginTop: 8 }}>
              ● giallo = 3a, drawdown lieve (5–10%) · ● arancio = 3b, moderato (10–20%) · ● rosso = 3d, severo (≥20%)
            </p>
            <p style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
              Ogni flag è una sequenza confermata picco→valle: il calo deve recuperare per almeno 2 giorni consecutivi prima di chiudersi come evento.
            </p>

            {flagEventsWithId.length > 0 && (
              <section style={{ marginTop: 24 }}>
                <h2 style={{ fontSize: 15, marginBottom: 8 }}>Flag eventi</h2>
                {flagEventsWithId.map((f, i) => (
                  <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid #2a2d35', fontSize: 14 }}>
                    <span style={{ color: TIPO_COLOR[f.tipo], fontWeight: 600 }}>{f.id}</span>
                    {' — '}{f.ticker || 'portafoglio'} — {f.valore_pct}% ({f.data_evento})
                  </div>
                ))}
              </section>
            )}
          </>
        )
      })()}
    </div>
  )
}
