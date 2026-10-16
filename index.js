// Tutorial del cliente de Open Payments
// Objetivo: Realizar un pago entre pares entre dos direcciones de billetera (usando cuentas en la cuenta de prueba)
// Configuración inicial


// a. Importar dependencias y configurar el cliente
import { createAuthenticatedClient } from "@interledger/open-payments";
import fs from "fs"
import { isFinalizedGrantWithAccessToken } from "@interledger/open-payments";
import Readline from "readline/promises";

// b. Crear una instancia del cliente Open Payments
// c. Cargar la clave privada del archivo
// d. Configurar las direcciones de las billeteras del remitente y el receptor
(async () => {
    const privateKey = fs.readFileSync("private.key", "utf8");
    const client = await createAuthenticatedClient({
        walletAddressUrl: "https://ilp.interledger-test.dev/b9f0b8e3",
        privateKey: privateKey,
        keyId: "b6f6d5d1-f6da-4268-a4f7-8cbf8374273f",
        
    });


// Flujo de pago entre pares
// 1. Obtener una concesión para un pago entrante)

    const sendingWalletAddress = await client.walletAddress.get({
        url:"https://ilp.interledger-test.dev/diego-euros"
    });

    const receivingWalletAddress = await client.walletAddress.get({
        url:"https://ilp.interledger-test.dev/diego-pesos-prueba"
    });

    console.log(sendingWalletAddress, receivingWalletAddress);


// 2. Obtener el token que permite crear un pago entrante para el receptor
    const incomingPaymentGrant = await client.grant.request(
        { url: receivingWalletAddress.authServer },
        {
            access_token: {
                access: [
                    {
                        type: "incoming-payment",
                        actions: ["read", "complete", "create"],
                    },
                ],
            },
        }
    );

    if (!isFinalizedGrantWithAccessToken(incomingPaymentGrant)) {
        throw new Error("Se espera finalice la concesión");
    }
    console.log(incomingPaymentGrant);

// 3. Crear un pago entrante para el receptor
    const incomingPayment = await client.incomingPayment.create(
        {
            url: receivingWalletAddress.resourceServer,
            accessToken: incomingPaymentGrant.access_token.value,
        },
        {
            walletAddress: receivingWalletAddress.id,
            incomingAmount: {
                assetCode: receivingWalletAddress.assetCode,
                assetScale: receivingWalletAddress.assetScale,
                value: "1100", // Monto del pago entrante, equivale a 11.00 en la moneda del receptor (1100 centavos)
            },
        }
    );
    console.log( { incomingPayment });

// 4. Crear un concesión para una cotización
    const quoteGrant = await client.grant.request(
        { url: sendingWalletAddress.authServer },
        {
            access_token: {
                access: [
                    {
                        type: "quote",
                        actions: ["create"],
                    },
                ],
            },
        }
    );

    if (!isFinalizedGrantWithAccessToken(quoteGrant)) {
        throw new Error("Se espera finalice la concesión");
    }
    console.log(quoteGrant);


// 5. Obtener una cotización para el remitente
    const quote = await client.quote.create(
        {
            url: sendingWalletAddress.resourceServer,
            accessToken: quoteGrant.access_token.value,
        },
        {
            walletAddress: sendingWalletAddress.id,
            receiver: incomingPayment.id,
            method: "ilp",
        }
    );
    console.log({ quote });

// 6. Obtener una concesión para un pago saliente
    const outgoingPaymentGrant = await client.grant.request(
        { url: sendingWalletAddress.authServer, },
        {
            access_token: {
                access: [
                    {
                        type: "outgoing-payment",
                        actions: ["create"],
                        limits: {
                            debitAmount: quote.debitAmount,
                        },
                        identifier: sendingWalletAddress.id,
                    }
                ]
            },
            interact: {
                start: ["redirect"]
            },
        }
    );
    console.log({outgoingPaymentGrant});
    console.log("Abra este enlace para aprobar el pago:", outgoingPaymentGrant.interact.redirect);


// 7. Continuar con la concesión del pago saliente
    const rl = Readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    await rl.question("Presione Enter para continuar con la concesión del pago saliente...");
    rl.close();


// 8. Finalizar la concesión del pago saliente
    const finalizedOutgoingPaymentGrant = await client.grant.continue(
        {
            url: outgoingPaymentGrant.continue.uri,
            accessToken: outgoingPaymentGrant.continue.access_token.value,
        }
    );
    if (!isFinalizedGrantWithAccessToken(finalizedOutgoingPaymentGrant)) {
        throw new Error("Se espera finalice la concesión");
    }


// 9. Continuar con la cotización de pago saliente
    const outgoingPayment = await client.outgoingPayment.create(
        {
            url: sendingWalletAddress.resourceServer,
            accessToken: finalizedOutgoingPaymentGrant.access_token.value,
        },
        {
            walletAddress: sendingWalletAddress.id,
            quoteId: quote.id,
        }
    );
    console.log({ outgoingPayment });
})();

