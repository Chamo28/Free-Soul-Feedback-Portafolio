import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Navbar from "../components/Navbar.jsx";
import ZoomModal from "../components/ZoomModal.jsx";
import { getRankings, getSyncStatus, triggerSync, getCurationSurveys, getCurationRankings } from "../api.js";

const badgeClass = {
  Adelante: "bg-green-100 text-green-700",
  Renegociar: "bg-amber-100 text-amber-700",
  Descartar: "bg-red-100 text-red-700",
};

const curationBadgeClass = {
  "Aprobado para importación": "bg-green-100 text-green-700",
  "En revisión": "bg-amber-100 text-amber-700",
  "Sugerido descartar": "bg-red-100 text-red-700",
};

export default function Results() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("curaduria") ? "curaduria" : "detallada";
  const [tab, setTab] = useState(initialTab);

  return (
    <div>
      <div className="print:hidden">
        <Navbar />
      </div>
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex gap-2 mb-5 print:hidden">
          <button
            onClick={() => setTab("detallada")}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              tab === "detallada" ? "bg-brand-600 text-white" : "bg-white border border-slate-300 text-slate-600"
            }`}
          >
            Encuestas Detalladas
          </button>
          <button
            onClick={() => setTab("curaduria")}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              tab === "curaduria" ? "bg-brand-600 text-white" : "bg-white border border-slate-300 text-slate-600"
            }`}
          >
            Curaduría de Portafolio
          </button>
        </div>

        {tab === "detallada" ? <DetailedResults /> : <CurationResults initialSurveyId={searchParams.get("curaduria")} />}
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="bg-slate-50 rounded-lg py-2">
      <p className="text-lg font-bold text-slate-800">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

