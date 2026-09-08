import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import Navbar from "../components/Navbar.jsx";
import ZoomModal from "../components/ZoomModal.jsx";
import {
  getCurationSurvey,
  updateCurationSurvey,
  addCurationSurveyItem,
  updateCurationSurveyItem,
  deleteCurationSurveyItem,
  reimportCurationSurvey,
  getCategories,
} from "../api.js";
import { readImportFile } from "../utils/readImportFile.js";

const STATUS_OPTIONS = [
  { value: "activa", label: "Activa", hint: "El evaluador puede responder normalmente." },
  { value: "inactiva", label: "Inactiva", hint: "El link deja de aceptar respuestas nuevas (pausada)." },
  { value: "borrador", label: "Borrador", hint: "Todavía no está lista para compartir." },
];

export default function CurationEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [survey, setSurvey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [categories, setCategories] = useState([]);
  const [savedMsg, setSavedMsg] = useState("");
  const [zoomItem, setZoomItem] = useState(null);

  const [addOpen, setAddOpen] = useState(false);
  const [addProductUrl, setAddProductUrl] = useState("");
  const [addReferencia, setAddReferencia] = useState("");
  const [addImageUrls, setAddImageUrls] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");

  const [reimportOpen, setReimportOpen] = useState(false);
  const [reimportText, setReimportText] = useState("");
  const [reimporting, setReimporting] = useState(false);
  const [reimportMsg, setReimportMsg] = useState("");
  const [reimportWarnings, setReimportWarnings] = useState([]);
  const fileInputRef = useRef(null);

  const load = () => {
    getCurationSurvey(id)
      .then((s) => {
        setSurvey(s);
        setLoading(false);
      })
      .catch(() => {
        setNotFound(true);
        setLoading(false);
      });
  };

  useEffect(load, [id]);
  useEffect(() => {
    getCategories().then(setCategories);
  }, []);

  const flashSaved = () => {
    setSavedMsg("✓ Guardado");
    setTimeout(() => setSavedMsg(""), 1500);
  };

  const patchSurvey = async (patch) => {
    setSurvey((prev) => ({ ...prev, ...patch }));
    await updateCurationSurvey(id, patch);
    flashSaved();
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    setAddError("");
    if (!addImageUrls.trim()) {
      setAddError("Agrega al menos un link de imagen.");
      return;
    }
    setAdding(true);
    try {
      const updated = await addCurationSurveyItem(id, {
        productUrl: addProductUrl.trim(),
        referencia: addReferencia.trim(),
        imageUrls: addImageUrls,
      });
      setSurvey(updated);
      setAddProductUrl("");
      setAddReferencia("");
      setAddImageUrls("");
      setAddOpen(false);
    } catch (err) {
      setAddError(err.response?.data?.error || "No se pudo agregar el producto.");
    } finally {
      setAdding(false);
    }
  };

  const handleRenameItem = async (itemId, newName) => {
    const trimmed = newName.trim();
    const current = survey.items.find((it) => it.id === itemId);
    if (!trimmed || trimmed === current?.name) return;
    setSurvey((prev) => ({
      ...prev,
      items: prev.items.map((it) => (it.id === itemId ? { ...it, name: trimmed } : it)),
    }));
    await updateCurationSurveyItem(id, itemId, { name: trimmed });
  };

  const handleDeleteItem = async (itemId, name) => {
    if (!confirm(`¿Quitar "${name}" de esta curaduría? No afecta respuestas ya guardadas.`)) return;
    setSurvey((prev) => ({ ...prev, items: prev.items.filter((it) => it.id !== itemId) }));
    await deleteCurationSurveyItem(id, itemId);
  };

  const handleReimportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    readImportFile(file)
      .then((text) => setReimportText(text))
      .catch(() => setReimportMsg("No se pudo leer el archivo. Verifica que sea un .xlsx, .csv o .txt válido."));
  };

  const handleReimport = async () => {
    if (!reimportText.trim()) return;
    setReimporting(true);
    setReimportMsg("");
    setReimportWarnings([]);
    try {
      const updated = await reimportCurationSurvey(id, reimportText);
      setSurvey(updated);
      setReimportWarnings(updated.importWarnings || []);
      setReimportMsg(`✓ ${updated.added} producto(s) nuevo(s), ${updated.updated} actualizado(s).`);
      setReimportText("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setReimportMsg(err.response?.data?.error || "Error reimportando el archivo.");
    } finally {
      setReimporting(false);
    }
  };

  if (loading) {
    return (
      <div>
        <Navbar />
        <p className="text-center text-slate-400 mt-10">Cargando...</p>
      </div>
    );
  }

  if (notFound || !survey) {
    return (
      <div>
        <Navbar />
        <div className="max-w-3xl mx-auto px-4 py-6">
          <p className="text-slate-500">Encuesta no encontrada.</p>
          <Link to="/admin/curaduria" className="text-brand-600 text-sm">
            ← Volver a curaduría
          </Link>
        </div>
      </div>
    );
  }

  const status = survey.status || "activa";

  return (
    <div>
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
          <Link to="/admin/curaduria" className="text-sm text-slate-400">
            ← Curaduría
          </Link>
          {savedMsg && <span className="text-xs text-green-600 font-medium">{savedMsg}</span>}
        </div>
        <h1 className="text-lg font-bold text-slate-800 mb-4">Editar: {survey.name}</h1>

        {/* Parámetros de la encuesta */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Título</label>
            <input
              defaultValue={survey.name}
              onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== survey.name && patchSurvey({ name: e.target.value.trim() })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Instrucciones para el evaluador</label>
            <textarea
              defaultValue={survey.instructions || ""}
              rows={3}
              onBlur={(e) => e.target.value.trim() !== (survey.instructions || "") && patchSurvey({ instructions: e.target.value.trim() })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Categoría</label>
              <select
                value={survey.category}
                onChange={(e) => patchSurvey({ category: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-2 py-2 text-sm"
              >
                {!categories.includes(survey.category) && <option value={survey.category}>{survey.category}</option>}
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Regla</label>
              <select
                value={survey.selectionRule.mode}
                onChange={(e) => patchSurvey({ selectionMode: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-2 py-2 text-sm"
              >
                <option value="exact">Exactamente</option>
                <option value="max">Máximo</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Cantidad (X)</label>
              <input
                type="number"
                min={1}
                defaultValue={survey.selectionRule.count}
                onBlur={(e) => {
                  const v = Number(e.target.value);
                  if (v && v !== survey.selectionRule.count) patchSurvey({ selectionCount: v });
                }}
                className="w-full border border-slate-300 rounded-lg px-2 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Estado</label>
              <select
                value={status}
                onChange={(e) => patchSurvey({ status: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-2 py-2 text-sm"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-xs text-slate-500 -mt-2">{STATUS_OPTIONS.find((o) => o.value === status)?.hint}</p>
        </div>

        {/* Acciones sobre productos */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setAddOpen((v) => !v)}
            className="text-sm bg-brand-600 text-white rounded-lg px-3 py-1.5"
          >
            + Agregar producto
          </button>
          <button
            onClick={() => setReimportOpen((v) => !v)}
            className="text-sm border border-slate-300 rounded-lg px-3 py-1.5"
          >
            📥 Reimportar CSV/TXT/Excel
          </button>
          <Link
            to={`/admin/results?curaduria=${survey.id}`}
            className="text-sm border border-slate-300 rounded-lg px-3 py-1.5"
          >
            Ver resultados
          </Link>
        </div>

        {addOpen && (
          <form onSubmit={handleAddItem} className="bg-white border border-slate-200 rounded-xl p-4 mb-4 space-y-2">
            <p className="text-sm font-medium text-slate-700">Agregar producto manualmente</p>
            <input
              value={addReferencia}
              onChange={(e) => setAddReferencia(e.target.value)}
              placeholder="Referencia / nombre (opcional)"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
            <input
              value={addProductUrl}
              onChange={(e) => setAddProductUrl(e.target.value)}
              placeholder="Link del producto (1688/Alibaba, opcional)"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
            <textarea
              value={addImageUrls}
              onChange={(e) => setAddImageUrls(e.target.value)}
              placeholder="Link(s) de imagen — separados por coma si son varios colores/variantes (cada uno se crea como producto aparte)"
              rows={2}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
            {addError && <p className="text-sm text-red-600">{addError}</p>}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={adding}
                className="bg-brand-600 text-white rounded-lg px-4 py-1.5 text-sm font-medium disabled:opacity-60"
              >
                {adding ? "Agregando y descargando fotos..." : "Agregar"}
              </button>
              <button type="button" onClick={() => setAddOpen(false)} className="border border-slate-300 rounded-lg px-4 py-1.5 text-sm">
                Cancelar
              </button>
            </div>
          </form>
        )}

        {reimportOpen && (
          <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4 space-y-2">
            <p className="text-sm font-medium text-slate-700">Reimportar productos</p>
            <p className="text-xs text-slate-500">
              Cada foto de una fila (<code>URL_Imagen_1</code>, <code>URL_Imagen_2</code>...) es un{" "}
              <b>producto/color distinto a evaluar</b>, no una foto extra del mismo producto — una fila con 4 fotos
              genera 4 productos. Una combinación (link + foto) que ya existe en esta curaduría se{" "}
              <b>actualiza</b> (nombre/foto), conservando las respuestas ya guardadas; una combinación nueva se{" "}
              <b>agrega</b>. Nada se borra por reimportar — para quitar un producto usa su botón de eliminar.
            </p>
            <a href="/plantilla_pedidos.xlsx" download className="inline-block text-xs text-brand-600 underline">
              📋 Descargar plantilla Excel (.xlsx)
            </a>
            <input ref={fileInputRef} type="file" accept=".csv,.txt,.xlsx,.xls" onChange={handleReimportFile} className="text-sm block" />
            <textarea
              value={reimportText}
              onChange={(e) => setReimportText(e.target.value)}
              rows={5}
              placeholder="O pega aquí el contenido..."
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono"
            />
            {reimportWarnings.length > 0 && (
              <ul className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2 space-y-0.5">
                {reimportWarnings.map((w, i) => (
                  <li key={i}>⚠️ {w}</li>
                ))}
              </ul>
            )}
            {reimportMsg && <p className="text-sm text-slate-700">{reimportMsg}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleReimport}
                disabled={reimporting || !reimportText.trim()}
                className="bg-brand-600 text-white rounded-lg px-4 py-1.5 text-sm font-medium disabled:opacity-60"
              >
                {reimporting ? "Reimportando..." : "Reimportar"}
              </button>
              <button onClick={() => setReimportOpen(false)} className="border border-slate-300 rounded-lg px-4 py-1.5 text-sm">
                Cerrar
              </button>
            </div>
          </div>
        )}

        {/* Grilla de productos */}
        <p className="text-sm text-slate-500 mb-2">{survey.items.length} producto(s) en esta curaduría.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {survey.items.map((item) => (
            <div key={item.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
              <img
                src={item.photos?.[0] || item.photo}
                alt={item.name}
                referrerPolicy="no-referrer"
                onClick={() => setZoomItem({ photo: item.photos?.[0] || item.photo, name: item.name })}
                className="aspect-square object-cover cursor-zoom-in hover:opacity-80"
              />
              <div className="p-2 flex flex-col gap-1">
                <input
                  key={item.name}
                  defaultValue={item.name}
                  onBlur={(e) => handleRenameItem(item.id, e.target.value)}
                  title="Nombre del producto (ej. agrégale el color para distinguirlo)"
                  className="text-xs font-medium text-slate-800 border border-transparent hover:border-slate-200 focus:border-brand-400 rounded px-1 py-0.5 -mx-1 w-full"
                />
                {item.productUrl && (
                  <a
                    href={item.productUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-brand-600 underline truncate"
                  >
                    🔗 ver producto
                  </a>
                )}
                <button
                  onClick={() => handleDeleteItem(item.id, item.name)}
                  className="text-[11px] text-red-500 border border-red-200 rounded px-1.5 py-0.5 mt-1"
                >
                  🗑️ Quitar
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <ZoomModal photo={zoomItem?.photo} name={zoomItem?.name} onClose={() => setZoomItem(null)} />
    </div>
  );
}
