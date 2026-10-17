import { useEffect, useState } from 'react'
import { api, dinero, fechaHora, mes, puntero } from '../api.js'
import { Aviso, Girador, IconoCheck, Pie, Portada, Tarjeta } from '../componentes.jsx'

const EN_PROCESO = ['ESPERANDO_APROBACION', 'ENVIANDO', 'ENVIADO']

function walletGuardada() {
  try {
    return localStorage.getItem('wallet') ?? ''
  } catch {
    return ''
  }
}

export default function Pagar({ token }) {
  const pagoId = new URLSearchParams(window.location.search).get('pago')
  const [cobro, setCobro] = useState(null)
  const [pago, setPago] = useState(null)
  const [wallet, setWallet] = useState(walletGuardada)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api(`/cobros/${token}`).then(setCobro).catch((e) => setError(e.message))
  }, [token])

  // Al volver de la wallet: consultar el pago hasta que termine
  useEffect(() => {
    if (!pagoId) return
    let activo = true
    let espera
    const consultar = async () => {
      try {
        const p = await api(`/pagos/${pagoId}`)
        if (!activo) return
        setPago(p)
        if (EN_PROCESO.includes(p.estado)) espera = setTimeout(consultar, 2000)
        else api(`/cobros/${token}`).then(setCobro).catch(() => {})
      } catch (e) {
        if (activo) setError(e.message)
      }
    }
    consultar()
    return () => {
      activo = false
      clearTimeout(espera)
    }
  }, [pagoId, token])

  async function pagar(e) {
    e.preventDefault()
    setError('')
    setEnviando(true)
    try {
      try {
        localStorage.setItem('wallet', wallet.trim())
      } catch {}
      const { redirect } = await api(`/cobros/${token}/pagar`, {
        method: 'POST',
        body: JSON.stringify({ wallet: wallet.trim() }),
      })
      window.location.href = redirect
    } catch (err) {
      setError(err.message)
      setEnviando(false)
    }
  }

  const valor = cobro && dinero(cobro.valor, cobro.moneda, cobro.escala)

  return (
    <>
      <Portada titulo="Pago de administración" subtitulo={cobro?.conjunto} />
      <main className="relative z-10 mx-auto -mt-16 max-w-xl space-y-6 px-4 sm:px-6">
        <Tarjeta>
          {!cobro ? (
            error ? <Aviso>{error}</Aviso> : <div className="flex justify-center py-10 text-slate-400"><Girador className="size-8" /></div>
          ) : (
            <>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-500">
                    Torre {cobro.torre} · Apto {cobro.apto}
                  </p>
                  <p className="mt-0.5 text-lg font-bold">{mes(cobro.periodo)}</p>
                </div>
                <p className="whitespace-nowrap text-3xl font-extrabold tracking-tight">{valor}</p>
              </div>
              <Datos
                className="mt-5 bg-slate-50"
                filas={[
                  ['Recibe', puntero(cobro.wallet_admin), true],
                  ['Red', 'Interledger · Open Payments'],
                ]}
              />

              <div className="mt-6">
                {pagoId && pago ? (
                  <EstadoPago pago={pago} token={token} />
                ) : cobro.estado === 'AL_DIA' ? (
                  <Exito titulo="Esta cuota ya está pagada" detalle={cobro.pagada_en && `Pagada el ${fechaHora(cobro.pagada_en)}`} />
                ) : (
                  <form onSubmit={pagar} className="space-y-4">
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-slate-700">Tu wallet</span>
                      <input
                        value={wallet}
                        onChange={(e) => setWallet(e.target.value)}
                        placeholder="https://ilp.interledger-test.dev/tu-wallet"
                        autoComplete="off"
                        autoCapitalize="none"
                        spellCheck="false"
                        required
                        className="h-12 w-full rounded-2xl border-0 bg-slate-100 px-4 font-mono text-sm text-slate-900 outline-none ring-emerald-500 placeholder:text-slate-400 focus:bg-white focus:ring-2"
                      />
                      <span className="mt-2 block text-xs text-slate-500">
                        Es la dirección de pago de tu cuenta en la wallet (también sirve con $ al inicio).
                      </span>
                    </label>
                    {error && <Aviso>{error}</Aviso>}
                    <button
                      disabled={enviando}
                      className="flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-base font-semibold text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-700 disabled:opacity-70"
                    >
                      {enviando ? (
                        <>
                          <Girador /> Preparando tu pago…
                        </>
                      ) : (
                        `Pagar ${valor}`
                      )}
                    </button>
                    <p className="text-center text-xs text-slate-500">
                      Te llevamos a tu wallet para que apruebes el pago y luego vuelves aquí.
                    </p>
                  </form>
                )}
              </div>
            </>
          )}
        </Tarjeta>
        <p className="text-center text-sm">
          <a href="/" className="font-medium text-slate-500 hover:text-slate-800">
            ← Consultar otro apartamento
          </a>
        </p>
      </main>
      <Pie />
    </>
  )
}

