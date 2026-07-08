/**
 * PORTFOLIO DASHBOARD — Worker unico (assets statici + API dati)
 * #D005 — Luglio 2026
 * Espone endpoint di sola lettura sotto /api/*, stesso D1 (db_invplan)
 * già usato da portfolio-worker-v1. Le scritture (/sync da Apps Script)
 * restano su portfolio-worker-v1, invariato.
 */

const LUMP_SUM = 45000;
const PAC_MENSILE = 400;
const AVVIO_PAC = new Date('2026-09-01T00:00:00Z');
const MESI_PAC_MAX = 120;
const CAPITALE_NOMINALE_2036_BASE = 140557;

const IRR_TEORICO_PIANO_BASE_10Y = { nominale: 0.0553, reale: 0.0296 };
const SOGLIA_GIORNI_DATI_INSUFFICIENTI = 90;
const SOGLIA_GIORNI_NOTA_VOLATILITA = 180;

function getStartDate(finestra) {
  const oggi = new Date();
  let start = new Date(oggi);
  switch (finestra) {
    case 'week': start.setUTCDate(start.getUTCDate() - 7); break;
    case 'month': start.setUTCDate(start.getUTCDate() - 30); break;
    case '3m': start.setUTCMonth(start.getUTCMonth() - 3); break;
    case 'ytd': start = new Date(Date.UTC(oggi.getUTCFullYear(), 0, 1)); break;
    case '6m':
    default: start.setUTCMonth(start.getUTCMonth() - 6); break;
  }
  return start.toISOString().slice(0, 10);
}

async function getChartData(env, finestra) {
  const startDate = getStartDate(finestra);
  const pesiRes = await env.DB.prepare(
    `SELECT ticker, peso FROM v_pesi_target_correnti`
  ).all();
  const PESI_TARGET = {};
  for (const r of pesiRes.results) PESI_TARGET[r.ticker] = r.peso / 100;
  const tickers = Object.keys(PESI_TARGET);

  const { results } = await env.DB.prepare(
    `SELECT ticker, data, close FROM t_etf_prezzi WHERE data >= ? ORDER BY ticker, data ASC`
  ).bind(startDate).all();

  const byTicker = {};
  for (const t of tickers) byTicker[t] = [];
  for (const r of results) if (byTicker[r.ticker]) byTicker[r.ticker].push(r);

  const dateSets = tickers.map(t => new Set(byTicker[t].map(r => r.data)));
  let commonDates = dateSets.length ? new Set(dateSets[0]) : new Set();
  for (const s of dateSets) commonDates = new Set([...commonDates].filter(d => s.has(d)));
  const sortedCommon = [...commonDates].sort();

  const priceMaps = {};
  for (const t of tickers) priceMaps[t] = new Map(byTicker[t].map(r => [r.data, r.close]));
  const basePrices = {};
  for (const t of tickers) basePrices[t] = sortedCommon.length ? priceMaps[t].get(sortedCommon[0]) : null;

  const valori_euro = sortedCommon.map(d => {
    let val = 0, ok = true;
    for (const t of tickers) {
      const p = priceMaps[t].get(d), b = basePrices[t];
      if (p == null || !b) { ok = false; break; }
      val += (p / b * 100) * PESI_TARGET[t];
    }
    return ok ? Math.round(val * 100) / 100 : null;
  });

  const flagsRes = await env.DB.prepare(
    `SELECT tipo, ticker, data_evento, valore_pct, provvisorio FROM t_flag_events WHERE data_evento >= ? ORDER BY data_evento ASC`
  ).bind(startDate).all();

  return {
    schema_version: 1,
    finestra,
    generated_at: new Date().toISOString(),
    portafoglio_ponderato: { dates: sortedCommon, valori_euro },
    flag_eventi: flagsRes.results,
  };
}

