import { useEffect, useState } from 'react'

const TIPO_LABELS = {
  pac: 'PAC',
  lump_sum: 'Lump sum',
  manuale: 'Manuale',
  storno: 'Storno',
}

export default function Transazioni() {
  const [batch, setBatch] = useState(null)
  const [error, setError] = useState(null)
  const [filtro, setFiltro] = useState('tutti')

  useEffect(() => {
    fetch('/api/transazioni')
      .then(r => r.json())
      .then(d => setBatch(d.batch))
      .catch(err => setError(err.message))
  }, [])

  if (error) return <div><h1>Transazioni</h1><p style={{ color: '#ff6b6b' }}>{error}</p></div>
  if (!batch) return <div><h1>Transazioni</h1><p>Caricamento...</p></div>

  const filtrati = filtro === 'tutti' ? batch : batch.filter(b => b.tipo === filtro);

  return (
    <div>
      <h1>Transazioni</h1>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {['tutti', 'pac', 'lump_sum', 'manuale', 'storno'].map(f => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            style={{
              padding: '6px 14px',
              background: filtro === f ? '#4f9eff' : 'transparent',
              color: filtro === f ? '#fff' : '#888',
              border: '1px solid #2a2d35',
              borderRadius: 6,
            }}
          >
            {f === 'tutti' ? 'Tutti' : TIPO_LABELS[f]}
          </button>
        ))}
      </div>

      {filtrati.length === 0 ? (
        <p style={{ color: '#888' }}>Nessuna transazione registrata.</p>
      ) : (
        filtrati.map((b, i) => (
          <div key={i} style={{ padding: '12px 0', borderBottom: '1px solid #2a2d35' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <strong>{TIPO_LABELS[b.tipo] || b.tipo}</strong>
              <span>{b.data_operazione}</span>
            </div>
            <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>
              {b.n_righe} righe · Batch {b.batch_id}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              <span>Controvalore: €{b.totale_controvalore.toLocaleString('it-IT')}</span>
              <span style={{ color: '#888' }}>Commissione: €{b.commissione_totale}</span>
            </div>
            {b.stornato === 1 && (
              <div style={{ fontSize: 12, color: '#ff6b6b', marginTop: 4 }}>Stornato</div>
            )}
            {b.riferimento_correzione && (
              <div style={{ fontSize: 12, color: '#ffb74d', marginTop: 4 }}>
                Correzione di batch {b.riferimento_correzione}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )
}
