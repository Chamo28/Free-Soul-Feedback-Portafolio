import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getProducts, getCurationSurveys } from "../api.js";
import Navbar from "../components/Navbar.jsx";
import ProductCard from "../components/ProductCard.jsx";
import CurationSurveyCard from "../components/CurationSurveyCard.jsx";

export default function AdminDashboard() {
  const [tab, setTab] = useState("detallada"); // detallada | curaduria
  const [products, setProducts] = useState([]);
  const [curationSurveys, setCurationSurveys] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getProducts(), getCurationSurveys()])
      .then(([p, c]) => {
        setProducts(p);
        setCurationSurveys(c);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex gap-2 mb-5">
          <button
            onClick={() => setTab("detallada")}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              tab === "detallada" ? "bg-brand-600 text-white" : "bg-white border border-slate-300 text-slate-600"
            }`}
          >
            Encuestas Detalladas ({products.length})
          </button>
          <button
            onClick={() => setTab("curaduria")}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              tab === "curaduria" ? "bg-brand-600 text-white" : "bg-white border border-slate-300 text-slate-600"
            }`}
          >
            Curaduría de Portafolio ({curationSurveys.length})
          </button>
        </div>

        {tab === "detallada" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-slate-500">Criterios 1-5, ¿lo comprarías? y comentarios, por producto.</p>
              <Link to="/admin/products/new" className="bg-brand-600 text-white text-sm font-medium px-4 py-2 rounded-lg">
                + Nuevo producto
              </Link>
            </div>

            {loading && <p className="text-slate-500">Cargando...</p>}

            {!loading && products.length === 0 && (
              <div className="bg-white border border-dashed border-slate-300 rounded-xl p-10 text-center text-slate-500">
                Todavía no subes ningún producto. Crea el primero para generar su link de encuesta.
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {products.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  onDeleted={(id) => setProducts((prev) => prev.filter((x) => x.id !== id))}
                />
              ))}
            </div>
          </div>
        )}

        {tab === "curaduria" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-slate-500">Selección forzada Top-K: el evaluador elige sus N favoritos.</p>
              <Link
                to="/admin/curaduria/new"
                className="bg-brand-600 text-white text-sm font-medium px-4 py-2 rounded-lg"
              >
                + Nueva curaduría
              </Link>
            </div>

            {loading && <p className="text-slate-500">Cargando...</p>}

            {!loading && curationSurveys.length === 0 && (
              <div className="bg-white border border-dashed border-slate-300 rounded-xl p-10 text-center text-slate-500">
                Todavía no creas ninguna dinámica de curaduría. Sube un conjunto de fotos para crear la primera.
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {curationSurveys.map((s) => (
                <CurationSurveyCard
                  key={s.id}
                  survey={s}
                  onDeleted={(id) => setCurationSurveys((prev) => prev.filter((x) => x.id !== id))}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
