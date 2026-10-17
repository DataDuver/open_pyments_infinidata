import dgram from 'node:dgram'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { pool, q } from './db.js'
import { generarCuotasDelMes, marcarMora, prepararBase } from './cuotas.js'
import {
  ErrorUsuario,
  cobroPorToken,
  finalizarPago,
  iniciarPago,
  mensajeDe,
  revisarPagosEnCamino,
  verificarPago,
} from './pagos.js'

const app = express()
app.set('trust proxy', true) // Azure entrega HTTPS a través de un proxy
app.use(express.json())

// URL pública de la app, para que la wallet devuelva al pagador aquí después de aprobar
const urlBase = (req) =>
  process.env.PUBLIC_URL?.replace(/\/+$/, '') || `${req.protocol}://${req.get('host')}`

/** IP del computador en la red local: la de la interfaz por donde el sistema sale a internet. */
function ipLocal() {
  return new Promise((resolve) => {
    const socket = dgram.createSocket('udp4')
    const respaldo = () => {
      socket.close()
      // Sin internet: primera IPv4 que no sea de una red virtual
      const red = Object.entries(os.networkInterfaces())
        .filter(([nombre]) => !/tailscale|vethernet|wsl|docker|virtualbox|vmware/i.test(nombre))
        .flatMap(([, redes]) => redes ?? [])
        .find((r) => r.family === 'IPv4' && !r.internal)
      resolve(red?.address)
    }
    socket.on('error', respaldo)
    // connect en UDP no envía paquetes: solo pide al sistema la ruta de salida
    socket.connect(53, '1.1.1.1', () => {
      const { address } = socket.address()
      socket.close()
      resolve(address)
    })
  })
}

