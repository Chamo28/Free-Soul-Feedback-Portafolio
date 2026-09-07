import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar.jsx";
import ZoomModal from "../components/ZoomModal.jsx";
import {
  getRankings,
  getSyncStatus,
  triggerSync,
  getCurationSurveys,
  getCurationRankings,
  getCurationResponses,
  deleteCurationResponse,
  updateCurationSurveyItem,
  getPurchaseOrders,
  createPurchaseOrder,
  importCurationToPurchaseOrder,
} from "../api.js";

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

function fechaCorta(iso) {
  try {
    return new Date(iso).toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

function SurveyPickerCard({ survey, selected, onSelect }) {
  return (
    <button
      onClick={onSelect}
      className={`text-left bg-white rounded-xl overflow-hidden flex-shrink-0 w-48 border-2 transition-colors ${
        selected ? "border-brand-600 shadow-md" : "border-transparent hover:border-slate-200"
      }`}
    >
      <div className="grid grid-cols-6 gap-px bg-slate-100 h-12">
        {survey.items.slice(0, 6).map((item) => (
          <img key={item.id} src={item.photo} alt="" className="w-full h-full object-cover" />
        ))}
      </div>
      <div className="p-2">
        <p className="text-sm font-semibold text-slate-800 truncate">{survey.name}</p>
        <p className="text-xs text-slate-500 truncate">
          {survey.category} · {survey.items.length} productos
        </p>
      </div>
    </button>
  );
}

function CurationResults({ initialSurveyId }) {
  const [surveys, setSurveys] = useState([]);
  const [selectedId, setSelectedId] = useState(initialSurveyId || "");
  const [ranking, setRanking] = useState(null);
  const [responses, setResponses] = useState([]);
  const [selectedResponseId, setSelectedResponseId] = useState(""); // "" = ranking agregado ("Todos")
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [zoomItem, setZoomItem] = useState(null);
  const [approving, setApproving] = useState(null); // productId en proceso de aprobar/editar
  const selectedSurvey = surveys.find((s) => s.id === selectedId);
  const selectedResponse = responses.find((r) => r.id === selectedResponseId);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([getCurationSurveys(), getSyncStatus()]).then(([list, s]) => {
      setSurveys(list);
      setSyncStatus(s);
      if (!selectedId && list.length > 0) setSelectedId(list[0].id);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSurveyData = (surveyId) => {
    setRanking(null);
    setSelectedResponseId("");
    getCurationRankings(surveyId).then(setRanking);
    getCurationResponses(surveyId).then(setResponses);
  };

  useEffect(() => {
    if (!selectedId) return;
    loadSurveyData(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleDeleteResponse = async (response) => {
    if (!confirm(`¿Eliminar la respuesta de "${response.evaluador}"? También se borra su fila en Google Sheets si ya estaba sincronizada.`))
      return;
    setDeleting(true);
    try {
      await deleteCurationResponse(response.id);
      setSelectedResponseId("");
      loadSurveyData(selectedId);
    } finally {
      setDeleting(false);
    }
  };

  const toggleApproved = async (row) => {
    setApproving(row.productId);
    try {
      await updateCurationSurveyItem(selectedId, row.productId, { approvedForOrder: !row.approvedForOrder });
      setRanking((prev) => ({
        ...prev,
        ranking: prev.ranking.map((r) =>
          r.productId === row.productId ? { ...r, approvedForOrder: !r.approvedForOrder } : r
        ),
      }));
    } finally {
      setApproving(null);
    }
  };

  const saveProductUrl = async (row, url) => {
    if (url === row.productUrl) return;
    await updateCurationSurveyItem(selectedId, row.productId, { productUrl: url });
    setRanking((prev) => ({
      ...prev,
      ranking: prev.ranking.map((r) => (r.productId === row.productId ? { ...r, productUrl: url } : r)),
    }));
  };

  const approvedRows = ranking ? ranking.ranking.filter((r) => r.approvedForOrder) : [];

  const handleOrderCreated = (orderId) => {
    navigate(`/admin/pedidos/${orderId}`);
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
      {/* Solo visible al imprimir/exportar: los controles interactivos no imprimen su valor. */}
      {selectedSurvey && (
        <h1 className="hidden print:block text-lg font-bold text-slate-800 mb-4">
          {selectedSurvey.name} · {selectedSurvey.category}
        </h1>
      )}

      <div className="flex gap-3 overflow-x-auto pb-1 mb-4 print:hidden">
        {surveys.map((s) => (
          <SurveyPickerCard key={s.id} survey={s} selected={s.id === selectedId} onSelect={() => setSelectedId(s.id)} />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 print:hidden">
        <select
          value={selectedResponseId}
          onChange={(e) => setSelectedResponseId(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm font-medium max-w-[240px]"
        >
          <option value="">Todos los evaluadores (ranking)</option>
          {responses.map((r) => (
            <option key={r.id} value={r.id}>
              {r.evaluador} · {fechaCorta(r.fecha)}
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
          <button onClick={() => window.print()} className="text-sm bg-brand-600 text-white rounded-lg px-3 py-1.5">
            🖨️ Exportar / Imprimir
          </button>
        </div>
      </div>

      {selectedResponse ? (
        <IndividualSelection
          response={selectedResponse}
          survey={selectedSurvey}
          onZoom={setZoomItem}
          onDelete={() => handleDeleteResponse(selectedResponse)}
          deleting={deleting}
        />
      ) : (
        <>
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
                  Ordenado por <b>peso ponderado</b>: no es solo cuántos lo eligieron, sino en qué puesto (el
                  evaluador hace clic primero en su favorito absoluto). Úsalo para priorizar volumen de compra — un
                  producto con mayor % de peso merece más unidades que uno con la misma tasa de selección pero
                  elegido de último.
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
                        {row.name}{" "}
                        {row.vecesFavorito > 0 && <span className="text-amber-500">★{row.vecesFavorito}</span>}
                        {row.importedOrderIds?.length > 0 && (
                          <span className="ml-1 text-[10px] font-medium text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded-full">
                            en {row.importedOrderIds.length} pedido(s)
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-slate-500">
                        {row.votos} voto(s) · {row.pctSeleccion}% tasa de selección
                        {row.posicionPromedio != null && <> · puesto promedio #{row.posicionPromedio}</>}
                      </p>
                      <input
                        defaultValue={row.productUrl || ""}
                        onBlur={(e) => saveProductUrl(row, e.target.value.trim())}
                        placeholder="Link del producto (1688/Alibaba)..."
                        className="print:hidden mt-1 w-full text-xs border border-slate-200 rounded px-2 py-1 text-slate-500"
                      />
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-brand-700 text-sm">{row.pctPonderado}%</p>
                      <p className="text-[10px] text-slate-400 -mt-0.5">peso</p>
                    </div>
                    <span
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${curationBadgeClass[row.label]}`}
                    >
                      {row.label}
                    </span>
                    <button
                      onClick={() => toggleApproved(row)}
                      disabled={approving === row.productId}
                      className={`print:hidden text-xs font-semibold rounded-lg px-2.5 py-1.5 whitespace-nowrap disabled:opacity-60 ${
                        row.approvedForOrder
                          ? "bg-brand-600 text-white"
                          : "border border-slate-300 text-slate-600"
                      }`}
                      title="Aprobar este producto para incluirlo en un pedido"
                    >
                      🛒 {row.approvedForOrder ? "Aprobado" : "Aprobar"}
                    </button>
                  </div>
                ))}
              </div>

              {approvedRows.length > 0 && (
                <CreateOrderPanel surveyId={selectedId} approvedRows={approvedRows} onCreated={handleOrderCreated} />
              )}
            </>
          )}
        </>
      )}

      <ZoomModal photo={zoomItem?.photo} name={zoomItem?.name} onClose={() => setZoomItem(null)} />
    </div>
  );
}

function CreateOrderPanel({ surveyId, approvedRows, onCreated }) {
  const [mode, setMode] = useState("nuevo"); // "nuevo" | "existente"
  const [newOrderName, setNewOrderName] = useState("");
  const [orders, setOrders] = useState([]);
  const [existingOrderId, setExistingOrderId] = useState("");
  const [totalUnidades, setTotalUnidades] = useState(100);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getPurchaseOrders().then((list) => {
      setOrders(list);
      if (list.length > 0) setExistingOrderId(list[0].id);
    });
  }, []);

  const handleConfirm = async () => {
    setError("");
    const units = Number(totalUnidades);
    if (!Number.isInteger(units) || units < 1) {
      setError("Las unidades totales a repartir deben ser un número entero mayor a 0.");
      return;
    }
    if (mode === "nuevo" && !newOrderName.trim()) {
      setError("Ponle un nombre al pedido nuevo.");
      return;
    }
    if (mode === "existente" && !existingOrderId) {
      setError("Selecciona un pedido existente.");
      return;
    }
    setSubmitting(true);
    try {
      const orderId =
        mode === "nuevo" ? (await createPurchaseOrder(newOrderName.trim())).id : existingOrderId;
      await importCurationToPurchaseOrder(orderId, {
        surveyId,
        itemIds: approvedRows.map((r) => r.productId),
        totalUnidades: units,
      });
      onCreated(orderId);
    } catch (err) {
      setError(err.response?.data?.error || "Error creando/actualizando el pedido.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="print:hidden bg-brand-50 border border-brand-200 rounded-xl p-4 mt-4">
      <p className="font-semibold text-brand-800 mb-1">
        🛒 Crear pedido con {approvedRows.length} producto(s) aprobado(s)
      </p>
      <p className="text-xs text-brand-700 mb-3">
        Se sugerirá la cantidad por empaque de cada producto proporcional a su peso ponderado en esta curaduría —
        podrás confirmar o editar cada cantidad dentro del pedido antes de finalizar.
      </p>
      <div className="flex flex-wrap gap-4 items-end">
        <div className="flex gap-3">
          <label className="text-sm flex items-center gap-1.5">
            <input type="radio" checked={mode === "nuevo"} onChange={() => setMode("nuevo")} />
            Pedido nuevo
          </label>
          <label className="text-sm flex items-center gap-1.5">
            <input type="radio" checked={mode === "existente"} onChange={() => setMode("existente")} />
            Pedido existente
          </label>
        </div>

        {mode === "nuevo" ? (
          <input
            value={newOrderName}
            onChange={(e) => setNewOrderName(e.target.value)}
            placeholder="Nombre del pedido nuevo"
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
          />
        ) : orders.length > 0 ? (
          <select
            value={existingOrderId}
            onChange={(e) => setExistingOrderId(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
          >
            {orders.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-xs text-slate-500">No hay pedidos existentes todavía.</span>
        )}

        <div>
          <label className="block text-xs text-slate-600 mb-0.5">Unidades totales a repartir</label>
          <input
            type="number"
            min={1}
            value={totalUnidades}
            onChange={(e) => setTotalUnidades(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm w-32"
          />
        </div>

        <button
          onClick={handleConfirm}
          disabled={submitting}
          className="bg-brand-600 text-white rounded-lg px-4 py-1.5 text-sm font-medium disabled:opacity-60"
        >
          {submitting ? "Enviando..." : "Confirmar"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  );
}

function IndividualSelection({ response, survey, onZoom, onDelete, deleting }) {
  const items = response.selectedProductIds
    .map((id) => survey?.items.find((i) => i.id === id))
    .filter(Boolean);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <p className="font-semibold text-slate-800">Selección de {response.evaluador}</p>
          <p className="text-xs text-slate-500">{fechaCorta(response.fecha)}</p>
        </div>
        <button
          onClick={onDelete}
          disabled={deleting}
          className="text-sm border border-red-200 text-red-600 rounded-lg px-3 py-1.5 disabled:opacity-60 print:hidden"
        >
          {deleting ? "Eliminando..." : "🗑️ Eliminar esta respuesta"}
        </button>
      </div>

      <ol className="space-y-2 mb-4">
        {items.map((item, i) => (
          <li key={item.id} className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-2">
            <span
              className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                i === 0 ? "bg-amber-500 text-white" : "bg-brand-50 text-brand-700"
              }`}
            >
              {i === 0 ? "★" : `#${i + 1}`}
            </span>
            <img
              src={item.photo}
              alt={item.name}
              onClick={() => onZoom({ photo: item.photo, name: item.name })}
              className="w-16 h-16 print:w-32 print:h-32 rounded-lg object-cover flex-shrink-0 cursor-zoom-in hover:opacity-80"
            />
            <span className="font-medium text-slate-800 truncate">{item.name}</span>
          </li>
        ))}
      </ol>

      {response.comentarios && (
        <div className="bg-slate-50 rounded-lg p-3 text-sm">
          <span className="font-medium text-slate-700">Comentarios: </span>
          <span className="text-slate-600">{response.comentarios}</span>
        </div>
      )}
    </div>
  );
}