function xnpv(rate, flussi) {
  return flussi.reduce((acc, f) => acc + f.importo / Math.pow(1 + rate, f.giorni_da_data0 / 365), 0);
}
function xnpvDerivative(rate, flussi) {
  return flussi.reduce((acc, f) => {
    const t = f.giorni_da_data0 / 365;
    if (t === 0) return acc;
    return acc - (t * f.importo) / Math.pow(1 + rate, t + 1);
  }, 0);
}
function newtonRaphsonXIRR(flussi, guess = 0.0002, maxIter = 50, tol = 1e-6) {
  let rate = guess;
  for (let i = 0; i < maxIter; i++) {
    const npv = xnpv(rate, flussi);
    if (Math.abs(npv) < tol) return { rate, converged: true };
    const deriv = xnpvDerivative(rate, flussi);
    if (deriv === 0) break;
    const nextRate = rate - npv / deriv;
    if (nextRate <= -0.9999) break;
    rate = nextRate;
  }
  return { rate, converged: false };
}
function bisectionXIRR(flussi, lo = -0.01, hi = 0.05, maxIter = 200, tol = 1e-6) {
  let fLo = xnpv(lo, flussi);
  let fHi = xnpv(hi, flussi);
  if (fLo * fHi > 0) return { rate: null, converged: false };
  let mid = (lo + hi) / 2;
  for (let i = 0; i < maxIter; i++) {
    mid = (lo + hi) / 2;
    const fMid = xnpv(mid, flussi);
    if (Math.abs(fMid) < tol) return { rate: mid, converged: true };
    if ((fLo < 0 && fMid < 0) || (fLo > 0 && fMid > 0)) { lo = mid; fLo = fMid; } else { hi = mid; }
  }
  return { rate: mid, converged: false };
}
function solveXIRR(flussi) {
  const nr = newtonRaphsonXIRR(flussi);
  if (nr.converged) return { rate: nr.rate, metodo: 'newton_raphson' };
  const bis = bisectionXIRR(flussi);
  if (bis.converged) return { rate: bis.rate, metodo: 'bisection_fallback' };
  return { rate: null, metodo: 'errore_calcolo' };
}

