import { useEffect, useState } from 'react'

const SCENARIO_LABELS = {
  base: 'Base',
  stagflaz: 'Stagflazionistico',
  recessivo: 'Recessivo',
  reflaz: 'Reflazionistico',
}

export default function Home() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [showIrr, setShowIrr] = useState(false)
  const [irrData, setIrrData] = useState(null)
  const [irrLoading, setIrrLoading] = useState(false)

  useEffect(() => {
    fetch('/api/dashboard')
      .then(res => {
        if (!res.ok) throw new Error('Errore caricamento dati')
        return res.json()
      })
      .then(setData)
      .catch(err => setError(err.message))
  }, [])

  function toggleIrr() {
    if (showIrr) {
      setShowIrr(false)
      return
    }
    setShowIrr(true)
    if (!irrData) {
      setIrrLoading(true)
      fetch('/api/performance')
        .then(res => res.json())
        .then(setIrrData)
        .finally(() => setIrrLoading(false))
    }
  }

  if (error) return <div><h1>Home</h1><p style={{ color: '#ff6b6b' }}>{error}</p></div>
  if (!data) return <div><h1>Home</h1><p>Caricamento...</p></div>

  const scenarioLabel = SCENARIO_LABELS[data.scenario_prevalente?.scenario] || data.scenario_prevalente?.scenario
  const flagPiuRecente = data.flag_recenti?.[0]

  return (
    <div>
      <h1>Home</h1>
      <section style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: '#888' }}>Scenario prevalente</div>
        <div style={{ fontSize: 20, fontWeight: 600 }}>
          {scenarioLabel} ({data.scenario_prevalente?.probabilita_pct}%)
        </div>
      </section>

      <section style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: '#888' }}>Alert macro</div>
        <div>
          {data.alert_macro.alert} alert · {data.alert_macro.vicino} in sorveglianza · {data.alert_macro.ok} ok
        </div>
      </section>

      <section style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: '#888' }}>Capitale</div>
        <div>Versato: €{data.capitale.totale_versato.toLocaleString('it-IT')}</div>
        <div>Stimato: €{data.capitale.valore_stimato.toLocaleString('it-IT')}</div>
        <div style={{ color: data.capitale.gain_loss_eur >= 0 ? '#4caf50' : '#ff6b6b' }}>
          Gain/Loss: €{data.capitale.gain_loss_eur.toLocaleString('it-IT')} ({data.capitale.gain_loss_pct}%)
        </div>
        <div style={{ fontSize: 13, color: '#888' }}>
          Gap vs €140.557 (2036): €{data.capitale.gap_vs_140557.toLocaleString('it-IT')}
        </div>
      </section>

      <section style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: '#888' }}>Flag più recente</div>
        {flagPiuRecente ? (
          <div>
            {flagPiuRecente.tipo} — {flagPiuRecente.ticker || 'portafoglio'} — {flagPiuRecente.valore_pct}%
            {' '}({flagPiuRecente.data_evento})
          </div>
        ) : (
          <div>Nessun flag</div>
        )}
      </section>

      <button onClick={toggleIrr}>
        {showIrr ? 'Nascondi IRR' : 'Mostra IRR reale vs teorico'}
      </button>

      {showIrr && (
        <section style={{ marginTop: 16 }}>
          {irrLoading && <p>Caricamento...</p>}
          {irrData && irrData.stato === 'dati_insufficienti' && (
            <div>
              <p>Dati insufficienti per IRR reale.</p>
              <p>IRR teorico piano: {(irrData.irr_teorico_piano.nominale * 100).toFixed(2)}% nominale</p>
            </div>
          )}
          {irrData && irrData.stato === 'ok' && (
            <div>
              <div>IRR reale: {(irrData.irr_reale.nominale * 100).toFixed(2)}% nominale</div>
              <div>IRR teorico: {(irrData.irr_teorico_piano.nominale * 100).toFixed(2)}% nominale</div>
              <div>Scarto: {(irrData.scarto.nominale * 100).toFixed(2)}%</div>
            </div>
          )}
          {irrData && irrData.stato === 'errore_calcolo' && (
            <p>{irrData.nota}</p>
          )}
        </section>
      )}
    </div>
  )
}
