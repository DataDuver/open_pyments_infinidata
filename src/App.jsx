import Admin from './paginas/Admin.jsx'
import Inicio from './paginas/Inicio.jsx'
import Pagar from './paginas/Pagar.jsx'

// Tres pantallas: no hace falta un router
export default function App() {
  const ruta = window.location.pathname
  const pago = ruta.match(/^\/pagar\/([\w-]+)/)
  if (pago) return <Pagar token={pago[1]} />
  if (ruta.startsWith('/admin')) return <Admin />
  return <Inicio />
}
