import fs from "fs";
import { createAuthenticatedClient, isFinalizedGrantWithAccessToken } from "@interledger/open-payments";

let clientPromise;

function getClient() {
  if (!clientPromise) {
    clientPromise = createAuthenticatedClient({
      walletAddressUrl: process.env.OP_CLIENT_WALLET,
      privateKey: fs.readFileSync(process.env.OP_PRIVATE_KEY_PATH, "utf8"),
      keyId: process.env.OP_KEY_ID,
    });
  }
  return clientPromise;
}

export async function obtenerWalletAddress(url) {
  const client = await getClient();
  return client.walletAddress.get({ url });
}

// Crea (o reutiliza, vía cuota.incoming_payment_url) el pago entrante en la wallet del admin.
export async function crearPagoEntrante({ adminWalletAddress, valor, moneda, escala }) {
  const client = await getClient();

  const grant = await client.grant.request(
    { url: adminWalletAddress.authServer },
    {
      access_token: {
        access: [{ type: "incoming-payment", actions: ["read", "complete", "create"] }],
      },
    }
  );
  if (!isFinalizedGrantWithAccessToken(grant)) {
    throw new Error("No se pudo autorizar el pago entrante");
  }

  const incomingPayment = await client.incomingPayment.create(
    {
      url: adminWalletAddress.resourceServer,
      accessToken: grant.access_token.value,
    },
    {
      walletAddress: adminWalletAddress.id,
      incomingAmount: {
        assetCode: moneda,
        assetScale: escala,
        value: String(valor),
      },
    }
  );

  return incomingPayment;
}

// Arranca el flujo de pago saliente: cotización + concesión interactiva. Devuelve todo lo
// necesario para guardar la fila `pago` y redirigir al pagador a aprobar.
export async function iniciarPagoSaliente({ walletPagadorUrl, incomingPaymentUrl, nonce, finishUri }) {
  const client = await getClient();

  const sendingWalletAddress = await client.walletAddress.get({ url: walletPagadorUrl });

  const quoteGrant = await client.grant.request(
    { url: sendingWalletAddress.authServer },
    { access_token: { access: [{ type: "quote", actions: ["create"] }] } }
  );
  if (!isFinalizedGrantWithAccessToken(quoteGrant)) {
    throw new Error("No se pudo autorizar la cotización");
  }

  const quote = await client.quote.create(
    { url: sendingWalletAddress.resourceServer, accessToken: quoteGrant.access_token.value },
    { walletAddress: sendingWalletAddress.id, receiver: incomingPaymentUrl, method: "ilp" }
  );

  const outgoingPaymentGrant = await client.grant.request(
    { url: sendingWalletAddress.authServer },
    {
      access_token: {
        access: [
          {
            type: "outgoing-payment",
            actions: ["create"],
            limits: { debitAmount: quote.debitAmount },
            identifier: sendingWalletAddress.id,
          },
        ],
      },
      interact: {
        start: ["redirect"],
        finish: { method: "redirect", uri: finishUri, nonce },
      },
    }
  );

  return { sendingWalletAddress, quote, outgoingPaymentGrant };
}

// Intenta continuar la concesión interactiva. Devuelve el grant finalizado o null si el
// pagador todavía no ha aprobado (el llamador debe seguir reintentando).
export async function continuarPagoSaliente({ continueUri, continueToken, interactRef }) {
  const client = await getClient();
  try {
    const grant = await client.grant.continue(
      { url: continueUri, accessToken: continueToken },
      interactRef ? { interact_ref: interactRef } : undefined
    );
    return isFinalizedGrantWithAccessToken(grant) ? grant : null;
  } catch {
    return null;
  }
}

export async function crearPagoSalienteFinal({ resourceServer, accessToken, walletAddressId, quoteId }) {
  const client = await getClient();
  return client.outgoingPayment.create(
    { url: resourceServer, accessToken },
    { walletAddress: walletAddressId, quoteId }
  );
}

export async function obtenerPagoSaliente({ url, accessToken }) {
  const client = await getClient();
  return client.outgoingPayment.get({ url, accessToken });
}
