# Al Día — Registro de la conversación de desarrollo

> Exportado el 2026-10-16. Proyecto: "Al Día", pago de cuotas de administración con Open Payments / Interledger.

---

## 1. Kickoff del proyecto

**Usuario:**
Pidió configurar una demo con el siguiente modelo de datos en PostgreSQL (tablas `conjunto`, `unidad`, `cuota`, `pago`, con el DDL completo incluyendo el índice único `pago_vivo_por_cuota` para evitar doble pago). Describió "Al Día": una web para pagar la cuota de administración de una unidad residencial en Colombia usando Open Payments de Interledger (red de pruebas `ilp.interledger-test.dev`), para una hackatón.

Flujo pedido: el propietario escribe torre y apartamento, ve sus cuotas pendientes y en mora, elige un mes y se genera un QR. El QR lleva a una página de pago donde escribe su wallet, aprueba el pago en su wallet y vuelve a la app con la confirmación. El administrador tiene un panel con el recaudo en vivo.

Stack fijo: PostgreSQL, Node 22 + Express 5 (ESM), React 19 + Vite + Tailwind v4, `qrcode.react`, `@interledger/open-payments` 7.x. Un solo proyecto con un solo `package.json` (Express sirve `/api` y el build de Vite). Sin Docker, sin ORM (pg con SQL plano), sin router (3 pantallas por pathname), sin Redis ni colas. Deploy a Azure App Service. Moneda USD, un solo conjunto.

Pidió explícitamente **no escribir código todavía**: solo confirmar entendimiento y proponer estructura de carpetas. Ya tenía `.env` (sin subir a git) y `private.key`.

**Asistente:**
- Revisó el repo: `.env` no existía aún, `private.key` estaba presente pero **no estaba en `.gitignore`** → se corrigió agregándolo (junto con `*.pem`).
- `index.js` resultó ser un script-tutorial del flujo Open Payments peer-to-peer (grant → incoming payment → quote → outgoing payment), usado luego como referencia.
- Confirmó entendimiento del modelo de datos y el flujo.
- Propuso la estructura de carpetas (`server/` con `index.js`, `db.js`, `openPayments.js`, `sql/`, `routes/`; `src/` con `pages/`, `components/`, `api.js`, `styles/`).
- Preguntó si podía ejecutar `schema.sql`/`seed.sql` contra la base del `.env`.

---

## 2. Base de datos

**Usuario:** "en el entorno de postgre, crea una bd llamada wallethakaton... primero en el entorno local y después replicaremos exactamente lo mismo en un servidor de postgres en Azure. Y lo demás, como tú lo acabas de definir."

**Asistente:**
- Detectó que el servicio `postgresql-x64-17` estaba instalado pero detenido; no pudo iniciarlo por falta de permisos de administrador → pidió al usuario correr `Start-Service postgresql-x64-17` como admin.
- Pidió usuario/contraseña de Postgres.

**Usuario:** "ya se levantó postgres. El usuario y la contraseña es: postgres. Crea el .env con todo lo que necesites."

**Asistente:**
- Conectó con `psql`, creó la base `wallethakaton`.
- Creó `server/sql/schema.sql` (el DDL exacto, con `CREATE EXTENSION IF NOT EXISTS pgcrypto`) y `server/sql/seed.sql` (1 conjunto, 5 unidades en 3 torres, 20 cuotas ago–nov 2026 con mezcla de `AL_DIA`/`EN_MORA`/`PENDIENTE`, y pagos `COMPLETADO` de respaldo para el panel admin). Ejecutó ambos scripts.
- Creó `.env` y `.env.example`, reutilizando `OP_CLIENT_WALLET`/`OP_KEY_ID`/`private.key` del script-tutorial como valores iniciales (con aviso explícito de que debían confirmarse).

**Usuario:** confirmó los valores y pidió seguir con `package.json` y el backend.

---

## 3. Backend

