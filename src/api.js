export async function api(ruta, opciones = {}) {
  const respuesta = await fetch(`/api${ruta}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opciones,
  })
  const datos = await respuesta.json().catch(() => ({}))
  if (!respuesta.ok) throw new Error(datos.error || 'Algo salió mal, intenta de nuevo')
  return datos
}

export const dinero = (valor, moneda = 'USD', escala = 2) =>
  (Number(valor) / 10 ** Number(escala)).toLocaleString('es-CO', {
    style: 'currency',
    currency: moneda,
  })

/** '2026-10-01' → 'Octubre de 2026' */
export function mes(periodo) {
  const texto = new Date(`${periodo}T00:00:00Z`).toLocaleDateString('es-CO', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
  return texto[0].toUpperCase() + texto.slice(1)
}

export const fecha = (dia) =>
  new Date(`${dia}T00:00:00Z`).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })

export const fechaHora = (iso) =>
  new Date(iso).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })

/** 'https://ilp.interledger-test.dev/ana' → '$ilp.interledger-test.dev/ana' */
export const puntero = (url) => (url ? url.replace(/^https:\/\//, '$') : '')
