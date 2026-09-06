import { Link, useNavigate, useLocation } from "react-router-dom";
import { adminLogout } from "../api.js";

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();

  const linkClass = (path) =>
    `px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      location.pathname === path ? "bg-brand-100 text-brand-700" : "text-white/80 hover:bg-white/10 hover:text-white"
    }`;

  return (
    <nav className="bg-brand-700 sticky top-0 z-10 shadow-md">
      <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center justify-between">
        <Link to="/admin" className="flex items-center gap-2">
          <img src="/icon-512.png" alt="Free Soul DNA" className="h-9 w-9 rounded-full" />
          <span className="font-display font-semibold text-white leading-tight hidden sm:block">
            Free Soul DNA
            <span className="block text-[11px] font-normal text-brand-100/80 -mt-0.5">Panel de Feedback</span>
          </span>
        </Link>
        <div className="flex items-center gap-1">
          <Link className={linkClass("/admin")} to="/admin">
            Productos
          </Link>
          <Link className={linkClass("/admin/results")} to="/admin/results">
            Resultados
          </Link>
          <button
            onClick={() => {
              adminLogout();
              navigate("/admin/login");
            }}
            className="ml-1 px-3 py-2 rounded-lg text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white"
          >
            Salir
          </button>
        </div>
      </div>
    </nav>
  );
}
