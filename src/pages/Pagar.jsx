import { useEffect, useRef, useState } from "react";
import { api, dinero, fechaHora, mes, puntero } from "../api.js";
import Layout from "../components/Layout.jsx";
import Card from "../components/Card.jsx";
import CampoDato from "../components/CampoDato.jsx";

const CLAVE_WALLET = "al-dia:wallet-pagador";

function leerWalletGuardada() {
  try {
    return localStorage.getItem(CLAVE_WALLET) || "";
  } catch {
    return "";
  }
}

function guardarWallet(valor) {
  try {
    localStorage.setItem(CLAVE_WALLET, valor);
  } catch {
    // almacenamiento no disponible (modo privado, cuota llena, etc.)
  }
}

const ESTADOS_TERMINALES = ["COMPLETADO", "RECHAZADO", "FALLIDO", "CANCELADO"];
const ESTADOS_CON_ERROR = ["RECHAZADO", "FALLIDO", "CANCELADO"];

function IconoCheck() {
  return (
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
  );
}

export default function Pagar({ token }) {
  const [cuota, setCuota] = useState(null);
  const [error, setError] = useState(null);
  const [walletPagador, setWalletPagador] = useState(leerWalletGuardada);
  const [enviando, setEnviando] = useState(false);
  const [pago, setPago] = useState(null);
  const intervaloRef = useRef(null);

  useEffect(() => {
    api(`/cuotas/${token}`)
      .then(setCuota)
      .catch((err) => setError(err.message));
  }, [token]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pagoId = params.get("pago");
    const interactRef = params.get("interact_ref");
    if (pagoId) {
      consultarPago(pagoId, interactRef);
      intervaloRef.current = setInterval(() => consultarPago(pagoId, interactRef), 2000);
    }
    return () => clearInterval(intervaloRef.current);
  }, []);

  async function consultarPago(pagoId, interactRef) {
    try {
      const query = interactRef ? `?interact_ref=${encodeURIComponent(interactRef)}` : "";
      const res = await api(`/pagos/${pagoId}${query}`);
      setPago(res);
      if (ESTADOS_TERMINALES.includes(res.estado)) {
        clearInterval(intervaloRef.current);
      }
    } catch (err) {
      // error transitorio de red: se reintenta en el próximo tick, no se detiene el polling
      setError(err.message);
    }
  }

  async function pagar(e) {
    e.preventDefault();
    if (!walletPagador.trim()) return;
    setEnviando(true);
    setError(null);
    guardarWallet(walletPagador.trim());
    try {
      const res = await api("/pagos", {
        method: "POST",
        body: JSON.stringify({ token, walletPagador: walletPagador.trim() }),
      });
      window.history.replaceState(null, "", `/pagar/${token}?pago=${res.pagoId}`);
      if (res.redirect) {
        window.location.href = res.redirect;
      } else {
        setPago({ estado: "ESPERANDO_APROBACION" });
        consultarPago(res.pagoId);
        intervaloRef.current = setInterval(() => consultarPago(res.pagoId), 2000);
      }
    } catch (err) {
      setError(err.message);
      setEnviando(false);
    }
  }

  function reintentar() {
    window.history.replaceState(null, "", `/pagar/${token}`);
    setPago(null);
    setError(null);
    setEnviando(false);
  }

  if (error && !cuota) {
    return (
      <Layout titulo="Pagar cuota">
        <Card>
          <p className="text-sm text-red-600">{error}</p>
        </Card>
      </Layout>
    );
  }

  if (!cuota) {
    return (
      <Layout titulo="Pagar cuota">
        <Card>
          <p className="text-sm text-slate-400">Cargando…</p>
        </Card>
      </Layout>
    );
  }

  const esError = pago && ESTADOS_CON_ERROR.includes(pago.estado);
  const reciénPagada = pago?.estado === "COMPLETADO";
  const yaPagada = cuota.cuota.estado === "AL_DIA" || reciénPagada;
  const fechaPago = pago?.completado || cuota.cuota.pagadaEn;

  if (yaPagada) {
    return (
      <Layout titulo="Pagar cuota" subtitulo={`${cuota.unidad.torre} · Apto ${cuota.unidad.apto}`}>
        <Card className="text-center">
          <IconoCheck />
          <p className="mt-3 text-lg font-bold text-slate-800">
            {reciénPagada ? "¡Pago recibido!" : "Esta cuota ya está pagada"}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {mes(cuota.cuota.periodo)} · {dinero(cuota.cuota.valor, cuota.cuota.moneda, cuota.cuota.escala)}
          </p>
          {fechaPago && <p className="mt-1 text-xs text-slate-400">Pagada el {fechaHora(fechaPago)}</p>}
          <a
            href="/"
            className="mt-4 inline-block rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Consultar otro apartamento
          </a>
        </Card>
      </Layout>
    );
  }

  return (
    <Layout titulo="Pagar cuota" subtitulo={`${cuota.unidad.torre} · Apto ${cuota.unidad.apto}`}>
      <Card>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <h2 className="text-lg font-bold text-slate-800">{mes(cuota.cuota.periodo)}</h2>
          <p className="whitespace-nowrap text-2xl font-bold text-emerald-600">
            {dinero(cuota.cuota.valor, cuota.cuota.moneda, cuota.cuota.escala)}
          </p>
        </div>
        <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
          <CampoDato etiqueta="Recibe" mono>
            {puntero(cuota.adminWallet)}
          </CampoDato>
          <CampoDato etiqueta="Red">Interledger (red de pruebas)</CampoDato>
          {pago?.walletPagador && (
            <CampoDato etiqueta="Desde" mono>
              {puntero(pago.walletPagador)}
            </CampoDato>
          )}
          {pago?.debitado && (
            <CampoDato etiqueta="Debitado">
              {dinero(pago.debitado.valor, pago.debitado.moneda)}
            </CampoDato>
          )}
        </div>
      </Card>

      {!pago && (
        <Card>
          <form onSubmit={pagar} className="space-y-3">
            <label className="block">
              <span className="text-sm text-slate-500">Tu wallet de Interledger</span>
              <input
                type="text"
                value={walletPagador}
                onChange={(e) => setWalletPagador(e.target.value)}
                placeholder="$ilp.interledger-test.dev/tu-wallet"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-mono outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                required
              />
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={enviando}
              className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {enviando ? "Conectando con tu wallet…" : `Pagar ${dinero(cuota.cuota.valor, cuota.cuota.moneda, cuota.cuota.escala)}`}
            </button>
          </form>
        </Card>
      )}

      {pago && !esError && (
        <Card className="text-center">
          <div className="mx-auto size-8 animate-spin rounded-full border-4 border-emerald-100 border-t-emerald-500" />
          <p className="mt-3 text-sm font-medium text-slate-600">Confirmando tu pago…</p>
          <p className="mt-1 text-xs text-slate-400">Esto puede tardar unos segundos</p>
        </Card>
      )}

      {esError && (
        <Card className="text-center">
          <p className="text-sm font-semibold text-red-600">
            {pago.estado === "RECHAZADO" ? "El pago fue rechazado" : "El pago no se pudo completar"}
          </p>
          {pago.error && <p className="mt-1 text-xs text-slate-500">{pago.error}</p>}
          <button
            type="button"
            onClick={reintentar}
            className="mt-4 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Reintentar
          </button>
        </Card>
      )}
    </Layout>
  );
}
