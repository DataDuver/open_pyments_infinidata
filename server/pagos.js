import { createHash, createPrivateKey, randomBytes, randomUUID } from 'node:crypto'
import fs from 'node:fs'
import {
  createAuthenticatedClient,
  isFinalizedGrantWithAccessToken,
  isPendingGrant,
} from '@interledger/open-payments'
import { enTransaccion, q } from './db.js'

const log = (...args) => console.log('[open-payments]', ...args)

export class ErrorUsuario extends Error {
  constructor(mensaje, status = 400) {
    super(mensaje)
    this.status = status
  }
}

/** Mensaje legible de un error del SDK (trae description/status) o de cualquier otro. */
export const mensajeDe = (e) =>
  [e?.description || e?.message || String(e), e?.status && `(HTTP ${e.status})`]
    .filter(Boolean)
    .join(' ')

// ---------------------------------------------------------------------------
// Cliente de Open Payments: la app se identifica con su propia wallet y llave
// ---------------------------------------------------------------------------

function llavePrivada() {
  // En Azure la llave va en OP_PRIVATE_KEY (PEM con \n o en base64); en local, en un archivo
  const texto = process.env.OP_PRIVATE_KEY
    ? process.env.OP_PRIVATE_KEY.includes('BEGIN')
      ? process.env.OP_PRIVATE_KEY.replace(/\\n/g, '\n')
      : Buffer.from(process.env.OP_PRIVATE_KEY, 'base64').toString('utf8')
    : fs.readFileSync(process.env.OP_PRIVATE_KEY_PATH || 'private.key', 'utf8')
  return createPrivateKey(texto)
}

let clientePromesa
function cliente() {
  clientePromesa ??= createAuthenticatedClient({
    walletAddressUrl: process.env.OP_CLIENT_WALLET,
    keyId: process.env.OP_KEY_ID,
    privateKey: llavePrivada(),
  }).catch((e) => {
    clientePromesa = undefined
    throw e
  })
  return clientePromesa
}

