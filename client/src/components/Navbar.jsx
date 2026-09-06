import { Link, useNavigate, useLocation } from "react-router-dom";
import { adminLogout } from "../api.js";

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();

  const linkClass = (path) =>
    `px-3 py-2 rounded-lg text-sm font-medium ${
      location.pathname === path ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100"
    }`;

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <span className="font-bold text-brand-700">FreeSoul · Feedback</span>
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
            className="ml-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-500 hover:bg-slate-100"
          >
            Salir
          </button>
        </div>
      </div>
    </nav>
  );
}
