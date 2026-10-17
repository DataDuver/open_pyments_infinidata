import { QRCodeSVG } from 'qrcode.react'
import { useEffect, useRef, useState } from 'react'
import { api, dinero, fecha, mes } from '../api.js'
import { Aviso, Estado, Girador, IconoCheck, IconoQR, Pie, Portada, Tarjeta } from '../componentes.jsx'

export default function Inicio() {
  const [conjunto, setConjunto] = useState(null)
  const [torre, setTorre] = useState('')
  const [apto, setApto] = useState('')
  const [unidad, setUnidad] = useState(null)
  const [seleccion, setSeleccion] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const panelQR = useRef(null)

  useEffect(() => {
    api('/conjunto')
      .then((c) => {
        setConjunto(c)
        setTorre(c.torres[0] ?? '')
      })
      .catch((e) => setError(e.message))
  }, [])

  async function consultar(e) {
    e.preventDefault()
    setError('')
    setSeleccion(null)
    setCargando(true)
    try {
      setUnidad(await api(`/unidades/${encodeURIComponent(torre)}/${encodeURIComponent(apto.trim())}`))
    } catch (err) {
      setUnidad(null)
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }

  function elegir(cuota) {
    setSeleccion(cuota)
    // En el celular el QR queda debajo de la lista: se lleva la vista hasta él
    if (window.innerWidth < 768) {
      setTimeout(() => panelQR.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
    }
  }

  const porPagar = unidad?.cuotas.filter((c) => c.estado !== 'AL_DIA') ?? []
  const pagadas = unidad?.cuotas.filter((c) => c.estado === 'AL_DIA').reverse() ?? []
  const totalDeuda = porPagar.reduce((suma, c) => suma + Number(c.valor), 0)

  return (
    <>
      <Portada
        titulo="Tu administración, al día en segundos"
        subtitulo={`${conjunto?.nombre ?? 'Tu conjunto'} · Consulta tus cuotas y paga directo desde tu wallet con Open Payments.`}
      />

      <main className="relative z-10 mx-auto -mt-16 max-w-5xl space-y-6 px-4 sm:px-6">
        <Tarjeta>
          <form onSubmit={consultar} className="grid gap-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div>
              <span className="mb-2 block text-sm font-semibold text-slate-700">Torre</span>
              <div className="flex gap-2">
                {(conjunto?.torres ?? []).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTorre(t)}
                    className={`h-12 flex-1 rounded-2xl text-base font-semibold transition ${
                      torre === t
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Apartamento</span>
              <input
                value={apto}
                onChange={(e) => setApto(e.target.value)}
                inputMode="numeric"
                placeholder="Ej: 101"
                required
                className="h-12 w-full rounded-2xl border-0 bg-slate-100 px-4 text-base font-semibold text-slate-900 outline-none ring-emerald-500 placeholder:font-normal placeholder:text-slate-400 focus:bg-white focus:ring-2"
              />
            </label>
            <button
              disabled={cargando || !torre}
              className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-7 font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
            >
              {cargando && <Girador />}
              Consultar
            </button>
          </form>
          {error && <div className="mt-5"><Aviso>{error}</Aviso></div>}
        </Tarjeta>

        {unidad && (
          <div className="grid gap-6 md:grid-cols-5">
            <Tarjeta className="md:col-span-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-xl font-bold">
                  Torre {unidad.torre} · Apto {unidad.apto}
                </h2>
                {porPagar.length > 0 && (
                  <p className="text-sm text-slate-500">
                    Total por pagar <span className="font-bold text-slate-900">{dinero(totalDeuda)}</span>
                  </p>
                )}
              </div>

              {porPagar.length === 0 ? (
                <div className="mt-6 flex items-center gap-4 rounded-2xl bg-emerald-50 p-5">
                  <span className="grid size-12 shrink-0 place-items-center rounded-full bg-emerald-500 text-white">
                    <IconoCheck className="size-6" />
                  </span>
                  <div>
                    <p className="font-bold text-emerald-900">¡Estás al día!</p>
                    <p className="text-sm text-emerald-800">No tienes cuotas de administración pendientes.</p>
                  </div>
                </div>
              ) : (
                <>
                  <p className="mt-1 text-sm text-slate-500">Elige el mes que quieres pagar.</p>
                  <ul className="mt-5 space-y-3">
                    {porPagar.map((c) => {
                      const activa = seleccion?.id === c.id
                      return (
                        <li key={c.id}>
                          <button
                            onClick={() => elegir(c)}
                            className={`flex w-full items-center gap-4 rounded-2xl p-4 text-left ring-1 transition ${
                              activa
                                ? 'bg-emerald-50 ring-2 ring-emerald-500'
                                : 'bg-white ring-slate-200 hover:ring-slate-300'
                            }`}
                          >
                            <span
                              className={`grid size-6 shrink-0 place-items-center rounded-full ring-2 ${
                                activa ? 'bg-emerald-500 text-white ring-emerald-500' : 'ring-slate-300'
                              }`}
                            >
                              {activa && <IconoCheck className="size-4" />}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block font-semibold">{mes(c.periodo)}</span>
                              <span className="block text-xs text-slate-500">Vence el {fecha(c.vence)}</span>
                            </span>
                            <span className="flex flex-col items-end gap-1">
                              <span className="font-bold">{dinero(c.valor, c.moneda, c.escala)}</span>
                              <Estado estado={c.estado} />
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </>
              )}

              {pagadas.length > 0 && (
                <details className="group mt-6">
                  <summary className="cursor-pointer list-none text-sm font-medium text-slate-500 hover:text-slate-700">
                    <span className="group-open:hidden">Ver historial ({pagadas.length} cuotas pagadas)</span>
                    <span className="hidden group-open:inline">Ocultar historial</span>
                  </summary>
                  <ul className="mt-3 divide-y divide-slate-100 text-sm">
                    {pagadas.map((c) => (
                      <li key={c.id} className="flex items-center justify-between py-2.5">
                        <span className="flex items-center gap-2 text-slate-600">
                          <IconoCheck className="size-4 text-emerald-500" />
                          {mes(c.periodo)}
                        </span>
                        <span className="text-slate-500">{dinero(c.valor, c.moneda, c.escala)}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </Tarjeta>

            {porPagar.length > 0 && (
              <div ref={panelQR} className="scroll-mt-4 md:col-span-2">
                <Tarjeta className="md:sticky md:top-6">
                  {seleccion ? (
                    <CodigoPago cuota={seleccion} urlQR={conjunto?.url_qr} />
                  ) : (
                    <div className="flex flex-col items-center py-8 text-center text-slate-400">
                      <IconoQR className="size-12" />
                      <p className="mt-3 max-w-56 text-sm">
                        Selecciona el mes que quieres pagar y te generamos el código QR.
                      </p>
                    </div>
                  )}
                </Tarjeta>
              </div>
            )}
          </div>
        )}
      </main>
      <Pie />
    </>
  )
}

function CodigoPago({ cuota, urlQR }) {
  const [copiado, setCopiado] = useState(false)
  const ruta = `/pagar/${cuota.token}`
  // En local el servidor manda la IP del computador en la WiFi, para que el celular sí llegue
  const base = urlQR || window.location.origin
  const enlace = `${base}${ruta}`
  const redLocal = base !== window.location.origin

  async function copiar() {
    try {
      await navigator.clipboard.writeText(enlace)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      window.prompt('Copia el enlace de pago:', enlace)
    }
  }

  return (
    <div className="text-center">
      <p className="text-sm font-medium text-slate-500">{mes(cuota.periodo)}</p>
      <p className="mt-1 text-3xl font-extrabold tracking-tight">{dinero(cuota.valor, cuota.moneda, cuota.escala)}</p>
      <div className="mx-auto mt-5 w-fit rounded-3xl bg-white p-4 ring-1 ring-slate-200">
        <QRCodeSVG value={enlace} size={208} level="M" fgColor="#0f172a" />
      </div>
      <p className="mt-4 text-sm text-slate-500">Escanéalo con tu celular para pagar desde tu wallet.</p>
      {redLocal && (
        <p className="mt-1 text-xs text-slate-400">El celular debe estar en la misma red WiFi ({new URL(base).host}).</p>
      )}
      <div className="mt-5 grid gap-2">
        <a
          href={ruta}
          className="flex h-12 items-center justify-center rounded-2xl bg-emerald-600 font-semibold text-white shadow-md shadow-emerald-600/25 transition hover:bg-emerald-700"
        >
          Pagar desde este dispositivo
        </a>
        <button
          onClick={copiar}
          className="h-11 rounded-2xl text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
        >
          {copiado ? '¡Enlace copiado!' : 'Copiar enlace de pago'}
        </button>
      </div>
    </div>
  )
}
