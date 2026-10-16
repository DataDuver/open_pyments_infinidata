import { useEffect, useState } from "react";
import { api, dinero, fecha, fechaHora, mes, puntero } from "../api.js";
import Layout from "../components/Layout.jsx";
import Card from "../components/Card.jsx";
import Badge from "../components/Badge.jsx";

export default function Admin() {
  const [resumen, setResumen] = useState(null);
  const [pagos, setPagos] = useState([]);
  const [mora, setMora] = useState([]);
  const [error, setError] = useState(null);

  async function cargar() {
    try {
      const [r, p, m] = await Promise.all([
        api("/admin/resumen"),
        api("/admin/pagos"),
        api("/admin/mora"),
      ]);
      setResumen(r);
      setPagos(p);
      setMora(m);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    cargar();
    const id = setInterval(cargar, 4000);
    return () => clearInterval(id);
  }, []);

  const kpis = resumen
    ? [
        { etiqueta: "Recaudado", valor: dinero(resumen.recaudadoTotal) },
        { etiqueta: "Unidades en mora", valor: resumen.unidadesEnMora },
        { etiqueta: "Pendiente por cobrar", valor: dinero(resumen.pendientePorCobrar) },
        { etiqueta: "Pagos hoy", valor: resumen.pagosHoy },
      ]
    : [];

  return (
    <Layout titulo="Panel del administrador" ancho="max-w-md sm:max-w-4xl">
      <div className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm ring-1 ring-slate-100">
        <span className="relative flex size-2.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
        </span>
        En vivo
      </div>

      {error && (
        <Card>
          <p className="text-sm text-red-600">{error}</p>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.etiqueta}>
            <p className="text-xs font-medium text-slate-500">{k.etiqueta}</p>
            <p className="mt-1 text-xl font-bold text-slate-800">{k.valor}</p>
          </Card>
        ))}
      </div>

      <Card>
        <h2 className="text-sm font-semibold text-slate-600">Últimos pagos</h2>
        {pagos.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">Todavía no hay pagos registrados</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {pagos.map((p) => (
              <li key={p.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800">
                    {p.unidad.torre} · Apto {p.unidad.apto}
                    <span className="ml-2 font-normal text-slate-400">· {mes(p.periodo)}</span>
                  </p>
                  <p className="min-w-0 font-mono text-xs break-all text-slate-400">
                    {puntero(p.walletPagador)}
                  </p>
                  <p className="text-xs text-slate-400">{fechaHora(p.creado)}</p>
                </div>
                <div className="flex shrink-0 items-center justify-between gap-3 sm:flex-col sm:items-end sm:gap-1">
                  <span className="font-semibold text-slate-800">
                    {p.valor !== null ? dinero(p.valor, p.moneda) : "—"}
                  </span>
                  <Badge estado={p.estado} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-slate-600">Unidades en mora</h2>
        {mora.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">No hay unidades en mora</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {mora.map((u) => (
              <li key={`${u.torre}-${u.apto}`} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800">
                    {u.torre} · Apto {u.apto}
                  </p>
                  <p className="text-xs text-slate-400">
                    {u.cuotas} {u.cuotas === 1 ? "cuota" : "cuotas"} · vence desde {fecha(u.venceMasAntigua)}
                  </p>
                </div>
                <span className="shrink-0 font-semibold text-red-600">{dinero(u.total)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </Layout>
  );
}
