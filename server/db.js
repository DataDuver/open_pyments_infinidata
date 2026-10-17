import fs from 'node:fs'
import pg from 'pg'
import './config.js'

// DATE como texto 'YYYY-MM-DD': sin corrimientos de un día por zona horaria
pg.types.setTypeParser(1082, (v) => v)

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

export const q = (texto, params) => pool.query(texto, params)

export async function enTransaccion(fn) {
  const cliente = await pool.connect()
  try {
    await cliente.query('BEGIN')
    const resultado = await fn(cliente)
    await cliente.query('COMMIT')
    return resultado
  } catch (e) {
    await cliente.query('ROLLBACK')
    throw e
  } finally {
    cliente.release()
  }
}

export async function aplicarEsquema() {
  await q(fs.readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8'))
}
