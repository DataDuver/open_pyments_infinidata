import Logo from "./Logo.jsx";

export default function Layout({ titulo, subtitulo, children, ancho = "max-w-md sm:max-w-xl" }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-gradient-to-br from-emerald-500 to-teal-600 px-4 pt-6 pb-20 text-white">
        <div className={`mx-auto ${ancho}`}>
          <a href="/" className="inline-flex">
            <Logo />
          </a>
          {titulo && <h1 className="mt-6 text-2xl font-bold">{titulo}</h1>}
          {subtitulo && <p className="mt-1 text-sm text-emerald-50">{subtitulo}</p>}
        </div>
      </header>
      <main className={`relative z-10 mx-auto -mt-16 ${ancho} space-y-4 px-4 pb-12`}>
        {children}
      </main>
    </div>
  );
}
