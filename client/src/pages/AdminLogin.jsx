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
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 w-full max-w-sm">
        <h1 className="text-xl font-bold text-brand-700 mb-1">FreeSoul · Feedback</h1>
        <p className="text-sm text-slate-500 mb-5">Panel de administración</p>
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
          className="w-full bg-brand-600 text-white rounded-lg py-2 font-medium disabled:opacity-60"
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
