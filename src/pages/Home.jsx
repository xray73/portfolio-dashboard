import { useEffect, useState } from 'react'

const SCENARIO_LABELS = {
  base: 'Base',
  stagflaz: 'Stagflazionistico',
  recessivo: 'Recessivo',
  reflaz: 'Reflazionistico',
}

const cardStyle = {
  background: '#181b21',
  border: '1px solid #2a2d35',
  borderRadius: 10,
  padding: 16,
  marginBottom: 16,
}
const labelStyle = { fontSize: 13, color: '#888', marginBottom: 6 }

export default function Home() {
  const [data, setData] = useState(null)
  const [macro, setMacro] = useState(null)
  const [error, setError] = useState(null)
  const [showIrr, setShowIrr] = useState(false)
  const [irrData, setIrrData] = useState(null)
  const [irrLoading, setIrrLoading] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/dashboard').then(r => r.json()),
      fetch('/api/macro').then(r => r.json()),
    ])
      .then(([d, m]) => { setData(d); setMacro(m) })
      .catch(err => setError(err.message))
  }, [])

  function toggleIrr() {
    if (showIrr) { setShowIrr(false); return }
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
  if (!data || !macro) return <div><h1>Home</h1><p>Caricamento...</p></div>

  const scenarioLabel = SCENARIO_LABELS[data.scenario_prevalente?.scenario] || data.scenario_prevalente?.scenario
  const ultimiFlag = (data.flag_recenti || []).slice(0, 3)
  const nomiAlert = macro.parametri.filter(p => p.stato?.includes('ALERT')).map(p => p.nome)
  const nomiVicino = macro.parametri.filter(p => p.stato?.includes('VICINO')).map(p => p.nome)

  return (
    <div>
      <h1>Home</h1>

      <div style={cardStyle}>
        <div style={labelStyle}>Scenario prevalente</div>
        <div style={{ fontSize: 20, fontWeight: 600 }}>
          {scenarioLabel} ({data.scenario_prevalente?.probabilita_pct}%)
        </div>
      </div>

      <div style={cardStyle}>
        <div style={labelStyle}>Alert macro</div>
        <div>
          {data.alert_macro.alert} alert · {data.alert_macro.vicino} in sorveglianza · {data.alert_macro.ok} ok
        </div>
        {nomiAlert.length > 0 && (
          <div style={{ color: '#ff6b6b', marginTop: 6, fontSize: 14 }}>
            Alert: {nomiAlert.join(', ')}
          </div>
        )}
        {nomiVicino.length > 0 && (
          <div style={{ color: '#ffb74d', marginTop: 4, fontSize: 14 }}>
            Sorveglianza: {nomiVicino.join(', ')}
          </div>
        )}
      </div>

      <div style={cardStyle}>
        <div style={labelStyle}>Capitale</div>
        <div>Versato: €{data.capitale.totale_versato.toLocaleString('it-IT')}</div>
        <div>Stimato: €{data.capitale.valore_stimato.toLocaleString('it-IT')}</div>
        <div style={{ color: data.capitale.gain_loss_eur >= 0 ? '#4caf50' : '#ff6b6b', marginTop: 4 }}>
          Gain/Loss: €{data.capitale.gain_loss_eur.toLocaleString('it-IT')} ({data.capitale.gain_loss_pct}%)
        </div>
        <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>
          Gap vs €140.557 (2036): €{data.capitale.gap_vs_140557.toLocaleString('it-IT')}
        </div>
      </div>

      <div style={cardStyle}>
        <div style={labelStyle}>Ultimi flag</div>
        {ultimiFlag.length ? (
          ultimiFlag.map((f, i) => (
            <div key={i} style={{
              padding: '6px 0',
              borderBottom: i < ultimiFlag.length - 1 ? '1px solid #2a2d35' : 'none',
            }}>
              {f.tipo} — {f.ticker || 'portafoglio'} — {f.valore_pct}%
              {' — '}picco {f.data_evento}{f.trough_date ? ` → valle ${f.trough_date}` : ''}
              {' — '}<span style={{ color: f.stato === 'in corso' ? '#ffb74d' : '#888' }}>{f.stato}</span>
            </div>
          ))
        ) : (
          <div>Nessun flag</div>
        )}
      </div>

      <button onClick={toggleIrr}>
        {showIrr ? 'Nascondi IRR' : 'Mostra IRR reale vs teorico'}
      </button>

      {showIrr && (
        <div style={{ ...cardStyle, marginTop: 16 }}>
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
          {irrData && irrData.stato === 'errore_calcolo' && <p>{irrData.nota}</p>}
        </div>
      )}
    </div>
  )
}
