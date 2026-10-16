import "dotenv/config";
import express from "express";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import { unidadesRouter } from "./routes/unidades.js";
import { cuotasRouter } from "./routes/cuotas.js";
import { pagosRouter } from "./routes/pagos.js";
import { adminRouter } from "./routes/admin.js";
import { revisarPagosEnCurso } from "./routes/pagos.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, "..", "dist");
const PORT = process.env.PORT || 3000;

// Nombres de adaptadores virtuales (Hyper-V/WSL, Docker, VPNs, etc.) que nunca son la
// red WiFi/Ethernet real por la que el celular puede llegar a este equipo.
const ADAPTADOR_VIRTUAL = /virtual|vEthernet|hyper-v|wsl|docker|vmware|virtualbox|tailscale|zerotier|loopback/i;

function obtenerIpLan() {
  if (process.env.LAN_IP) return process.env.LAN_IP;

  const interfaces = os.networkInterfaces();
  const candidatas = [];
  for (const nombre of Object.keys(interfaces)) {
    if (ADAPTADOR_VIRTUAL.test(nombre)) continue;
    for (const red of interfaces[nombre] || []) {
      if (red.family === "IPv4" && !red.internal && !red.address.startsWith("169.254.")) {
        candidatas.push({ nombre, address: red.address });
      }
    }
  }

  const wifi = candidatas.find((c) => /wi-?fi|wlan/i.test(c.nombre));
  if (wifi) return wifi.address;
  if (candidatas[0]) return candidatas[0].address;
  return "localhost";
}

const app = express();
app.use(express.json());

app.get("/api/config", (_req, res) => {
  res.json({
    urlQr: `http://${obtenerIpLan()}:${PORT}`,
    conjuntoNombre: process.env.CONJUNTO_NOMBRE || "",
  });
});

app.use("/api/unidades", unidadesRouter);
app.use("/api/cuotas", cuotasRouter);
app.use("/api/pagos", pagosRouter);
app.use("/api/admin", adminRouter);

app.use((req, res, next) => {
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ error: "Ruta no encontrada" });
  }
  next();
});

app.use(express.static(distDir));
app.get(/^\/(?!api).*/, (_req, res) => {
  res.sendFile(path.join(distDir, "index.html"));
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Error interno" });
});

app.listen(PORT, () => {
  console.log(`Al Día escuchando en http://localhost:${PORT}`);
});

// Avanza los pagos en curso aunque nadie tenga abierta la pantalla de seguimiento
// (ej. el pagador aprobó en la wallet y cerró esa pestaña sin volver).
setInterval(() => {
  revisarPagosEnCurso().catch((err) => console.error("Error revisando pagos en curso:", err));
}, 3000);
