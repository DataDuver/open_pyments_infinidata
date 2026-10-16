import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { api, dinero, fecha, mes } from "../api.js";
import Layout from "../components/Layout.jsx";
import Card from "../components/Card.jsx";
import Badge from "../components/Badge.jsx";

export default function Inicio() {
  const [torres, setTorres] = useState([]);
  const [torre, setTorre] = useState(null);
  const [apto, setApto] = useState("");
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [cuotaSeleccionada, setCuotaSeleccionada] = useState(null);
  const [config, setConfig] = useState({ urlQr: window.location.origin, conjuntoNombre: "" });
  const [copiado, setCopiado] = useState(false);
  const qrRef = useRef(null);

  useEffect(() => {
    api("/unidades/torres").then(setTorres).catch(() => setTorres([]));
    api("/config").then(setConfig).catch(() => {});
  }, []);

  useEffect(() => {
    if (!torre || !apto.trim()) {
      setDatos(null);
      setError(null);
      return;
    }
    setCuotaSeleccionada(null);
    const id = setTimeout(async () => {
      setCargando(true);
      setError(null);
      try {
        const res = await api(
          `/unidades/cuotas?torre=${encodeURIComponent(torre)}&apto=${encodeURIComponent(apto.trim())}`
        );
        setDatos(res);
      } catch (err) {
        setDatos(null);
        setError(err.message);
      } finally {
        setCargando(false);
      }
    }, 400);
    return () => clearTimeout(id);
  }, [torre, apto]);

  useEffect(() => {
    if (cuotaSeleccionada) {
      qrRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [cuotaSeleccionada]);

  const enlaceDeEstaDevice = cuotaSeleccionada
    ? `${window.location.origin}/pagar/${cuotaSeleccionada.token}`
    : null;
  const enlaceDeQr = cuotaSeleccionada ? `${config.urlQr}/pagar/${cuotaSeleccionada.token}` : null;
  const mismaRed = !config.urlQr || config.urlQr === window.location.origin;

  async function copiarEnlace() {
    try {
      await navigator.clipboard.writeText(enlaceDeEstaDevice);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setError("No pudimos copiar el enlace, cópialo manualmente");
    }
  }

  return (
    <Layout
      titulo="Tu cuota de administración"
      subtitulo={config.conjuntoNombre || "Paga en segundos con Interledger"}
    >
      <Card>
        <h2 className="text-sm font-semibold text-slate-600">Tu unidad</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {torres.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTorre(t)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                torre === t
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <label className="mt-4 block">
          <span className="text-sm text-slate-500">Apartamento</span>
          <input
            type="text"
            value={apto}
            onChange={(e) => setApto(e.target.value)}
            placeholder="Ej. 302"
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-base outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
        </label>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        {cargando && <p className="mt-3 text-sm text-slate-400">Buscando tu unidad…</p>}
      </Card>

      {datos && datos.pendientes.length === 0 && (
        <Card className="text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-100 text-emerald-600">
            <svg viewBox="0 0 24 24" fill="none" className="size-7">
              <path
                d="M5 13l4 4L19 7"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <p className="mt-3 text-lg font-bold text-slate-800">¡Estás al día!</p>
          <p className="mt-1 text-sm text-slate-500">
            {datos.unidad.torre} · Apto {datos.unidad.apto} no tiene cuotas pendientes
          </p>
        </Card>
      )}

      {datos && datos.pendientes.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold text-slate-600">Cuotas por pagar</h2>
          <ul className="mt-3 divide-y divide-slate-100">
            {datos.pendientes.map((c) => (
              <li key={c.id}>
                <label className="flex min-w-0 items-center gap-3 py-3">
                  <input
                    type="radio"
                    name="cuota"
                    checked={cuotaSeleccionada?.id === c.id}
                    onChange={() => setCuotaSeleccionada(c)}
                    className="size-4 shrink-0 accent-emerald-600"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-800">{mes(c.periodo)}</p>
                    <p className="text-xs text-slate-500">Vence {fecha(c.vence)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-semibold text-slate-800">{dinero(c.valor, c.moneda, c.escala)}</p>
                    <Badge estado={c.estado} />
                  </div>
                </label>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {cuotaSeleccionada && (
        <Card className="text-center" ref={qrRef}>
          <h2 className="text-sm font-semibold text-slate-600">
            Paga {mes(cuotaSeleccionada.periodo)}
          </h2>
          <div className="mt-4 flex justify-center">
            <div className="rounded-2xl bg-white p-3 ring-1 ring-slate-100">
              <QRCodeSVG value={enlaceDeQr} size={200} />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold text-slate-800">
            {dinero(cuotaSeleccionada.valor, cuotaSeleccionada.moneda, cuotaSeleccionada.escala)}
          </p>
          <div className="mt-4 flex flex-col gap-2">
            <a
              href={enlaceDeEstaDevice}
              className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Pagar desde este dispositivo
            </a>
            <button
              type="button"
              onClick={copiarEnlace}
              className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200"
            >
              {copiado ? "¡Copiado!" : "Copiar enlace"}
            </button>
          </div>
          {!mismaRed && (
            <p className="mt-4 text-xs text-slate-400">
              El celular debe estar en la misma red WiFi ({config.urlQr.replace(/^https?:\/\//, "")})
            </p>
          )}
        </Card>
      )}

      <p className="text-center">
        <a href="/admin" className="text-sm text-slate-400 hover:text-slate-600">
          Panel del administrador
        </a>
      </p>
    </Layout>
  );
}
