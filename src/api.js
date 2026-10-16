export async function api(ruta, opciones = {}) {
  const res = await fetch(`/api${ruta}`, {
    headers: { "Content-Type": "application/json" },
    ...opciones,
  });

  let cuerpo = null;
  try {
    cuerpo = await res.json();
  } catch {
    // respuesta sin cuerpo (p.ej. 204)
  }

  if (!res.ok) {
    throw new Error(cuerpo?.error || "No pudimos conectar con el servidor");
  }
  return cuerpo;
}

const formateadoresDinero = new Map();

export function dinero(valor, moneda = "USD", escala = 2) {
  if (!formateadoresDinero.has(moneda)) {
    formateadoresDinero.set(
      moneda,
      new Intl.NumberFormat("es-CO", { style: "currency", currency: moneda })
    );
  }
  return formateadoresDinero.get(moneda).format(Number(valor) / 10 ** escala);
}

function capitalizar(texto) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// periodo/vence son columnas DATE: se formatean en UTC para que el día no
// cambie según la zona horaria del navegador.
export function mes(periodo) {
  const formato = new Intl.DateTimeFormat("es-CO", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return capitalizar(formato.format(new Date(periodo)));
}

export function fecha(valor) {
  const formato = new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return formato.format(new Date(valor));
}

export function fechaHora(valor) {
  const formato = new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  return formato.format(new Date(valor));
}

export function puntero(walletUrl) {
  if (!walletUrl) return "";
  return walletUrl.replace(/^https?:\/\//, "$");
}
