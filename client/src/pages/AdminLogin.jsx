import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { adminLogin } from "../api.js";

export default function AdminLogin() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await adminLogin(password);
      navigate("/admin");
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo iniciar sesión.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-700 px-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-6">
          <img src="/icon-512.png" alt="Free Soul DNA" className="h-24 w-24 rounded-2xl shadow-lg" />
        </div>
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl p-6">
          <h1 className="text-xl font-display font-bold text-brand-700 mb-1">Free Soul DNA</h1>
          <p className="text-sm text-slate-500 mb-5">Panel de administración · Feedback de productos</p>
          <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-brand-500"
            placeholder="••••••••"
            autoFocus
          />
          {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-600 hover:bg-brand-700 transition-colors text-white rounded-lg py-2.5 font-medium disabled:opacity-60"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
        <p className="text-center text-brand-100/70 text-xs mt-4">Woven into your DNA</p>
      </div>
    </div>
  );
}
