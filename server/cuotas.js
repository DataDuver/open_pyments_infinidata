import { aplicarEsquema, enTransaccion, q } from './db.js'

const VENCE = `(periodo + interval '1 month - 1 day')::date` // último día del mes

/** Crea la cuota del mes actual para cada unidad que todavía no la tenga. */
export async function generarCuotasDelMes() {
  const { rowCount } = await q(`
    INSERT INTO cuota (unidad_id, periodo, valor, vence)
    SELECT id, p.periodo, valor_cuota, ${VENCE}
    FROM unidad, (SELECT date_trunc('month', current_date)::date AS periodo) p
    ON CONFLICT (unidad_id, periodo) DO NOTHING`)
  if (rowCount) console.log(`[cuotas] ${rowCount} cuotas nuevas del mes`)
}

/** Las cuotas pendientes que ya vencieron pasan a mora. */
export async function marcarMora() {
  await q(`UPDATE cuota SET estado = 'EN_MORA' WHERE estado = 'PENDIENTE' AND vence < current_date`)
}

/**
 * Datos de demo: 3 torres x 5 pisos x 2 aptos y los últimos 6 meses de cuotas,
 * mezclando unidades al día, pendientes y en mora.
 * Torre 1 - 101 queda con 3 meses en mora; Torre 1 - 102 queda al día.
 */
export async function sembrarDemo() {
  await enTransaccion(async (db) => {
    const {
      rows: [conjunto],
    } = await db.query(
      `INSERT INTO conjunto (nombre, wallet_address) VALUES ($1, $2) RETURNING id`,
      [process.env.CONJUNTO_NOMBRE || 'Conjunto Residencial Los Almendros', process.env.ADMIN_WALLET],
    )

    const {
      rows: [{ mes }],
    } = await db.query(`SELECT to_char(date_trunc('month', current_date), 'YYYY-MM-DD') AS mes`)
    const periodos = [0, 1, 2, 3, 4, 5].map((k) => {
      const d = new Date(`${mes}T00:00:00Z`)
      d.setUTCMonth(d.getUTCMonth() - k)
      return { k, periodo: d.toISOString().slice(0, 10) }
    })

    let i = 0
    for (const torre of ['1', '2', '3']) {
      for (let piso = 1; piso <= 5; piso++) {
        for (const n of [1, 2]) {
          const valor = 3000 + piso * 500 // de 35.00 a 55.00 USD
          const {
            rows: [unidad],
          } = await db.query(
            `INSERT INTO unidad (conjunto_id, torre, apto, valor_cuota) VALUES ($1, $2, $3, $4) RETURNING id`,
            [conjunto.id, torre, `${piso}0${n}`, valor],
          )

          const mesesMora = i % 5 === 0 ? 3 : i % 7 === 0 ? 1 : 0
          for (const { k, periodo } of periodos) {
            const estado =
              k === 0
                ? mesesMora === 0 && i % 3 === 1
                  ? 'AL_DIA'
                  : 'PENDIENTE'
                : k <= mesesMora
                  ? 'EN_MORA'
                  : 'AL_DIA'
            await db.query(
              `INSERT INTO cuota (unidad_id, periodo, valor, vence, estado, pagada_en)
               VALUES ($1, $2::date, $3, ($2::date + interval '1 month - 1 day')::date, $4,
                       CASE WHEN $4 = 'AL_DIA' THEN least($2::date + interval '5 days 10 hours', now()) END)`,
              [unidad.id, periodo, valor, estado],
            )
          }
          i++
        }
      }
    }
    console.log(`[cuotas] Datos de demo creados: ${i} unidades, ${i * periodos.length} cuotas`)
  })
}

/** Deja la base lista: esquema, datos de demo si está vacía y cuotas del mes al día. */
export async function prepararBase() {
  await aplicarEsquema()
  const {
    rows: [{ n }],
  } = await q('SELECT count(*)::int AS n FROM conjunto')
  if (n === 0) await sembrarDemo()
  await generarCuotasDelMes()
  await marcarMora()
}