/** Acepta "https://ilp.../x", "$ilp.../x" o "ilp.../x". */
export function normalizarWallet(texto) {
  let s = String(texto ?? '').trim()
  if (s.startsWith('$')) s = `https://${s.slice(1)}`
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`
  return s.replace(/\/+$/, '')
}

// La wallet del admin casi no cambia: se guarda en memoria unos minutos
const wallets = new Map()
async function walletAdmin(url) {
  const guardada = wallets.get(url)
  if (guardada && guardada.vence > Date.now()) return guardada.wallet
  const wallet = await (await cliente()).walletAddress.get({ url })
  wallets.set(url, { wallet, vence: Date.now() + 10 * 60_000 })
  return wallet
}

// Token para crear y leer pagos entrantes en la wallet del admin (permiso sin interacción)
const tokens = new Map()
async function tokenCobros(wallet) {
  const guardado = tokens.get(wallet.authServer)
  if (guardado && guardado.vence > Date.now()) return guardado.valor
  const grant = await (await cliente()).grant.request(
    { url: wallet.authServer },
    {
      access_token: {
        access: [{ type: 'incoming-payment', actions: ['create', 'read', 'complete'] }],
      },
    },
  )
  if (!isFinalizedGrantWithAccessToken(grant)) {
    throw new Error('El servidor de la wallet del conjunto no entregó el permiso de cobro')
  }
  const segundos = Number(grant.access_token.expires_in) || 300
  tokens.set(wallet.authServer, {
    valor: grant.access_token.value,
    vence: Date.now() + (segundos - 30) * 1000,
  })
  return grant.access_token.value
}

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

const SELECT_COBRO = `
  SELECT c.*, u.torre, u.apto, co.nombre AS conjunto, co.wallet_address AS wallet_admin
  FROM cuota c
  JOIN unidad u ON u.id = c.unidad_id
  JOIN conjunto co ON co.id = u.conjunto_id`

export async function cobroPorToken(token) {
  const {
    rows: [cuota],
  } = await q(`${SELECT_COBRO} WHERE c.token = $1`, [token])
  return cuota
}

const etiqueta = (cuota) =>
  `Administración ${cuota.periodo.slice(0, 7)} · Torre ${cuota.torre} Apto ${cuota.apto}`

/** Pago entrante de la cuota en la wallet del admin. Se crea una vez y se reusa entre intentos. */
async function asegurarCobro(cuota, admin) {
  const c = await cliente()
  const accessToken = await tokenCobros(admin)
  const vigente =
    cuota.incoming_payment_url &&
    new Date(cuota.incoming_payment_expira) > new Date(Date.now() + 15 * 60_000)
  if (vigente) return c.incomingPayment.get({ url: cuota.incoming_payment_url, accessToken })

  const cobro = await c.incomingPayment.create(
    { url: admin.resourceServer, accessToken },
    {
      walletAddress: admin.id,
      incomingAmount: {
        value: String(cuota.valor),
        assetCode: admin.assetCode,
        assetScale: admin.assetScale,
      },
      expiresAt: new Date(Date.now() + 24 * 3600_000).toISOString(),
      metadata: { description: etiqueta(cuota), externalRef: `cuota-${cuota.id}` },
    },
  )
  await q(`UPDATE cuota SET incoming_payment_url = $2, incoming_payment_expira = $3 WHERE id = $1`, [
    cuota.id,
    cobro.id,
    cobro.expiresAt,
  ])
  log(`Pago entrante creado para ${etiqueta(cuota)}: ${cobro.id}`)
  return cobro
}

async function cotizar(pagador, receiver) {
  const c = await cliente()
  const grant = await c.grant.request(
    { url: pagador.authServer },
    { access_token: { access: [{ type: 'quote', actions: ['create', 'read'] }] } },
  )
  if (!isFinalizedGrantWithAccessToken(grant)) {
    throw new Error('La wallet del pagador no entregó el permiso de cotización')
  }
  return c.quote.create(
    { url: pagador.resourceServer, accessToken: grant.access_token.value },
    { walletAddress: pagador.id, receiver, method: 'ilp' },
  )
}

async function marcarCuotaPagada(cuotaId) {
  await q(`UPDATE cuota SET estado = 'AL_DIA', pagada_en = coalesce(pagada_en, now()) WHERE id = $1`, [
    cuotaId,
  ])
}

// ---------------------------------------------------------------------------
// Paso 1: el pagador escribe su wallet → cotizamos y lo mandamos a aprobar
// ---------------------------------------------------------------------------

export async function iniciarPago({ token, wallet, urlBase }) {
  const cuota = await cobroPorToken(token)
  if (!cuota) throw new ErrorUsuario('Este enlace de pago no existe', 404)
  if (cuota.estado === 'AL_DIA') throw new ErrorUsuario('Esta cuota ya está pagada', 409)

  const { rowCount: enCurso } = await q(
    `SELECT 1 FROM pago WHERE cuota_id = $1 AND estado IN ('ENVIANDO', 'ENVIADO')`,
    [cuota.id],
  )
  if (enCurso) throw new ErrorUsuario('Ya hay un pago en camino para esta cuota', 409)

  const c = await cliente()
  const admin = await walletAdmin(cuota.wallet_admin)
  if (admin.assetCode !== cuota.moneda) {
    throw new Error(
      `La wallet del conjunto está en ${admin.assetCode} y la cuota en ${cuota.moneda}`,
    )
  }

  let pagador
  try {
    pagador = await c.walletAddress.get({ url: normalizarWallet(wallet) })
  } catch {
    throw new ErrorUsuario(
      'No encontramos esa wallet. Revisa la dirección, ej: https://ilp.interledger-test.dev/tu-wallet',
    )
  }
  if (pagador.id === admin.id) {
    throw new ErrorUsuario('Esa es la wallet del conjunto; escribe la wallet desde la que vas a pagar')
  }

  const cobro = await asegurarCobro(cuota, admin)
  if (cobro.completed) {
    await marcarCuotaPagada(cuota.id)
    throw new ErrorUsuario('Esta cuota ya está pagada', 409)
  }

  const quote = await cotizar(pagador, cobro.id)

  const id = randomUUID()
  const nonce = randomBytes(16).toString('hex')
  const grant = await c.grant.request(
    { url: pagador.authServer },
    {
      access_token: {
        access: [
          {
            type: 'outgoing-payment',
            actions: ['create', 'read'],
            identifier: pagador.id,
            limits: { debitAmount: quote.debitAmount },
          },
        ],
      },
      interact: {
        start: ['redirect'],
        finish: { method: 'redirect', uri: `${urlBase}/api/pagos/${id}/retorno`, nonce },
      },
    },
  )
  if (!isPendingGrant(grant)) {
    throw new Error('La wallet del pagador no pidió aprobación para el pago')
  }

  await enTransaccion(async (db) => {
    // Si había un intento anterior a medio camino, este lo reemplaza
    await db.query(
      `UPDATE pago SET estado = 'CANCELADO', actualizado = now()
       WHERE cuota_id = $1 AND estado = 'ESPERANDO_APROBACION'`,
      [cuota.id],
    )
    await db.query(
      `INSERT INTO pago (id, cuota_id, estado, wallet_pagador, auth_server, quote_id,
                         debito_valor, debito_moneda, debito_escala, nonce, nonce_servidor,
                         continue_uri, continue_token)
       VALUES ($1, $2, 'ESPERANDO_APROBACION', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        id,
        cuota.id,
        pagador.id,
        pagador.authServer,
        quote.id,
        quote.debitAmount.value,
        quote.debitAmount.assetCode,
        quote.debitAmount.assetScale,
        nonce,
        grant.interact.finish,
        grant.continue.uri,
        grant.continue.access_token.value,
      ],
    )
  })
  log(`Pago ${id} esperando aprobación de ${pagador.id}`)
  return { pagoId: id, redirect: grant.interact.redirect }
}

