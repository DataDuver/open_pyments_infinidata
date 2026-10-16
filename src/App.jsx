import Inicio from "./pages/Inicio.jsx";
import Pagar from "./pages/Pagar.jsx";
import Admin from "./pages/Admin.jsx";

export default function App() {
  const { pathname } = window.location;

  const coincidePagar = pathname.match(/^\/pagar\/([^/]+)\/?$/);
  if (coincidePagar) {
    return <Pagar token={coincidePagar[1]} />;
  }

  if (pathname.startsWith("/admin")) {
    return <Admin />;
  }

  return <Inicio />;
}
