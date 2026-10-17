# Despliegue en Azure

Todo se hace desde el **Portal de Azure**: no hace falta Docker ni la CLI `az`.
Quedan dos recursos: un **App Service** (Linux, Node 22) que corre el backend y sirve el frontend, y un **Azure Database for PostgreSQL – Flexible Server**.

```
Celular / navegador ──HTTPS──► App Service (Node: Express + build de React)
                                   │
                                   ├──► PostgreSQL Flexible Server (BD "wallet")
                                   └──► Open Payments (ilp.interledger-test.dev)
```

Tiempo estimado: 25–35 minutos, la mayor parte esperando a que Azure cree el servidor de Postgres.

---

## 0. Antes de empezar

- El código debe estar en GitHub (`DataDuver/open_pyments_infinidata`), en la rama que vas a desplegar.
- Ten a mano:
  - El **keyId** de tu llave y la wallet cliente: `OP_CLIENT_WALLET`, `OP_KEY_ID` (están en tu `.env`).
  - La **llave privada en base64**. En PowerShell, desde la carpeta del proyecto:
    ```powershell
    [Convert]::ToBase64String([IO.File]::ReadAllBytes("private.key")) | Set-Clipboard
    ```
    Queda copiada en el portapapeles. **No la subas al repo ni la pegues en chats.**

---

## 1. Crear el grupo de recursos

Portal → **Grupos de recursos** → **Crear**
- Nombre: `rg-aldia`
- Región: `East US 2` (o la que te dé tu suscripción; usa la misma para todo)

> Al terminar la hackatón borras este grupo y desaparece todo lo que cobra.

---

## 2. Crear la base de datos PostgreSQL

Portal → **Azure Database for PostgreSQL flexible servers** → **Crear**

| Campo | Valor |
|---|---|
| Grupo de recursos | `rg-aldia` |
| Nombre del servidor | `aldia-db-<tu-nombre>` (debe ser único en Azure) |
| Región | la misma del grupo |
| Versión de PostgreSQL | 16 |
| Tipo de carga de trabajo | **Desarrollo** → Proceso: **Burstable B1ms** (el más barato) |
| Autenticación | Solo autenticación de PostgreSQL |
| Usuario administrador | `walletadmin` (Azure no deja usar `admin`, `root`, `postgres`…) |
| Contraseña | una fuerte; **evita `@ : / ? #`** o tendrás que codificarla en la URL |

Pestaña **Redes**:
- Método de conectividad: **Acceso público**
- ✅ **Permitir el acceso público desde cualquier servicio de Azure** (para que el App Service llegue)
- **+ Agregar dirección IP del cliente actual** (para conectarte desde tu PC si lo necesitas)

**Revisar y crear** → **Crear**. Tarda unos 5–10 minutos.

### Crear la base `wallet`

Cuando termine: entra al servidor → **Configuración → Bases de datos** → **+ Agregar** → nombre `wallet` → Guardar.

> Alternativa desde tu PC: pon la URL de Azure en tu `.env` y ejecuta `npm run db:setup`. Crea la base, las tablas y los datos de demo.

### Tu cadena de conexión

```
postgresql://walletadmin:TU_CLAVE@aldia-db-<tu-nombre>.postgres.database.azure.com:5432/wallet?sslmode=verify-full
```

`sslmode=verify-full` cifra la conexión y valida el certificado de Azure.
Si la clave tiene caracteres especiales, codifícalos: `@` → `%40`, `#` → `%23`, `/` → `%2F`.

**No necesitas crear tablas a mano**: la app aplica el esquema y carga los datos de demo la primera vez que arranca.

---

## 3. Crear el App Service

Portal → **App Services** → **Crear** → **Aplicación web**

| Campo | Valor |
|---|---|
| Grupo de recursos | `rg-aldia` |
| Nombre | `aldia-<tu-nombre>` → Azure le agrega un sufijo: la URL real está en **Información general → Dominio predeterminado** |
| Publicar | **Código** |
| Pila del entorno de ejecución | **Node 22 LTS** |
| Sistema operativo | **Linux** |
| Región | la misma |
| Plan de precios | **Basic B1** (el Gratis F1 sirve, pero se duerme y tiene cuota de CPU por día) |

**Revisar y crear** → **Crear**.

### Variables de entorno

App Service → **Configuración → Variables de entorno** → pestaña **Configuración de la aplicación** → agrega:

| Nombre | Valor |
|---|---|
| `DATABASE_URL` | la cadena del paso 2 |
| `OP_CLIENT_WALLET` | `https://ilp.interledger-test.dev/b9f0b8e3` |
| `OP_KEY_ID` | `b6f6d5d1-f6da-4268-a4f7-8cbf8374273f` |
| `OP_PRIVATE_KEY` | la llave en base64 (paso 0) |
| `ADMIN_WALLET` | `https://ilp.interledger-test.dev/diego-pesos-prueba` (debe estar en **USD**) |
| `CONJUNTO_NOMBRE` | `Conjunto Residencial Los Almendros` |
| `SCM_DO_BUILD_DURING_DEPLOYMENT` | `true` |

**Aplicar** → Confirmar.

> `PORT` no se configura: Azure lo pone solo.
> `PUBLIC_URL` tampoco hace falta: la app arma la URL de retorno de la wallet con el dominio con el que la abren.

### Comando de inicio y "Siempre activo"