// ---------------------------------------------------------------------------
// Paso 2: la wallet devuelve al pagador → continuamos el permiso y enviamos
// ---------------------------------------------------------------------------

function hashValido(pago, interactRef, hash) {
  // sha-256(nonce cliente \n nonce servidor \n interact_ref \n URL del servidor de autorización)
  const base = `${pago.nonce}\n${pago.nonce_servidor}\n${interactRef}\n`
  return [pago.auth_server, `${pago.auth_server}/`].some(
    (url) => createHash('sha256').update(base + url).digest('base64') === hash,
  )
}

export async function finalizarPago(id, { interact_ref: interactRef, hash, result }) {
  // Solo un retorno procesa el pago, aunque el navegador repita la redirección
  const {
    rows: [pago],
  } = await q(
    `WITH tomado AS (
       UPDATE pago SET estado = 'ENVIANDO', actualizado = now()
       WHERE id = $1 AND estado = 'ESPERANDO_APROBACION' RETURNING *)
     SELECT tomado.*, c.incoming_payment_url FROM tomado JOIN cuota c ON c.id = tomado.cuota_id`,
    [id],
  )
  if (!pago) return

  try {
    if (result === 'grant_rejected' || !interactRef) {
      await q(`UPDATE pago SET estado = 'RECHAZADO', actualizado = now() WHERE id = $1`, [id])
      log(`Pago ${id} rechazado por el pagador`)
      return
    }
    if (!hashValido(pago, interactRef, hash)) {
      // El servidor valida igual el interact_ref en grant.continue; esto queda como alerta
      log(`Pago ${id}: el hash del retorno no coincide, se continúa y el servidor decide`)
    }

    const c = await cliente()
    const grant = await c.grant.continue(
      { url: pago.continue_uri, accessToken: pago.continue_token },
      { interact_ref: interactRef },
    )
    if (!isFinalizedGrantWithAccessToken(grant)) throw new Error('El permiso no quedó aprobado')
    const accessToken = grant.access_token.value

    const pagador = await c.walletAddress.get({ url: pago.wallet_pagador })
    const crear = (quoteId) =>
      c.outgoingPayment.create(
        { url: pagador.resourceServer, accessToken },
        { walletAddress: pagador.id, quoteId },
      )

    let quoteId = pago.quote_id
    let saliente
    try {
      saliente = await crear(quoteId)
    } catch (e) {
      // La cotización vence a los pocos minutos: si el pagador se demoró aprobando, se recotiza
      log(`Pago ${id}: reintentando con cotización nueva (${mensajeDe(e)})`)
      const quote = await cotizar(pagador, pago.incoming_payment_url)
      if (BigInt(quote.debitAmount.value) > BigInt(pago.debito_valor)) {
        throw new Error('El valor a debitar subió desde que aprobaste; intenta de nuevo')
      }
      quoteId = quote.id
      saliente = await crear(quoteId)
    }

    await q(
      `UPDATE pago SET estado = 'ENVIADO', outgoing_payment_url = $2, token_saliente = $3,
                       quote_id = $4, actualizado = now()
       WHERE id = $1`,
      [id, saliente.id, accessToken, quoteId],
    )
    log(`Pago ${id} enviado: ${saliente.id}`)
    await verificarPago(id)
  } catch (e) {
    await q(`UPDATE pago SET estado = 'FALLIDO', error = $2, actualizado = now() WHERE id = $1`, [
      id,
      mensajeDe(e),
    ])
    log(`Pago ${id} falló: ${mensajeDe(e)}`)
  }
}