function DetailedResults() {
  const [rankings, setRankings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("Todas");
  const [zoomItem, setZoomItem] = useState(null);

  const load = () => {
    setLoading(true);
    Promise.all([getRankings(), getSyncStatus()])
      .then(([r, s]) => {
        setRankings(r);
        setSyncStatus(s);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await triggerSync();
      load();
    } finally {
      setSyncing(false);
    }
  };

  const categories = ["Todas", ...new Set(rankings.map((r) => r.product?.category).filter(Boolean))];
  const visible = categoryFilter === "Todas" ? rankings : rankings.filter((r) => r.product?.category === categoryFilter);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="text-lg font-bold text-slate-800">Rankings y recomendación</h1>
        <div className="flex items-center gap-2 print:hidden">
          {syncStatus && (
            <span
              className={`text-xs px-2 py-1 rounded-full font-medium ${
                syncStatus.configured ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-600"
              }`}
            >
              {syncStatus.configured ? "Sheets conectado" : "Sheets no configurado"}
              {syncStatus.unsyncedCount > 0 ? ` · ${syncStatus.unsyncedCount} pendientes` : ""}
            </span>
          )}
          <button
            onClick={handleSync}
            disabled={syncing}
            className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 disabled:opacity-60"
          >
            {syncing ? "Sincronizando..." : "Sincronizar con Sheets"}
          </button>
          <button
            onClick={() => window.print()}
            className="text-sm bg-brand-600 text-white rounded-lg px-3 py-1.5"
          >
            🖨️ Exportar / Imprimir
          </button>
        </div>
      </div>

      {categories.length > 1 && (
        <div className="flex gap-2 mb-4 overflow-x-auto print:hidden">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategoryFilter(c)}
              className={`text-sm px-3 py-1.5 rounded-full whitespace-nowrap ${
                categoryFilter === c ? "bg-brand-600 text-white" : "bg-white border border-slate-300 text-slate-600"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {loading && <p className="text-slate-500">Cargando...</p>}

      {!loading && visible.length === 0 && (
        <div className="bg-white border border-dashed border-slate-300 rounded-xl p-10 text-center text-slate-500">
          Todavía no hay respuestas de evaluadores para mostrar.
        </div>
      )}

      <div className="space-y-4">
        {visible.map((r) => (
          <div key={r.productId} className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              {r.product?.photos?.[0] && (
                <img
                  src={r.product.photos[0]}
                  alt={r.product.name}
                  onClick={() => setZoomItem({ photo: r.product.photos[0], name: r.product.name })}
                  className="w-24 h-24 print:w-40 print:h-40 rounded-lg object-cover flex-shrink-0 cursor-zoom-in hover:opacity-80"
                />
              )}
              <div className="flex-1">
                <p className="font-semibold text-slate-800">{r.product?.name || "Producto eliminado"}</p>
                <p className="text-xs text-slate-500">
                  {r.product?.category} · {r.totalRespuestas} respuestas
                </p>
              </div>
              <span className={`text-sm font-semibold px-3 py-1 rounded-full ${badgeClass[r.recommendation.label]}`}>
                {r.recommendation.label}
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2 mt-4 text-center">
              <Stat label="Atractivo" value={r.atractivo} />
              <Stat label="Calidad" value={r.calidad} />
              <Stat label="Precio" value={r.precio} />
              <Stat label="% Compraría" value={`${r.pctCompraria}%`} />
            </div>

            <p className="text-sm text-slate-500 mt-3">{r.recommendation.detail}</p>

            {r.comentarios.length > 0 && (
              <details className="mt-3">
                <summary className="text-sm font-medium text-brand-700 cursor-pointer">
                  Ver {r.comentarios.length} comentario(s)
                </summary>
                <ul className="mt-2 space-y-2">
                  {r.comentarios.map((c, i) => (
                    <li key={i} className="text-sm bg-slate-50 rounded-lg p-2">
                      <span className="font-medium text-slate-700">{c.evaluador}: </span>
                      <span className="text-slate-600">{c.comentario}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        ))}
      </div>

      <ZoomModal photo={zoomItem?.photo} name={zoomItem?.name} onClose={() => setZoomItem(null)} />
    </div>
  );
}

function CurationResults({ initialSurveyId }) {
  const [surveys, setSurveys] = useState([]);
  const [selectedId, setSelectedId] = useState(initialSurveyId || "");
  const [ranking, setRanking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [zoomItem, setZoomItem] = useState(null);
  const selectedSurvey = surveys.find((s) => s.id === selectedId);

  useEffect(() => {
    Promise.all([getCurationSurveys(), getSyncStatus()]).then(([list, s]) => {
      setSurveys(list);
      setSyncStatus(s);
      if (!selectedId && list.length > 0) setSelectedId(list[0].id);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setRanking(null);
    getCurationRankings(selectedId).then(setRanking);
  }, [selectedId]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await triggerSync();
      const s = await getSyncStatus();
      setSyncStatus(s);
      if (selectedId) setRanking(await getCurationRankings(selectedId));
    } finally {
      setSyncing(false);
    }
  };

  if (loading) return <p className="text-slate-500">Cargando...</p>;

  if (surveys.length === 0) {
    return (
      <div className="bg-white border border-dashed border-slate-300 rounded-xl p-10 text-center text-slate-500">
        Todavía no creas ninguna dinámica de curaduría de portafolio.
      </div>
    );
  }

  return (
    <div>
      {/* Solo visible al imprimir/exportar: el <select> de abajo no imprime su valor. */}
      {selectedSurvey && (
        <h1 className="hidden print:block text-lg font-bold text-slate-800 mb-4">
          {selectedSurvey.name} · {selectedSurvey.category}
        </h1>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 print:hidden">
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm font-medium"
        >
          {surveys.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} · {s.category}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-2">
          {syncStatus && (
            <span
              className={`text-xs px-2 py-1 rounded-full font-medium ${
                syncStatus.configured ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-600"
              }`}
            >
              {syncStatus.configured ? "Sheets conectado" : "Sheets no configurado"}
              {syncStatus.unsyncedCurationCount > 0 ? ` · ${syncStatus.unsyncedCurationCount} pendientes` : ""}
            </span>
          )}
          <button
            onClick={handleSync}
            disabled={syncing}
            className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 disabled:opacity-60"
          >
            {syncing ? "Sincronizando..." : "Sincronizar con Sheets"}
          </button>
          <button
            onClick={() => window.print()}
            className="text-sm bg-brand-600 text-white rounded-lg px-3 py-1.5"
          >
            🖨️ Exportar / Imprimir
          </button>
        </div>
      </div>

      {!ranking && <p className="text-slate-500">Cargando ranking...</p>}

      {ranking && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
            <Stat label="Evaluadores" value={ranking.totalEvaluadores} />
            <Stat label="Productos" value={ranking.ranking.length} />
            <div className="bg-amber-50 rounded-lg py-2 text-center col-span-2 sm:col-span-1">
              <p className="text-sm font-bold text-amber-700 truncate px-1">
                {ranking.favoritoTop1 ? ranking.favoritoTop1.name : "—"}
              </p>
              <p className="text-xs text-amber-600">★ Favorito #1 más elegido</p>
            </div>
          </div>

          {ranking.totalEvaluadores === 0 && (
            <div className="bg-white border border-dashed border-slate-300 rounded-xl p-10 text-center text-slate-500 mb-4">
              Todavía no hay respuestas de evaluadores para esta curaduría.
            </div>
          )}

          {ranking.totalEvaluadores > 0 && (
            <p className="text-xs text-slate-500 mb-3">
              Ordenado por <b>peso ponderado</b>: no es solo cuántos lo eligieron, sino en qué puesto (el evaluador
              hace clic primero en su favorito absoluto). Úsalo para priorizar volumen de compra — un producto con
              mayor % de peso merece más unidades que uno con la misma tasa de selección pero elegido de último.
            </p>
          )}

          <div className="space-y-2">
            {ranking.ranking.map((row, i) => (
              <div
                key={row.productId}
                className="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-3"
              >
                <span className="text-sm font-bold text-slate-400 w-6 text-center">{i + 1}</span>
                <img
                  src={row.photo}
                  alt={row.name}
                  onClick={() => setZoomItem({ photo: row.photo, name: row.name })}
                  className="w-20 h-20 print:w-40 print:h-40 rounded-lg object-cover flex-shrink-0 cursor-zoom-in hover:opacity-80"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 truncate">
                    {row.name} {row.vecesFavorito > 0 && <span className="text-amber-500">★{row.vecesFavorito}</span>}
                  </p>
                  <p className="text-xs text-slate-500">
                    {row.votos} voto(s) · {row.pctSeleccion}% tasa de selección
                    {row.posicionPromedio != null && <> · puesto promedio #{row.posicionPromedio}</>}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-brand-700 text-sm">{row.pctPonderado}%</p>
                  <p className="text-[10px] text-slate-400 -mt-0.5">peso</p>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${curationBadgeClass[row.label]}`}>
                  {row.label}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      <ZoomModal photo={zoomItem?.photo} name={zoomItem?.name} onClose={() => setZoomItem(null)} />
    </div>
  );
}
