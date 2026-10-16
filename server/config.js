import dotenv from 'dotenv'

// En Azure no hay .env: las variables llegan por la configuración del App Service
dotenv.config({ quiet: true })

const faltantes = ['DATABASE_URL', 'OP_CLIENT_WALLET', 'OP_KEY_ID', 'ADMIN_WALLET'].filter(
  (v) => !process.env[v],
)
if (faltantes.length) {
  console.warn(`[config] Faltan variables de entorno: ${faltantes.join(', ')}`)
}
