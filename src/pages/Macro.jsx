import { useEffect, useState } from 'react'

const SCENARIO_LABELS = {
  base: 'Base',
  stagflaz: 'Stagflazionistico',
  recessivo: 'Recessivo',
  reflaz: 'Reflazionistico',
}

function statoColor(stato) {
  if (stato?.includes('ALERT')) return '#ff6b6b'
  if (stato?.includes('VICINO')) return '#ffb74d'
  return '#4caf50'
}

export default function Macro() {
  const [macro, setMacro] = useState(null)
  const [scenario, setScenario] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/macro').then(r => r.json()),
      fetch('/api/scenario').then(r => r.json()),
    ])
      .then(([m, s]) => { setMacro(m); setScenario(s) })
      .catch(err => setError(err.message))
  }, [])

  if (error) return <div><h1>Macro</h1><p style={{ color: '#ff6b6b' }}>{error}</p></div>
  if (!macro || !scenario) return <div><h1>Macro</h1><p>Caricamento...</p></div>

  const nomiAlert = macro.parametri.filter(p => p.stato?.includes('ALERT')).map(p => p.nome)
  const nomiVicino = macro.parametri.filter(p => p.stato?.includes('VICINO')).map(p => p.nome)

  return (
    <div>
      <h1>Macro</h1>

      <section style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 13, color: '#888', marginBottom: 4 }}>
          {macro.alert_count.alert} alert · {macro.alert_count.vicino} in sorveglianza · {macro.alert_count.ok} ok
        </div>
        {nomiAlert.length > 0 && (
          <div style={{ color: '#ff6b6b', fontSize: 14, marginTop: 4 }}>Alert: {nomiAlert.join(', ')}</div>
        )}
        {nomiVicino.length > 0 && (
          <div style={{ color: '#ffb74d', fontSize: 14, marginTop: 2 }}>Sorveglianza: {nomiVicino.join(', ')}</div>
        )}
      </section>

      <section style={{ marginBottom: 24 }}>
        {macro.parametri.map((p, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #2a2d35' }}>
            <span>{p.nome}</span>
            <span style={{ color: statoColor(p.stato) }}>{p.valore} · {p.stato}</span>
          </div>
        ))}
      </section>

      <section>
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>Scenari</h2>
        {scenario.scenari.map((s, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #2a2d35' }}>
            <span>{SCENARIO_LABELS[s.scenario] || s.scenario}</span>
            <span>{s.probabilita_pct}%</span>
          </div>
        ))}
      </section>
    </div>
  )
}