async function getPerformanceData(env) {
  const generated_at = new Date().toISOString();

  const txRows = await env.DB.prepare(
    `SELECT t.data_operazione, t.controvalore, t.batch_id
     FROM t_transazioni t
     JOIN t_transazioni_costi tc ON tc.batch_id = t.batch_id
     WHERE tc.tipo != 'storno'
       AND t.batch_id NOT IN (
         SELECT riferimento_correzione FROM t_transazioni_costi
         WHERE riferimento_correzione IS NOT NULL
       )
     ORDER BY t.data_operazione ASC`
  ).all();
  const righe = txRows.results || [];

  const commRow = await env.DB.prepare(
    `SELECT COALESCE(SUM(commissione_totale), 0) as tot
     FROM t_transazioni_costi
     WHERE tipo != 'storno'
       AND batch_id NOT IN (
         SELECT riferimento_correzione FROM t_transazioni_costi
         WHERE riferimento_correzione IS NOT NULL
       )`
  ).first();
  const commissioni_totali_dedotte = commRow ? commRow.tot : 0;

  const quoteRes = await env.DB.prepare(
    `SELECT t.ticker, SUM(t.quote) AS quote_possedute
     FROM t_transazioni t
     JOIN t_transazioni_costi tc ON tc.batch_id = t.batch_id
     WHERE tc.tipo != 'storno'
       AND t.batch_id NOT IN (
         SELECT riferimento_correzione FROM t_transazioni_costi
         WHERE riferimento_correzione IS NOT NULL
       )
     GROUP BY t.ticker`
  ).all();
  const prezziRes = await env.DB.prepare(
    `SELECT ticker, prezzo_attuale FROM t_etf_riepilogo WHERE peso > 0`
  ).all();
  const prezzoMap = {};
  for (const r of prezziRes.results) prezzoMap[r.ticker] = Number(r.prezzo_attuale) || 0;

  let valore_corrente_totale = 0;
  for (const r of quoteRes.results) {
    valore_corrente_totale += (Number(r.quote_possedute) || 0) * (prezzoMap[r.ticker] || 0);
  }
  const valore_corrente_netto = valore_corrente_totale - commissioni_totali_dedotte;
  const n_transazioni_non_stornate = righe.length;

  const basePayload = {
    generated_at,
    irr_teorico_piano: IRR_TEORICO_PIANO_BASE_10Y,
    valore_corrente_netto: Math.round(valore_corrente_netto * 100) / 100,
    commissioni_totali_dedotte,
  };

  if (n_transazioni_non_stornate === 0) {
    return { ...basePayload, stato: 'dati_insufficienti', irr_reale: null, scarto: null,
      n_transazioni_incluse: 0, prima_transazione: null, ultima_transazione: null, nota: null };
  }

  const prima_transazione = righe[0].data_operazione;
  const ultima_transazione = righe[righe.length - 1].data_operazione;
  const data0 = new Date(prima_transazione + 'T00:00:00Z');
  const oggi = new Date();
  const giorni_da_prima_tx = Math.floor((oggi - data0) / 86400000);

  if (n_transazioni_non_stornate < 2 || giorni_da_prima_tx < SOGLIA_GIORNI_DATI_INSUFFICIENTI) {
    return { ...basePayload, stato: 'dati_insufficienti', irr_reale: null, scarto: null,
      n_transazioni_incluse: n_transazioni_non_stornate, prima_transazione, ultima_transazione, nota: null };
  }

  const flussi = righe.map(r => ({
    importo: -r.controvalore,
    giorni_da_data0: Math.floor((new Date(r.data_operazione + 'T00:00:00Z') - data0) / 86400000),
  }));
  flussi.push({ importo: valore_corrente_netto, giorni_da_data0: giorni_da_prima_tx });

  const { rate: r_giornaliero, metodo } = solveXIRR(flussi);

  if (metodo === 'errore_calcolo' || r_giornaliero === null) {
    return { ...basePayload, stato: 'errore_calcolo', irr_reale: null, scarto: null,
      n_transazioni_incluse: n_transazioni_non_stornate, prima_transazione, ultima_transazione,
      nota: 'XIRR non convergente' };
  }

  const r_annuale_nominale = Math.pow(1 + r_giornaliero, 365) - 1;
  const r_annuale_reale = (1 + r_annuale_nominale) / 1.025 - 1;
  const irr_reale = { nominale: r_annuale_nominale, reale: r_annuale_reale };
  const scarto = {
    nominale: irr_reale.nominale - IRR_TEORICO_PIANO_BASE_10Y.nominale,
    reale: irr_reale.reale - IRR_TEORICO_PIANO_BASE_10Y.reale,
  };
  const nota = giorni_da_prima_tx < SOGLIA_GIORNI_NOTA_VOLATILITA
    ? 'finestra temporale breve (<180 giorni) — IRR reale soggetto a elevata volatilità statistica'
    : null;

  return { ...basePayload, stato: 'ok', irr_reale, scarto, n_transazioni_incluse: n_transazioni_non_stornate,
    prima_transazione, ultima_transazione, metodo_xirr: metodo, nota };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, '') || '/';
    const headers = { 'Content-Type': 'application/json' };

    if (!path.startsWith('/api/')) {
      return new Response('Not found', { status: 404 });
    }

    try {
      switch (path) {
        case '/api/macro': {
          const { results } = await env.DB.prepare(
            `SELECT nome, valore, stato, data_riferimento, note FROM t_macro_params ORDER BY id`
          ).all();
          const alert_count = {
            alert: results.filter(r => r.stato?.includes('ALERT')).length,
            vicino: results.filter(r => r.stato?.includes('VICINO')).length,
            ok: results.filter(r => r.stato?.includes('OK')).length,
          };
          return Response.json({ parametri: results, alert_count }, { headers });
        }

        case '/api/scenario': {
          const { results } = await env.DB.prepare(
            `SELECT scenario, score,
                    ROUND(score * 100.0 / (SELECT SUM(score) FROM t_scenario_scores), 1) AS probabilita_pct
             FROM t_scenario_scores ORDER BY score DESC`
          ).all();
          return Response.json({ scenari: results, prevalente: results[0] || null }, { headers });
        }

        case '/api/ytd': {
          const { results } = await env.DB.prepare(
            `SELECT ticker, nome, peso, prezzo_attuale, prezzo_inizio_anno, ytd_pct,
                    ROUND(ytd_pct * peso / 100, 4) as contributo_ponderato
             FROM t_etf_riepilogo ORDER BY peso DESC`
          ).all();
          return Response.json({ etf: results }, { headers });
        }

        case '/api/portfolio': {
          const { results } = await env.DB.prepare(
            `SELECT ticker, isin, nome, peso_target, categoria, prezzo_attuale, ytd_pct
             FROM v_portafoglio_corrente`
          ).all();
          return Response.json({ portafoglio: results }, { headers });
        }

        case '/api/dashboard': {
          const [macro, scenari, etf, flags] = await Promise.all([
            env.DB.prepare(`SELECT stato FROM t_macro_params`).all(),
            env.DB.prepare(
              `SELECT scenario, score,
                      ROUND(score * 100.0 / (SELECT SUM(score) FROM t_scenario_scores), 1) AS probabilita_pct
               FROM t_scenario_scores ORDER BY score DESC`
            ).all(),
            env.DB.prepare(`SELECT ticker, peso, ytd_pct FROM t_etf_riepilogo`).all(),
            env.DB.prepare(
              `SELECT tipo, ticker, data_evento, valore_pct, provvisorio
               FROM t_flag_events ORDER BY data_evento DESC LIMIT 5`
            ).all(),
          ]);

          const alert_macro = {
            alert: macro.results.filter(r => r.stato?.includes('ALERT')).length,
            vicino: macro.results.filter(r => r.stato?.includes('VICINO')).length,
            ok: macro.results.filter(r => r.stato?.includes('OK')).length,
          };

          const oggi = new Date();
          let mesiPac = 0;
          if (oggi >= AVVIO_PAC) {
            mesiPac = (oggi.getUTCFullYear() - AVVIO_PAC.getUTCFullYear()) * 12
              + (oggi.getUTCMonth() - AVVIO_PAC.getUTCMonth());
            mesiPac = Math.max(0, Math.min(mesiPac, MESI_PAC_MAX));
          }
          const totaleVersato = LUMP_SUM + mesiPac * PAC_MENSILE;
          const ytdPonderato = etf.results.reduce((acc, r) => acc + (r.ytd_pct * r.peso / 100), 0);
          const valoreStimato = totaleVersato * (1 + ytdPonderato / 100);
          const gainLossEur = valoreStimato - totaleVersato;
          const gapVs140557 = CAPITALE_NOMINALE_2036_BASE - valoreStimato;

          return Response.json({
            generated_at: new Date().toISOString(),
            scenario_prevalente: scenari.results[0] || null,
            alert_macro,
            capitale: {
              totale_versato: totaleVersato,
              mesi_pac_trascorsi: mesiPac,
              valore_stimato: Math.round(valoreStimato * 100) / 100,
              gain_loss_eur: Math.round(gainLossEur * 100) / 100,
              gain_loss_pct: Math.round(ytdPonderato * 100) / 100,
              gap_vs_140557: Math.round(gapVs140557 * 100) / 100,
            },
            flag_recenti: flags.results,
          }, { headers });
        }

        case '/api/performance': {
          const payload = await getPerformanceData(env);
          return Response.json(payload, { headers });
        }

        case '/api/chart_data': {
          const finestra = url.searchParams.get('finestra') || '6m';
          const payload = await getChartData(env, finestra);
          return Response.json(payload, { headers });
        }

        default:
          return Response.json({ error: `Endpoint sconosciuto: ${path}` }, { status: 404, headers });
      }
    } catch (err) {
      return Response.json({ error: err.message }, { status: 500, headers });
    }
  }
};
