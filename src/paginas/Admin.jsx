import { useEffect, useState } from 'react'
import { api, dinero, fechaHora, mes, puntero } from '../api.js'
import { Aviso, Estado, Girador, Pie, Portada, Tarjeta } from '../componentes.jsx'

export default function Admin() {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState('')

  // Se refresca solo: los pagos aparecen en vivo mientras se hace la demo
  useEffect(() => {
    let activo = true
    const cargar = () =>
      api('/admin/resumen')
        .then((d) => {
          if (!activo) return
          setDatos(d)
          setError('')
        })
        .catch((e) => activo && setError(e.message))
    cargar()
    const intervalo = setInterval(cargar, 4000)
    return () => {
      activo = false
      clearInterval(intervalo)
    }
  }, [])

  return (
    <>
      <Portada titulo="Panel del administrador" subtitulo="Recaudo de la administración en tiempo real.">
        <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-emerald-50">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-300 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-300" />
          </span>
          En vivo
        </span>
      </Portada>

      <main className="relative z-10 mx-auto -mt-16 max-w-5xl space-y-6 px-4 sm:px-6">
        {error && <Aviso>{error}</Aviso>}
        {!datos ? (
          <Tarjeta className="min-w-0">
            <div className="flex justify-center py-10 text-slate-400">
              <Girador className="size-8" />
            </div>
          </Tarjeta>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Indicador
                titulo="Recaudado con Open Payments"
                valor={dinero(datos.open_payments.valor)}
                detalle={`${datos.open_payments.pagos} pagos recibidos`}
                acento="text-emerald-600"
              />
              <Indicador
                titulo="Cartera en mora"
                valor={dinero(datos.valor_mora)}
                detalle={`${datos.cuotas_mora} cuotas vencidas`}
                acento="text-rose-600"
              />
              <Indicador
                titulo="Pendiente del mes"
                valor={dinero(datos.valor_pendiente)}
                detalle={`${datos.cuotas_pendientes} cuotas por pagar`}
                acento="text-amber-600"
              />
              <Indicador
                titulo="Unidades al día este mes"
                valor={`${datos.cuotas_mes_al_dia} / ${datos.cuotas_mes}`}
                barra={datos.cuotas_mes ? datos.cuotas_mes_al_dia / datos.cuotas_mes : 0}
                acento="text-slate-900"
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <Tarjeta className="min-w-0 lg:col-span-2">
                <h2 className="text-lg font-bold">Últimos pagos</h2>
                {datos.pagos.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-500">
                    Todavía no hay pagos con Open Payments. Aparecen aquí apenas alguien pague.
                  </p>
                ) : (
                  // En el celular: datos arriba, valor y estado abajo; en pantalla grande, en una fila
                  <ul className="mt-4 divide-y divide-slate-100">
                    {datos.pagos.map((p) => (
                      <li key={p.id} className="flex flex-col gap-2 py-3.5 sm:flex-row sm:items-center sm:gap-4">
                        <div className="min-w-0 sm:flex-1">
                          <p className="font-semibold">
                            Torre {p.torre} · {p.apto}
                            <span className="font-normal text-slate-500"> · {mes(p.periodo)}</span>
                          </p>
                          <p className="truncate font-mono text-xs text-slate-500" title={p.wallet_pagador}>
                            {puntero(p.wallet_pagador)}
                          </p>
                          <p className="text-xs text-slate-400">{fechaHora(p.creado)}</p>
                          {p.estado === 'FALLIDO' && p.error && (
                            <p className="mt-1 text-xs text-rose-600">{p.error}</p>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-3 sm:justify-end">
                          <span className="font-bold">{dinero(p.valor, p.moneda, p.escala)}</span>
                          <Estado estado={p.estado} />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Tarjeta>

              <Tarjeta className="min-w-0">
                <h2 className="text-lg font-bold">Unidades en mora</h2>
                {datos.morosos.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-500">Nadie está en mora.</p>
                ) : (
                  <ul className="mt-4 space-y-2">
                    {datos.morosos.map((m) => (
                      <li
                        key={`${m.torre}-${m.apto}`}
                        className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm"
                      >
                        <span>
                          <span className="font-semibold">
                            T{m.torre} · {m.apto}
                          </span>
                          <span className="text-slate-500">
                            {' '}
                            · {m.cuotas} {m.cuotas === 1 ? 'mes' : 'meses'}
                          </span>
                        </span>
                        <span className="font-bold text-rose-600">{dinero(m.valor)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Tarjeta>
            </div>
          </>
        )}
      </main>
      <Pie />
    </>
  )
}

function Indicador({ titulo, valor, detalle, acento, barra }) {
  return (
    <div className="rounded-3xl bg-white p-5 shadow-xl shadow-slate-900/5 ring-1 ring-slate-900/5">
      <p className="text-xs font-medium text-slate-500 sm:text-sm">{titulo}</p>
      <p className={`mt-2 text-xl font-extrabold tracking-tight sm:text-2xl ${acento}`}>{valor}</p>
      {detalle && <p className="mt-1 text-xs text-slate-500">{detalle}</p>}
      {barra !== undefined && (
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${barra * 100}%` }} />
        </div>
      )}
    </div>
  )
}