App Service → **Configuración → Configuración general** (o **Configuración de pila**):
- **Comando de inicio**: `npm start`
- **Siempre activo**: **Activado** (en B1). Así la tarea que confirma pagos no se duerme.

Guardar.

---

## 4. Desplegar el código

### Opción A (recomendada): desde GitHub con Deployment Center

App Service → **Implementación → Centro de implementación**
- Origen: **GitHub** → autoriza tu cuenta
- Organización: `diegomesav` · Repositorio: `billetera-openpyments` · Rama: la que vas a mostrar
- **Guardar**

Azure crea un workflow en `.github/workflows/` del repo y lo ejecuta. Ese workflow **solo sube el código**: el `npm install` y el `npm run build` los hace Azure al recibirlo, gracias a `SCM_DO_BUILD_DURING_DEPLOYMENT=true`.
Lo ves avanzar en la pestaña **Actions** de GitHub; tarda unos 5 minutos. **Mientras no termine en verde, la app no tiene código** y el registro muestra errores. Cada `git push` a esa rama vuelve a desplegar.

> El workflow queda en la rama de GitHub, no en tu PC: haz `git pull` antes de volver a hacer push.

> Solo sube lo que está en Git: `.env`, `private.key` y `node_modules` nunca llegan a Azure.

### Opción B: desde VS Code

1. Instala la extensión **Azure App Service** e inicia sesión.
2. Antes de desplegar, agrega esto a `.vscode/settings.json` para **no subir secretos**:
   ```json
   {
     "appService.zipIgnorePattern": ["node_modules{,/**}", ".env", "*.key", ".git{,/**}", "dist{,/**}"]
   }
   ```
3. Clic derecho sobre el App Service → **Deploy to Web App…** → elige la carpeta del proyecto.

Con `SCM_DO_BUILD_DURING_DEPLOYMENT=true`, Azure ejecuta `npm install` y `npm run build` en el servidor.

---

## 5. Verificar

1. Abre la URL de **Información general → Dominio predeterminado** (algo como `https://aldia-<tu-nombre>-xxxx.<región>-01.azurewebsites.net`). Debe cargar la pantalla de Torre / Apartamento.
   La primera carga puede tardar 30–60 s mientras Node arranca y crea las tablas.
2. **Monitoreo → Secuencia de registro** (Log stream). Debes ver:
   ```
   [cuotas] Datos de demo creados: 30 unidades, 180 cuotas
   Al Día escuchando en http://localhost:8080
   ```
3. Torre 1, apto 101 → elige un mes → escanea el QR **con el celular** (ahora sí funciona desde cualquier red, porque es HTTPS público).
4. Paga con una wallet de prueba distinta a la del conjunto → aprueba → debe volver a la app con "¡Pago recibido!".
5. `/admin` muestra el pago en vivo.

---

## Problemas comunes

| Síntoma | Causa probable | Solución |
|---|---|---|
| `Application Error` al abrir | Falta una variable o el build falló | Revisa la Secuencia de registro; confirma las variables del paso 3 |
| `Site Disabled (CODE: 403)` en el paso *Deploy* de Actions, o la página "This web app is stopped" | El App Service está detenido (o en F1 se acabó la cuota del día) | Información general → **Iniciar**. Si dice cuota superada, pasa el plan a B1. Luego en Actions: **Re-run all jobs** |
| `ECONNREFUSED` / `timeout` con la base | Falta el permiso de red | En Postgres → Redes: ✅ "Permitir acceso desde servicios de Azure" |
| `database "wallet" does not exist` | No se creó la base | Paso 2 → "Crear la base `wallet`" |
| `password authentication failed` | Clave con caracteres especiales | Codifícalos en la URL (`@` → `%40`) |
| `self-signed certificate` o error de certificado | Validación SSL | Cambia `sslmode=verify-full` por `sslmode=no-verify` (cifra igual, no valida el certificado) |
| `Key is not a valid path or file` | `OP_PRIVATE_KEY` mal copiada | Vuelve a generar el base64 del paso 0, sin espacios ni saltos de línea |
| `401` o `invalid signature` de Open Payments | `OP_KEY_ID` no corresponde a la llave | Usa el keyId de la llave que subiste a la wallet cliente |
| `ENOENT ... open '/package.json'` en el registro | El código todavía no está en el App Service: el despliegue no ha terminado o falló | Mira **Actions** en GitHub. Si está en verde, reinicia el App Service. Si está en rojo, abre el paso que falló |
| `vite: not found` en el build | Se instalaron solo dependencias de producción | Ya está resuelto: las herramientas de build están en `dependencies` |
| La wallet aprueba pero vuelve a `http://` y falla | Proxy raro | Agrega `PUBLIC_URL=` con la URL de Información general |

---

## Checklist antes del pitch

- [ ] **Siempre activo** encendido en el App Service.
- [ ] Datos de demo frescos: con la `DATABASE_URL` de Azure en tu `.env`, ejecuta `npm run db:reset`.
- [ ] La wallet que vas a usar para pagar tiene saldo de prueba (la test wallet deja depositar).
- [ ] Hiciste un pago completo en Azure en la última hora.
- [ ] `/admin` abierto en otra pestaña para mostrar el pago entrando en vivo.

## Al terminar

Portal → Grupos de recursos → `rg-aldia` → **Eliminar grupo de recursos**. Se borra todo y deja de cobrar.
