// Prepara la base de datos: la crea si no existe, aplica el esquema y carga los datos de demo.
//   npm run db:setup   → crea lo que falte, no borra nada
//   npm run db:reset   → borra las tablas y vuelve a cargar la demo desde cero
import pg from 'pg'
import '../server/config.js'

const url = new URL(process.env.DATABASE_URL)
const nombre = decodeURIComponent(url.pathname.slice(1))

// Para crear la base hay que conectarse a otra del mismo servidor: la "postgres"
const urlServidor = new URL(url)
urlServidor.pathname = '/postgres'
const servidor = new pg.Client({ connectionString: urlServidor.toString() })
await servidor.connect()
const { rowCount } = await servidor.query('SELECT 1 FROM pg_database WHERE datname = $1', [nombre])
if (!rowCount) {
  await servidor.query(`CREATE DATABASE "${nombre.replaceAll('"', '""')}"`)
  console.log(`Base de datos "${nombre}" creada`)
}
await servidor.end()

const { pool } = await import('../server/db.js')
const { prepararBase } = await import('../server/cuotas.js')

if (process.argv.includes('--reset')) {
  await pool.query('DROP TABLE IF EXISTS pago, cuota, unidad, conjunto CASCADE')
  console.log('Tablas borradas')
}
await prepararBase()

const {
  rows: [r],
} = await pool.query(`SELECT
  (SELECT count(*) FROM unidad)::int AS unidades,
  (SELECT count(*) FROM cuota)::int AS cuotas,
  (SELECT count(*) FROM cuota WHERE estado = 'EN_MORA')::int AS en_mora,
  (SELECT count(*) FROM cuota WHERE estado = 'PENDIENTE')::int AS pendientes`)
console.log(
  `Base "${nombre}" lista: ${r.unidades} unidades, ${r.cuotas} cuotas (${r.en_mora} en mora, ${r.pendientes} pendientes)`,
)
await pool.end()


