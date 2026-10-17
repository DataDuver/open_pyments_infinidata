export function Logo({ claro = false }) {
  return (
    <a href="/" className="flex items-center gap-2.5">
      <span className="grid size-9 place-items-center rounded-xl bg-emerald-400 shadow-lg shadow-emerald-900/20">
        <IconoCheck className="size-5 text-emerald-950" />
      </span>
      <span className={`text-lg font-extrabold tracking-tight ${claro ? 'text-white' : 'text-slate-900'}`}>
        Al Día
      </span>
    </a>
  )
}

/** Franja superior verde con el encabezado de cada página. */
export function Portada({ titulo, subtitulo, children }) {
  const ruta = window.location.pathname
  const enlace = (href, texto, activo) => (
    <a
      href={href}
      className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
        activo ? 'bg-white/15 text-white' : 'text-emerald-100 hover:text-white'
      }`}
    >
      {texto}
    </a>
  )
  return (
    <header className="relative overflow-hidden bg-gradient-to-br from-emerald-700 via-emerald-800 to-teal-900 pb-24">
      <div className="pointer-events-none absolute -top-24 -right-24 size-96 rounded-full bg-emerald-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-16 size-80 rounded-full bg-teal-300/10 blur-3xl" />
      <nav className="relative mx-auto flex max-w-5xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo claro />
        <div className="flex gap-1">
          {enlace('/', 'Pagar', !ruta.startsWith('/admin'))}
          {enlace('/admin', 'Administración', ruta.startsWith('/admin'))}
        </div>
      </nav>
      <div className="relative mx-auto max-w-5xl px-4 pt-6 sm:px-6 sm:pt-10">
        <h1 className="max-w-2xl text-3xl font-extrabold tracking-tight text-white sm:text-5xl">{titulo}</h1>
        {subtitulo && <p className="mt-3 max-w-xl text-base text-emerald-100 sm:text-lg">{subtitulo}</p>}
        {children}
      </div>
    </header>
  )
}

export function Tarjeta({ className = '', children }) {
  return (
    <section
      className={`rounded-3xl bg-white p-5 shadow-xl shadow-slate-900/5 ring-1 ring-slate-900/5 sm:p-7 ${className}`}
    >
      {children}
    </section>
  )
}

const ESTILOS_ESTADO = {
  EN_MORA: ['En mora', 'bg-rose-50 text-rose-700 ring-rose-600/20'],
  PENDIENTE: ['Pendiente', 'bg-amber-50 text-amber-800 ring-amber-600/20'],
  AL_DIA: ['Al día', 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'],
  COMPLETADO: ['Recibido', 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'],
  ENVIADO: ['En camino', 'bg-sky-50 text-sky-700 ring-sky-600/20'],
  ENVIANDO: ['En camino', 'bg-sky-50 text-sky-700 ring-sky-600/20'],
  ESPERANDO_APROBACION: ['Esperando aprobación', 'bg-amber-50 text-amber-800 ring-amber-600/20'],
  RECHAZADO: ['Rechazado', 'bg-slate-100 text-slate-600 ring-slate-500/20'],
  FALLIDO: ['Falló', 'bg-rose-50 text-rose-700 ring-rose-600/20'],
}

export function Estado({ estado }) {
  const [texto, clases] = ESTILOS_ESTADO[estado] ?? [estado, 'bg-slate-100 text-slate-600 ring-slate-500/20']
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${clases}`}>
      {texto}
    </span>
  )
}

export function Aviso({ children, tipo = 'error' }) {
  const clases =
    tipo === 'error' ? 'bg-rose-50 text-rose-800 ring-rose-600/15' : 'bg-sky-50 text-sky-800 ring-sky-600/15'
  return <p className={`rounded-2xl px-4 py-3 text-sm ring-1 ${clases}`}>{children}</p>
}

export function Girador({ className = 'size-5' }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

export function IconoCheck({ className = 'size-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function IconoQR({ className = 'size-6' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3.5" y="3.5" width="6" height="6" rx="1.2" />
      <rect x="14.5" y="3.5" width="6" height="6" rx="1.2" />
      <rect x="3.5" y="14.5" width="6" height="6" rx="1.2" />
      <path d="M14.5 14.5h2.5v2.5M20.5 14.5v.01M14.5 20.5h.01M17.5 20.5h3v-3" strokeLinecap="round" />
    </svg>
  )
}

export function Pie() {
  return (
    <footer className="mx-auto max-w-5xl px-4 py-10 text-center text-xs text-slate-400 sm:px-6">
      Demo sobre la red de pruebas de Interledger · Pagos con Open Payments
    </footer>
  )
}
