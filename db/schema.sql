-- Esquema de "Al Día": pagos de administración con Open Payments.
-- Es idempotente: el servidor lo ejecuta en cada arranque.

CREATE TABLE IF NOT EXISTS conjunto (
  id             SERIAL PRIMARY KEY,
  nombre         TEXT NOT NULL,
  wallet_address TEXT NOT NULL            -- wallet del administrador, recibe los pagos
);

CREATE TABLE IF NOT EXISTS unidad (
  id          SERIAL PRIMARY KEY,
  conjunto_id INT    NOT NULL REFERENCES conjunto (id),
  torre       TEXT   NOT NULL,
  apto        TEXT   NOT NULL,
  valor_cuota BIGINT NOT NULL,            -- en unidades mínimas (centavos de USD)
  UNIQUE (conjunto_id, torre, apto)
);

CREATE TABLE IF NOT EXISTS cuota (
  id                     SERIAL PRIMARY KEY,
  unidad_id              INT      NOT NULL REFERENCES unidad (id),
  periodo                DATE     NOT NULL,   -- primer día del mes que se cobra
  valor                  BIGINT   NOT NULL,
  moneda                 TEXT     NOT NULL DEFAULT 'USD',
  escala                 SMALLINT NOT NULL DEFAULT 2,
  vence                  DATE     NOT NULL,
  estado                 TEXT     NOT NULL DEFAULT 'PENDIENTE'
                         CHECK (estado IN ('PENDIENTE', 'EN_MORA', 'AL_DIA')),
  -- Lo único que viaja en el QR: un token aleatorio, nunca el monto ni la wallet
  token                  TEXT     NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  -- Pago entrante (Open Payments) en la wallet del admin; se reusa entre intentos
  incoming_payment_url   TEXT,
  incoming_payment_expira TIMESTAMPTZ,
  pagada_en              TIMESTAMPTZ,
  UNIQUE (unidad_id, periodo)
);

-- Cada intento de pago de una cuota
CREATE TABLE IF NOT EXISTS pago (
  id                   UUID PRIMARY KEY,
  cuota_id             INT  NOT NULL REFERENCES cuota (id),
  estado               TEXT NOT NULL CHECK (estado IN (
                         'ESPERANDO_APROBACION', -- el pagador está en su wallet aprobando
                         'ENVIANDO',             -- volvió aprobado, estamos creando el pago saliente
                         'ENVIADO',              -- pago saliente creado, esperando que llegue
                         'COMPLETADO',
                         'RECHAZADO',            -- el pagador no aprobó en su wallet
                         'FALLIDO',
                         'CANCELADO')),          -- reemplazado por un intento más nuevo
  wallet_pagador       TEXT NOT NULL,
  auth_server          TEXT NOT NULL,
  quote_id             TEXT NOT NULL,
  debito_valor         BIGINT NOT NULL,
  debito_moneda        TEXT NOT NULL,
  debito_escala        SMALLINT NOT NULL,
  nonce                TEXT NOT NULL,           -- nuestro nonce del interact.finish
  nonce_servidor       TEXT,                    -- el que devuelve el servidor de autorización
  continue_uri         TEXT NOT NULL,
  continue_token       TEXT NOT NULL,
  outgoing_payment_url TEXT,
  token_saliente       TEXT,
  recibido_valor       BIGINT,
  error                TEXT,
  creado               TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado          TIMESTAMPTZ NOT NULL DEFAULT now(),
  completado           TIMESTAMPTZ
);

-- Nunca dos intentos vivos para la misma cuota: evita el pago doble
CREATE UNIQUE INDEX IF NOT EXISTS pago_vivo_por_cuota
  ON pago (cuota_id) WHERE estado IN ('ESPERANDO_APROBACION', 'ENVIANDO', 'ENVIADO');

CREATE INDEX IF NOT EXISTS pago_por_estado ON pago (estado);