function EstadoPago({ pago, token }) {
  if (pago.estado === 'COMPLETADO') {
    return (
      <Exito
        titulo="¡Pago recibido!"
        detalle="El conjunto ya recibió tu pago y la cuota quedó al día."
        filas={[
          ['Desde', puntero(pago.wallet_pagador), true],
          ['Debitado', dinero(pago.debito_valor, pago.debito_moneda, pago.debito_escala)],
          ['Fecha', fechaHora(pago.completado)],
        ]}
      />
    )
  }

  if (EN_PROCESO.includes(pago.estado)) {
    const pasos = [
      ['Aprobaste el pago en tu wallet', pago.estado !== 'ESPERANDO_APROBACION'],
      ['Enviando por la red Interledger', pago.estado === 'ENVIADO'],
      ['El conjunto recibe el pago', false],
    ]
    const actual = pasos.findIndex(([, hecho]) => !hecho)
    return (
      <div>
        <ol className="space-y-4">
          {pasos.map(([texto, hecho], i) => (
            <li key={texto} className="flex items-center gap-3">
              <span
                className={`grid size-8 shrink-0 place-items-center rounded-full ${
                  hecho ? 'bg-emerald-500 text-white' : i === actual ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-300'
                }`}
              >
                {hecho ? <IconoCheck className="size-4" /> : i === actual ? <Girador className="size-4" /> : <span className="size-2 rounded-full bg-current" />}
              </span>
              <span className={hecho || i === actual ? 'font-medium text-slate-900' : 'text-slate-400'}>{texto}</span>
            </li>
          ))}
        </ol>
        {pago.estado === 'ESPERANDO_APROBACION' && (
          <p className="mt-5 text-sm text-slate-500">
            ¿No terminaste de aprobar?{' '}
            <a href={`/pagar/${token}`} className="font-semibold text-emerald-700">
              Volver a intentar
            </a>
          </p>
        )}
      </div>
    )
  }

  const mensaje =
    pago.estado === 'RECHAZADO'
      ? 'Cancelaste el pago en tu wallet. No se debitó nada.'
      : pago.error || 'No se pudo completar el pago.'
  return (
    <div className="space-y-4">
      <Aviso>{mensaje}</Aviso>
      <a
        href={`/pagar/${token}`}
        className="flex h-12 items-center justify-center rounded-2xl bg-slate-900 font-semibold text-white transition hover:bg-slate-800"
      >
        Intentar de nuevo
      </a>
    </div>
  )
}

function Exito({ titulo, detalle, filas = [] }) {
  return (
    <div className="text-center">
      <span className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/30">
        <IconoCheck className="size-8" />
      </span>
      <p className="mt-4 text-xl font-bold">{titulo}</p>
      {detalle && <p className="mt-1 text-sm text-slate-500">{detalle}</p>}
      {filas.length > 0 && <Datos className="mt-5 bg-emerald-50" filas={filas} />}
    </div>
  )
}

/**
 * Pares etiqueta/valor. En el celular la etiqueta va arriba y el valor debajo,
 * para que una wallet larga se lea completa en vez de salirse de la tarjeta.
 */
function Datos({ filas, className = '' }) {
  return (
    <dl className={`grid gap-3 rounded-2xl p-4 text-left text-sm ${className}`}>
      {filas.map(([etiqueta, valor, esWallet]) => (
        <div key={etiqueta} className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
          <dt className="shrink-0 text-slate-500">{etiqueta}</dt>
          <dd
            className={`min-w-0 font-medium text-slate-800 sm:text-right ${
              esWallet ? 'break-all font-mono text-xs leading-5' : ''
            }`}
          >
            {valor}
          </dd>
        </div>
      ))}
    </dl>
  )
}