El asistente creó:
- `package.json` único (`type: module`, scripts `dev:api`/`dev:web`/`build`/`start`; dependencias `express`, `pg`, `dotenv`, `@interledger/open-payments`, `react`, `react-dom`, `qrcode.react`; devDependencies `vite`, `@vitejs/plugin-react`, `tailwindcss`, `@tailwindcss/vite`).
- `server/db.js` (Pool de `pg`).
- `server/openPayments.js`: cliente autenticado + helpers `obtenerWalletAddress`, `crearPagoEntrante`, `iniciarPagoSaliente`, `continuarPagoSaliente`, `crearPagoSalienteFinal`, `obtenerPagoSaliente`.
- `server/routes/unidades.js`, `cuotas.js`, `pagos.js`, `admin.js`.
- `server/index.js`: Express sirviendo `/api` + estático de `dist/` + fallback SPA, y detección de la IP de LAN para el QR (`GET /api/config`).

### Problemas encontrados y resueltos durante la verificación end-to-end real contra la red de pruebas:

1. **401 "invalid signature"** al pedir el grant del pago entrante sobre la wallet `b9f0b8e3` → esa wallet resultó ser **EUR**, no USD, y la llave registrada no coincidía.
2. El usuario entregó una nueva wallet admin: `duver-dolares` (confirmada como USD vía `walletAddress.get` sin firmar).
3. **400 "could not determine client"** con el Key ID que el usuario recordaba → se encontró el Key ID real (`405d2f81-f9c5-4caf-9412-96bb4d3073e9`) leyendo el JWKS público de la wallet (`/jwks.json`); el `private.key` sí era el correcto, solo el Key ID estaba mal.
4. Con la configuración corregida, el flujo completo (grant → pago entrante → cotización → grant de pago saliente con redirect) funcionó de punta a punta contra la red real.
5. Se corrigió el KPI `unidadesEnMora` en `admin.js` (contaba cuotas en mora, no unidades distintas → `COUNT(DISTINCT unidad_id)`).

---

## 4. Frontend

Especificación detallada del usuario (resumen): español, mobile-first, Tailwind v4, fuente Inter, franja superior degradado esmeralda/teal, tarjetas blancas `rounded-3xl` montadas sobre la franja, marca "Al Día" con logo de check.

- **`src/api.js`**: fetch a `/api` que lanza el error del backend; helpers `dinero` (es-CO, USD), `mes`, `fecha`, `fechaHora`, `puntero`.
- **Inicio (`/`)**: botones de torre + campo de apto; lista de cuotas pendientes (radio, mes, vence, valor, badge); historial de pagos plegable (**luego eliminado**, ver sección de simplificación); al elegir un mes, panel con QR, "Pagar desde este dispositivo" y "Copiar enlace"; mensaje "¡Estás al día!" si no debe nada.
- **Pagar (`/pagar/:token`)**: resumen de la cuota, input de wallet (recordada en `localStorage` con try/catch), botón "Pagar US$ X" que redirige a la wallet; seguimiento de pago vía polling cada 2s (**el diseño de 3 pasos se simplificó después**, ver más abajo).
- **Admin (`/admin`)**: indicador "En vivo", 4 KPIs, últimos pagos, unidades en mora; refresca cada 4s.

Reglas mobile estrictas (375px): pares etiqueta/valor en columna en celular (`flex-col sm:flex-row`), wallets en `font-mono text-xs break-all`, precio debajo del mes con `whitespace-nowrap`, `min-w-0` en tarjetas de grid, scroll automático al QR al elegir mes, aviso de "misma red WiFi" si la IP del QR difiere de `location.origin`.

Se creó toda la estructura (`components/Logo.jsx`, `Card.jsx`, `Layout.jsx`, `Badge.jsx`, `CampoDato.jsx`; `pages/Inicio.jsx`, `Pagar.jsx`, `Admin.jsx`; `App.jsx` con switch manual por `pathname`; `vite.config.js` con proxy `/api` → `localhost:3000`).

### Bugs encontrados y corregidos durante el build/revisión de código (sin navegador disponible en la sesión):
- `@import` de Google Fonts debía ir **antes** de `@import "tailwindcss"` (si no, warning de build).
- `Card` no reenviaba `ref` (necesario para el scroll automático al QR) → se convirtió a `forwardRef`.
- Carrera entre `/api/config` y la selección de cuota: el QR podía generarse antes de tener la IP de LAN → se inicializó `config.urlQr` con `location.origin` por defecto.
- Se quitó un emoji (🎉) de una cadena de UI que no se había pedido.
- El polling de `Pagar` se detenía permanentemente ante un error de red transitorio → se corrigió para reintentar.