// ---------------------------------------------------------------------------
// Paso 3: confirmar que la plata llegó a la wallet del admin
// ---------------------------------------------------------------------------

export async function verificarPago(id) {
  const {
    rows: [pago],
  } = await q(
    `SELECT p.*, c.incoming_payment_url, co.wallet_address AS wallet_admin
     FROM pago p
     JOIN cuota c ON c.id = p.cuota_id
     JOIN unidad u ON u.id = c.unidad_id
     JOIN conjunto co ON co.id = u.conjunto_id
     WHERE p.id = $1 AND p.estado = 'ENVIADO'`,
    [id],
  )
  if (!pago) return

  const c = await cliente()
  const admin = await walletAdmin(pago.wallet_admin)
  const cobro = await c.incomingPayment.get({
    url: pago.incoming_payment_url,
    accessToken: await tokenCobros(admin),
  })

  // La cuota solo queda al día cuando la plata aparece en la wallet del conjunto
  const llegoTodo =
    cobro.completed ||
    (cobro.incomingAmount &&
      BigInt(cobro.receivedAmount.value) >= BigInt(cobro.incomingAmount.value))
  if (llegoTodo) {
    // El front y la tarea de fondo pueden verificar a la vez: solo uno cierra el pago
    const cerrado = await enTransaccion(async (db) => {
      const { rowCount } = await db.query(
        `UPDATE pago SET estado = 'COMPLETADO', recibido_valor = $2, completado = now(), actualizado = now()
         WHERE id = $1 AND estado = 'ENVIADO'`,
        [id, cobro.receivedAmount.value],
      )
      if (rowCount) {
        await db.query(
          `UPDATE cuota SET estado = 'AL_DIA', pagada_en = now() WHERE id = $1`,
          [pago.cuota_id],
        )
      }
      return rowCount > 0
    })
    if (cerrado) log(`Pago ${id} completado`)
    return
  }

  const saliente = await c.outgoingPayment
    .get({ url: pago.outgoing_payment_url, accessToken: pago.token_saliente })
    .catch(() => null)
  const motivo = saliente?.failed
    ? 'La wallet del pagador no pudo completar el envío (¿saldo insuficiente?)'
    : Date.now() - new Date(pago.actualizado).getTime() > 10 * 60_000
      ? 'El pago no llegó a tiempo a la wallet del conjunto'
      : null
  if (motivo) {
    await q(
      `UPDATE pago SET estado = 'FALLIDO', error = $2, actualizado = now() WHERE id = $1 AND estado = 'ENVIADO'`,
      [id, motivo],
    )
    log(`Pago ${id} falló: ${motivo}`)
  }
}

// ---------------------------------------------------------------------------
// Tarea de fondo: confirmar pagos en camino y limpiar intentos colgados
// ---------------------------------------------------------------------------

let revisando = false
export async function revisarPagosEnCamino() {
  if (revisando) return
  revisando = true
  try {
    // Si el servidor se reinició a mitad de un envío, ese intento no se recupera
    await q(
      `UPDATE pago SET estado = 'FALLIDO', error = 'Se interrumpió el envío', actualizado = now()
       WHERE estado = 'ENVIANDO' AND actualizado < now() - interval '5 minutes'`,
    )
    // Quien abrió su wallet y nunca aprobó: el intento se cierra solo
    await q(
      `UPDATE pago SET estado = 'CANCELADO', actualizado = now()
       WHERE estado = 'ESPERANDO_APROBACION' AND creado < now() - interval '30 minutes'`,
    )
    const { rows } = await q(`SELECT id FROM pago WHERE estado = 'ENVIADO'`)
    for (const { id } of rows) {
      await verificarPago(id).catch((e) => log(`No se pudo verificar ${id}: ${mensajeDe(e)}`))
    }
  } finally {
    revisando = false
  }
}
