const ESTILOS = {
  PENDIENTE: "bg-amber-100 text-amber-800",
  EN_MORA: "bg-red-100 text-red-700",
  AL_DIA: "bg-emerald-100 text-emerald-700",
  COMPLETADO: "bg-emerald-100 text-emerald-700",
  ESPERANDO_APROBACION: "bg-amber-100 text-amber-800",
  ENVIANDO: "bg-sky-100 text-sky-700",
  ENVIADO: "bg-sky-100 text-sky-700",
  RECHAZADO: "bg-red-100 text-red-700",
  FALLIDO: "bg-red-100 text-red-700",
  CANCELADO: "bg-slate-200 text-slate-600",
};

const ETIQUETAS = {
  PENDIENTE: "Pendiente",
  EN_MORA: "En mora",
  AL_DIA: "Al día",
  COMPLETADO: "Completado",
  ESPERANDO_APROBACION: "Esperando aprobación",
  ENVIANDO: "Enviando",
  ENVIADO: "Enviando",
  RECHAZADO: "Rechazado",
  FALLIDO: "Fallido",
  CANCELADO: "Cancelado",
};

export default function Badge({ estado }) {
  return (
    <span
      className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${
        ESTILOS[estado] || "bg-slate-100 text-slate-600"
      }`}
    >
      {ETIQUETAS[estado] || estado}
    </span>
  );
}