El asistente **no pudo verificar visualmente la UI** porque la extensión "Claude in Chrome" no estaba conectada en esa sesión; lo dijo explícitamente y pidió al usuario probar en el navegador real.

---

## 5. Primeros problemas reales en producción (probado por el usuario)

**Usuario:** reportó que el flujo redirige a una pantalla "accepted" pero la cuota sigue pendiente en otra pestaña, y que el QR falló al escanearlo desde el celular (probablemente porque usaba `localhost`).

**Diagnóstico y fixes:**
1. **Detección de IP de LAN rota**: `obtenerIpLan()` devolvía `172.19.144.1` (adaptador virtual de Hyper-V/WSL), no la IP real de WiFi. Se corrigió filtrando adaptadores virtuales (`vEthernet`, `WSL`, `Docker`, `VMware`, etc.) y direcciones link-local (`169.254.*`), preferiendo el adaptador Wi-Fi; se agregó override opcional `LAN_IP` en `.env`.
2. **Firewall de Windows**: la red WiFi estaba categorizada como "Pública", por lo que el Firewall bloqueaba conexiones entrantes al puerto 3000 desde otros dispositivos. El asistente **no pudo (ni debía) cambiar esto él mismo** (regla de seguridad del sistema) — le dio al usuario el comando exacto para correr como administrador:
   ```powershell
   New-NetFirewallRule -DisplayName "Al Dia (puerto 3000)" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow
   ```
3. **Bug de arquitectura**: el estado del pago solo avanzaba cuando algo hacía `GET /api/pagos/:id` (es decir, solo si la pantalla de seguimiento estaba abierta). Si el usuario cerraba esa pestaña después de aprobar, el pago quedaba congelado para siempre. Se agregó un **ticker en segundo plano** (`setInterval` en `server/index.js`, cada 3s) que llama a `revisarPagosEnCurso()` (nueva función exportada de `pagos.js`) y avanza todos los pagos en curso sin depender de ninguna pantalla abierta.

---

## 6. "No pude validar la wallet"

**Usuario:** reportó el error al intentar pagar, y preguntó si podía ser porque la wallet del admin es de un usuario distinto al asociado con `private.key`.

**Asistente:** explicó que `private.key`/`OP_KEY_ID`/`OP_CLIENT_WALLET` identifican a la aplicación (el cliente que firma), no al pagador — eso ya se había probado funcionando con una wallet distinta. Agregó logging del error real (antes se tragaba silenciosamente) y encontró, reproduciendo con la wallet exacta del usuario, dos bugs reales:

1. **Normalización de wallet incompleta**: el código solo convertía un prefijo `$` a `https://`; si el campo llegaba sin protocolo y sin `$` (p. ej. `ilp.interledger-test.dev/duver`), `new URL(...)` fallaba con `Invalid URL`. Se generalizó la normalización para cualquier forma de entrada.
2. **"invalid receiver"** al reutilizar un pago entrante que había quedado inválido (de una prueba anterior). Se agregó **reintento automático**: si el primer intento de `iniciarPagoSaliente` falla, se crea un pago entrante nuevo (forzado) y se reintenta una vez antes de rendirse.

---

## 7. Simplificación del flujo (último pedido, en curso)

**Usuario:** reportó que:
- Al pagar por primera vez, lo redirige a una pantalla ajena a la app (la de la wallet diciendo que aprobó) — pidió que en vez de eso, al completarse el pago, se muestre una interfaz propia con opción de consultar otro apartamento.
- Volviendo a consultar el mismo apartamento, la cuota pagada seguía apareciendo como pendiente, y el pago se quedaba "cargando" indefinidamente.
- Pidió **quitar el seguimiento de 3 pasos** (ya no lo necesita) y que si se intenta acceder por URL a un pago/cuota ya realizado, se muestre una vista indicando que ya fue pagado.
- Mencionó que la consulta se dispara en cada tecla digitada (duda de si eso causaba la falla — el asistente confirmó que no, es solo una lectura y no interfiere con el pago).