// Si la app se abrió como localhost, un QR con "localhost" no le sirve al celular:
// se cambia por la IP del computador en la red WiFi
async function urlParaQR(req) {
  const base = urlBase(req)
  if (process.env.PUBLIC_URL) return base
  const url = new URL(base)
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return base
  const ip = await ipLocal()
  if (!ip) return base
  url.hostname = ip
  return url.origin
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const CAMPOS_PAGO = `p.id, p.estado, p.wallet_pagador, p.debito_valor, p.debito_moneda,
  p.debito_escala, p.recibido_valor, p.error, p.creado, p.completado`

// --- Propietario ------------------------------------------------------------

app.get('/api/conjunto', async (req, res) => {
  const {
    rows: [conjunto],
  } = await q('SELECT nombre, wallet_address FROM conjunto ORDER BY id LIMIT 1')
  const { rows } = await q('SELECT DISTINCT torre FROM unidad ORDER BY torre')
  res.json({ ...conjunto, torres: rows.map((r) => r.torre), url_qr: await urlParaQR(req) })
})

app.get('/api/unidades/:torre/:apto', async (req, res) => {
  const { rows } = await q(
    `SELECT c.id, c.periodo, c.valor, c.moneda, c.escala, c.vence, c.estado, c.token, c.pagada_en
     FROM cuota c JOIN unidad u ON u.id = c.unidad_id
     WHERE u.torre = $1 AND u.apto = $2
     ORDER BY c.periodo`,
    [req.params.torre, req.params.apto.trim()],
  )
  if (!rows.length) throw new ErrorUsuario('No encontramos ese apartamento en esta torre', 404)
  res.json({ torre: req.params.torre, apto: req.params.apto.trim(), cuotas: rows })
})

async function ultimoPago(cuotaId) {
  const {
    rows: [pago],
  } = await q(
    `SELECT ${CAMPOS_PAGO} FROM pago p
     WHERE p.cuota_id = $1 AND p.estado <> 'CANCELADO' ORDER BY p.creado DESC LIMIT 1`,
    [cuotaId],
  )
  return pago ?? null
}

app.get('/api/cobros/:token', async (req, res) => {
  const cuota = await cobroPorToken(req.params.token)
  if (!cuota) throw new ErrorUsuario('Este enlace de pago no existe', 404)
  res.json({
    periodo: cuota.periodo,
    valor: cuota.valor,
    moneda: cuota.moneda,
    escala: cuota.escala,
    vence: cuota.vence,
    estado: cuota.estado,
    pagada_en: cuota.pagada_en,
    torre: cuota.torre,
    apto: cuota.apto,
    conjunto: cuota.conjunto,
    wallet_admin: cuota.wallet_admin,
    ultimo_pago: await ultimoPago(cuota.id),
  })
})

app.post('/api/cobros/:token/pagar', async (req, res) => {
  if (!req.body?.wallet) throw new ErrorUsuario('Escribe la dirección de tu wallet')
  res.json(await iniciarPago({ token: req.params.token, wallet: req.body.wallet, urlBase: urlBase(req) }))
})

// La wallet del pagador redirige aquí después de aprobar (o rechazar)
app.get('/api/pagos/:id/retorno', async (req, res) => {
  if (!UUID.test(req.params.id)) throw new ErrorUsuario('Pago no encontrado', 404)
  await finalizarPago(req.params.id, req.query)
  const {
    rows: [fila],
  } = await q(`SELECT c.token FROM pago p JOIN cuota c ON c.id = p.cuota_id WHERE p.id = $1`, [
    req.params.id,
  ])
  if (!fila) throw new ErrorUsuario('Pago no encontrado', 404)
  res.redirect(`/pagar/${fila.token}?pago=${req.params.id}`)
})

app.get('/api/pagos/:id', async (req, res) => {
  if (!UUID.test(req.params.id)) throw new ErrorUsuario('Pago no encontrado', 404)
  // Mientras el front espera, se consulta directo a la wallet del conjunto
  await verificarPago(req.params.id).catch((e) => console.warn('[api]', mensajeDe(e)))
  const {
    rows: [pago],
  } = await q(`SELECT ${CAMPOS_PAGO} FROM pago p WHERE p.id = $1`, [req.params.id])
  if (!pago) throw new ErrorUsuario('Pago no encontrado', 404)
  res.json(pago)
})

// --- Administrador ----------------------------------------------------------

app.get('/api/admin/resumen', async (_req, res) => {
  const [indicadores, recaudo, pagos, morosos] = await Promise.all([
    q(`SELECT
         count(*) FILTER (WHERE estado = 'EN_MORA')::int AS cuotas_mora,
         coalesce(sum(valor) FILTER (WHERE estado = 'EN_MORA'), 0) AS valor_mora,
         count(*) FILTER (WHERE estado = 'PENDIENTE')::int AS cuotas_pendientes,
         coalesce(sum(valor) FILTER (WHERE estado = 'PENDIENTE'), 0) AS valor_pendiente,
         count(*) FILTER (WHERE periodo = date_trunc('month', current_date)::date)::int AS cuotas_mes,
         count(*) FILTER (WHERE periodo = date_trunc('month', current_date)::date
                            AND estado = 'AL_DIA')::int AS cuotas_mes_al_dia
       FROM cuota`),
    q(`SELECT count(*)::int AS pagos, coalesce(sum(c.valor), 0) AS valor
       FROM pago p JOIN cuota c ON c.id = p.cuota_id WHERE p.estado = 'COMPLETADO'`),
    q(`SELECT ${CAMPOS_PAGO}, c.periodo, c.valor, c.moneda, c.escala, u.torre, u.apto
       FROM pago p JOIN cuota c ON c.id = p.cuota_id JOIN unidad u ON u.id = c.unidad_id
       WHERE p.estado <> 'CANCELADO'
       ORDER BY p.creado DESC LIMIT 25`),
    q(`SELECT u.torre, u.apto, count(*)::int AS cuotas, sum(c.valor) AS valor
       FROM cuota c JOIN unidad u ON u.id = c.unidad_id
       WHERE c.estado = 'EN_MORA'
       GROUP BY u.torre, u.apto
       ORDER BY sum(c.valor) DESC, u.torre, u.apto`),
  ])
  res.json({
    ...indicadores.rows[0],
    open_payments: recaudo.rows[0],
    pagos: pagos.rows,
    morosos: morosos.rows,
  })
})

// --- Frontend (build de Vite) -------------------------------------------------

const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')
app.use(express.static(dist))
app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api/')) return next()
  res.sendFile(path.join(dist, 'index.html'))
})

app.use('/api', (_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }))

app.use((err, _req, res, _next) => {
  if (err instanceof ErrorUsuario) return res.status(err.status).json({ error: err.message })
  console.error('[api]', err)
  res.status(500).json({ error: `No se pudo completar la operación: ${mensajeDe(err)}` })
})

// --- Arranque -----------------------------------------------------------------

const PUERTO = Number(process.env.PORT) || 3000

await prepararBase()
app.listen(PUERTO, () => console.log(`Al Día escuchando en http://localhost:${PUERTO}`))

const cada = (ms, fn) => setInterval(() => fn().catch((e) => console.error(e)), ms)
cada(4000, revisarPagosEnCamino)
cada(60 * 60_000, async () => {
  await generarCuotasDelMes()
  await marcarMora()
})

process.on('SIGTERM', () => pool.end().finally(() => process.exit(0)))
