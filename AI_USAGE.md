# AI Usage Disclosure — Al Día

Proyecto: **Al Día**, pago de cuotas de administración de propiedad horizontal con Open Payments (Interledger).
Equipo: InfiniData — Open Payments Hackathon by Interledger, Ruta N Medellín, 16 y 17 de octubre de 2026.

## Herramientas usadas

- **Claude Code** (Anthropic, modelos Claude) — asistente de programación en terminal / app de escritorio.

## Dónde y cómo usamos IA

### 1. Diseño del modelo de datos y base de datos (`db/schema.sql`, `scripts/db.js`)
- Nosotros definimos el modelo (`conjunto`, `unidad`, `cuota`, `pago`) y el índice único `pago_vivo_por_cuota` para evitar el doble pago, y se lo dimos a Claude como especificación.
- Claude creó la base local, los scripts de esquema y los datos de demo (1 conjunto, 5 unidades en 3 torres, 20 cuotas con estados `AL_DIA` / `EN_MORA` / `PENDIENTE`) y el script `scripts/db.js` para crear/reiniciar la base.

### 2. Backend — API Express (`server/`)
- Stack, arquitectura y restricciones definidos por nosotros (Node 22 + Express 5 ESM, `pg` con SQL plano, sin ORM, sin colas, un solo `package.json`).
- Claude generó el servidor Express (rutas `/api` de unidades, cuotas, pagos y admin, servicio del build de Vite, detección de la IP de LAN para el QR) y la configuración de variables de entorno (`server/config.js`).
- Claude agregó el *ticker* en segundo plano que avanza los pagos en curso sin depender de que una pantalla esté abierta, después de que nosotros detectamos en pruebas que los pagos se quedaban congelados.

### 3. Backend — Integración con Open Payments (cliente autenticado y flujo de pago)
- Claude escribió los helpers sobre `@interledger/open-payments` 7.x: cliente autenticado, obtención de wallet address, grant y creación del pago entrante, cotización, grant interactivo del pago saliente (con `interact.finish` de tipo `redirect`), `grant.continue` con `interact_ref` y consulta del pago saliente.
- Lo tomó como referencia del script `index.js`, que es el tutorial oficial peer-to-peer que hicimos nosotros (ver "Lo que hicimos nosotros").
- Los problemas reales contra la red de pruebas (`ilp.interledger-test.dev`) los diagnosticamos juntos, probando el flujo de punta a punta:
  - Wallet en EUR en lugar de USD → cambiamos a la wallet `duver-dolares`.
  - Key ID incorrecto → se encontró el correcto leyendo el JWKS público de la wallet.
  - Normalización incompleta de direcciones de wallet (`$...`, sin protocolo).
  - Reintento con un pago entrante nuevo ante "invalid receiver".
  - Pagos colgados por un token inactivo (403) → límite de tiempo máximo de 5 minutos por pago.

### 4. Frontend — React 19 + Vite + Tailwind v4 (`src/`)
- Nosotros escribimos la especificación de la interfaz: idioma, mobile-first a 375 px, paleta, tipografía, tarjetas, las tres pantallas y su comportamiento.
- Claude generó todos los componentes y páginas:
  - `src/pages/Inicio.jsx` — consulta por torre/apartamento, cuotas pendientes y en mora, generación del QR.
  - `src/pages/Pagar.jsx` — ingreso de la wallet del residente, redirección a la autorización, confirmación y vista de "cuota ya pagada".
  - `src/pages/Admin.jsx` — panel del administrador con KPIs y recaudo en vivo.
  - `src/components/*` (`Logo`, `Card`, `Layout`, `Badge`, `CampoDato`), `src/api.js`, `src/App.jsx`, `src/styles/index.css`, `vite.config.js`.
- Los cambios de flujo los pedimos nosotros tras probar en el celular: quitar el seguimiento de 3 pasos, volver automáticamente a la app después de autorizar en la wallet, botón "Consultar otro apartamento" y eliminación del historial en Inicio.

### 5. Documentación
- `CHAT_EXPORT.md`: resumen de la conversación de desarrollo, generado por Claude a nuestra petición.
- Este archivo (`AI_USAGE.md`): redactado con ayuda de Claude a partir de la guía oficial de entrega del hackatón y revisado por el equipo.

## Archivos con poca o ninguna IA

- **`index.js`** (raíz) — script del tutorial oficial del cliente de Open Payments (pago entre pares: grant → pago entrante → cotización → pago saliente). Lo escribimos nosotros siguiendo el curso de Open Payments en Platzi. Es la base sobre la que se construyó el servicio de Open Payments de la app.
- **Configuración de las wallets de prueba** — creación de las wallets en `ilp.interledger-test.dev`, generación de llaves y Key ID, y valores de `.env` (no incluido en el repo).
- **Despliegue en Azure** (App Service y PostgreSQL).

## Lo que hicimos nosotros

- La idea del producto, el problema (recaudo de cuotas de administración en conjuntos residenciales) y el modelo de negocio.
- El modelo de datos, el stack y todas las decisiones de arquitectura y alcance.
- Las pruebas reales del flujo de pago completo con wallets de la red de pruebas: solicitud → autorización (consentimiento) → ejecución → finalización, desde el celular escaneando el QR.
- La revisión y validación de todo el código sugerido por la IA, y los reportes de errores que llevaron a cada corrección.
- La configuración de seguridad del equipo (regla de firewall de Windows para el puerto 3000), que ejecutamos manualmente.
- El pitch, el guion y la grabación del video demo.

## Registro de prompts

Los prompts reales enviados a la IA están en la carpeta [`/prompts`](./prompts).
El resumen cronológico de la sesión de desarrollo está en [`CHAT_EXPORT.md`](./CHAT_EXPORT.md).
