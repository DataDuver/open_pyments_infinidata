export default function CampoDato({ etiqueta, children, mono = false }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <span className="shrink-0 text-sm text-slate-500">{etiqueta}</span>
      <span
        className={`min-w-0 font-medium text-slate-800 sm:text-right ${
          mono ? "font-mono text-xs break-all" : "text-sm"
        }`}
      >
        {children}
      </span>
    </div>
  );
}