**Causa raíz identificada:** nunca se configuraba `interact.finish` en la concesión del pago saliente, así que la wallet no tenía forma de devolver automáticamente al navegador a la app — el usuario quedaba varado en la pantalla propia de la wallet, y el continue nunca se completaba sin que alguien volviera manualmente a la pantalla de seguimiento.

**Fixes aplicados:**
1. **`interact.finish` con redirect**: se generan `pagoId` y `nonce` *antes* de pedir la concesión, se construye `finishUri = ${req.protocol}://${req.get("host")}/pagar/${token}?pago=${pagoId}` (usa el host real con el que el navegador llegó, sea `localhost` o la IP de LAN), y se pasa en `interact.finish = { method: "redirect", uri: finishUri, nonce }`. Al aprobar, la wallet redirige sola de vuelta a la app con `?pago=id&interact_ref=...`.
2. El frontend (`Pagar.jsx`) lee `interact_ref` de la URL al volver y lo manda en el polling; el backend lo guarda en la columna `nonce_servidor` (ya existente en el esquema, sin usar hasta ahora) y lo pasa a `client.grant.continue(...)` como `interact_ref` para finalizar la concesión.
3. **Seguimiento de 3 pasos eliminado**: reemplazado por un spinner simple "Confirmando tu pago…".
4. **Vista de "cuota ya pagada"**: si `cuota.estado === 'AL_DIA'` (ya sea porque se acaba de completar o porque ya estaba pagada de antes), se muestra una tarjeta de éxito con fecha de pago y un botón **"Consultar otro apartamento"** que vuelve al inicio — en vez del formulario de pago.
5. **Historial de pagos eliminado de Inicio**: ahora solo se muestran las cuotas pendientes/en mora (o "¡Estás al día!"), tanto en el backend (`unidades.js` ya no consulta ni devuelve `historial`) como en el frontend.
6. **Bug de la salvaguarda de tiempo máximo**: se descubrió que 3 pagos reales que el usuario ya había aprobado estaban permanentemente colgados en estado `ENVIADO` porque el token para consultar su estado final había quedado **"Inactive Token" (403)** — un error permanente, no transitorio, que el código absorbía sin nunca activar el límite de tiempo. Se unificó el chequeo de "tiempo máximo" (5 min desde la creación del pago) al inicio de `avanzarPago()`, antes de intentar nada, para que esto no vuelva a pasar. Los 3 pagos colgados se marcaron `FALLIDO` automáticamente al reiniciar el servidor, liberando esas cuotas para reintentar.

**Estado al cierre de esta sección:** todos los cambios compilados (`npm run build` limpio) y el servidor reiniciado con la versión corregida. Pendiente de que el usuario pruebe el flujo completo de nuevo.

---

## 8. Export de la conversación

**Usuario:** "exportame todo este chat a un .md"

**Asistente:** generó este archivo (`CHAT_EXPORT.md`) en la raíz del proyecto.

---

## Decisiones y datos clave para recordar

- **Wallet admin / cliente**: `https://ilp.interledger-test.dev/duver-dolares`, Key ID `405d2f81-f9c5-4caf-9412-96bb4d3073e9`, `private.key` en la raíz del proyecto (gitignored).
- **Base de datos local**: `wallethakaton` en PostgreSQL 17 local, usuario `postgres`/`postgres`.
- **IP de LAN para el QR**: detectada automáticamente (adaptador "Wi-Fi", excluyendo virtuales); override manual disponible vía `LAN_IP` en `.env`.
- **Firewall de Windows**: requiere la regla manual de `New-NetFirewallRule` para el puerto 3000 (acción que el asistente no ejecuta por ser un cambio de seguridad del sistema).
- **Sin Redis/colas**: el avance de los pagos en curso se hace con un `setInterval` simple en el mismo proceso de Node (`revisarPagosEnCurso`), no con un sistema de colas.
- **Sin verificación visual del navegador**: la extensión Claude in Chrome no estuvo disponible durante esta sesión; toda la UI se validó por lectura de código y pruebas de API, no visualmente.
