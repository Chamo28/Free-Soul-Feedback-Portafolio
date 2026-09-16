import { useEffect, useRef, useState } from "react";
import Navbar from "../components/Navbar.jsx";
import ZoomModal from "../components/ZoomModal.jsx";
import {
  getSkuGallery,
  uploadSkuGalleryPhotos,
  updateSkuGalleryVariant,
  deleteSkuGalleryVariant,
  syncSkuGallery,
  createSkuGalleryCollection,
  updateSkuGalleryCollection,
  deleteSkuGalleryCollection,
  assignSkuGalleryModelCollection,
} from "../api.js";
import { formatCOP } from "../utils/purchaseOrderCalc.js";

const CATEGORIAS_COLECCION = ["Bolsos", "Calzado", "Ropa", "Accesorios"];

// Tamaño de lote para subir fotos: con cientos de fotos, mandarlas TODAS en
// una sola request tardaba minutos sin dar ninguna señal de progreso (y
// arriesgaba el límite de archivos por request del backend). Se suben en
// tandas chicas, una tras otra, así cada request es rápida y se puede
// mostrar una barra de progreso real (tanda a tanda).
const UPLOAD_BATCH_SIZE = 15;

function emptyCollectionForm() {
  return { name: "", description: "", pvpObjetivo: "", categoria: "" };
}

function chunk(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) chunks.push(array.slice(i, i + size));
  return chunks;
}

// Agrupa la lista plana de variantes por modelo (la letra) y ordena cada
// grupo por código (A1, A2, A3...) para que la grilla salga estable.
function groupByModelo(variants) {
  const groups = new Map();
  for (const v of variants) {
    if (!groups.has(v.modelo)) groups.set(v.modelo, []);
    groups.get(v.modelo).push(v);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  }
  return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

// Nivel superior: agrupa por Colección (y dentro de cada una, por modelo —
// ver groupByModelo). Las colecciones aparecen en el orden en que se
// crearon; un bucket final "Sin colección" agrupa lo que todavía no tiene
// collectionId asignado (solo aparece si hay algo ahí).
function groupByCollection(variants, collections) {
  const byId = new Map();
  for (const v of variants) {
    const key = v.collectionId || "__none__";
    if (!byId.has(key)) byId.set(key, []);
    byId.get(key).push(v);
  }
  const buckets = [];
  for (const collection of collections) {
    const vars = byId.get(collection.id) || [];
    if (vars.length > 0) buckets.push({ collection, modeloGroups: groupByModelo(vars) });
  }
  const sinColeccion = byId.get("__none__") || [];
  if (sinColeccion.length > 0) buckets.push({ collection: null, modeloGroups: groupByModelo(sinColeccion) });
  return buckets;
}

export default function SkuGallery() {
  const [variants, setVariants] = useState([]);
  const [collections, setCollections] = useState([]);
  const [collectionFilter, setCollectionFilter] = useState("all"); // "all" | "none" | <id>
  const [collectionFormOpen, setCollectionFormOpen] = useState(false);
  const [editingCollectionId, setEditingCollectionId] = useState(null); // null = creando una nueva
  const [collectionForm, setCollectionForm] = useState(emptyCollectionForm());
  const [savingCollection, setSavingCollection] = useState(false);
  const [photoHostConfigured, setPhotoHostConfigured] = useState(true); // optimista hasta el primer load
  const [loading, setLoading] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null); // { done, total } mientras sube
  const [uploadWarnings, setUploadWarnings] = useState([]);
  const [failedBatches, setFailedBatches] = useState([]); // File[][] — tandas que fallaron por completo, listas para reintentar
  const [expanded, setExpanded] = useState(new Set());
  const [zoomItem, setZoomItem] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const fileInputRef = useRef(null);

  const load = () => {
    getSkuGallery()
      .then(({ variants, collections, photoHostConfigured }) => {
        setVariants(variants);
        setCollections(collections || []);
        setPhotoHostConfigured(photoHostConfigured);
        // Todos los modelos empiezan expandidos la primera vez que se cargan.
        setExpanded((prev) => new Set([...prev, ...variants.map((v) => v.modelo)]));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(load, []);

  const handleFiles = async (fileList) => {
    if (uploading) return; // evita mezclar dos subidas si se sueltan más fotos a mitad de camino
    const files = Array.from(fileList || []);
    if (files.length === 0) return;
    setUploading(true);
    setUploadWarnings([]);
    setFailedBatches([]);
    const batches = chunk(files, UPLOAD_BATCH_SIZE);
    setUploadProgress({ done: 0, total: files.length });

    let totalAdded = 0;
    let totalOverwritten = 0;
    const unrecognized = [];
    const uploadFailures = [];
    const stillFailedBatches = []; // tandas completas que fallaron — se ofrece reintentarlas

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      try {
        const formData = new FormData();
        batch.forEach((f) => formData.append("photos", f));
        const result = await uploadSkuGalleryPhotos(formData);
        setVariants(result.variants);
        setExpanded((prev) => new Set([...prev, ...result.variants.map((v) => v.modelo)]));
        totalAdded += result.addedCount || 0;
        totalOverwritten += result.overwrittenCount || 0;
        if (result.unrecognized?.length) unrecognized.push(...result.unrecognized);
        if (result.uploadFailures?.length) uploadFailures.push(...result.uploadFailures);
      } catch (err) {
        // Un lote que falla (red, servidor) no frena los demás — los lotes
        // anteriores ya quedaron guardados, así que seguimos con el resto.
        // Se guardan sus archivos para poder reintentar SOLO esta tanda.
        stillFailedBatches.push(batch);
        uploadFailures.push(
          `Tanda ${i + 1}/${batches.length} (${batch.length} foto(s)): ${err.response?.data?.error || "no se pudo subir."}`
        );
      } finally {
        setUploadProgress({ done: Math.min((i + 1) * UPLOAD_BATCH_SIZE, files.length), total: files.length });
      }
    }

    const warnings = [];
    if (totalAdded > 0) warnings.push(`✅ ${totalAdded} variante(s) nueva(s) registrada(s).`);
    if (totalOverwritten > 0) warnings.push(`🔄 ${totalOverwritten} foto(s) reemplazada(s) (mismo código, ya existían).`);
    if (unrecognized.length) warnings.push(`⚠️ No se reconoció el patrón LETRA+NÚMERO en: ${unrecognized.join(", ")}.`);
    if (uploadFailures.length) warnings.push(...uploadFailures.map((f) => `❌ ${f}`));
    setUploadWarnings(warnings);
    setFailedBatches(stillFailedBatches);
    setUploading(false);
    setUploadProgress(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRetryFailed = () => {
    const filesToRetry = failedBatches.flat();
    setFailedBatches([]);
    handleFiles(filesToRetry);
  };

  const patchLocal = (id, patch) => {
    setVariants((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)));
  };

  const handleToggleApproved = (variant) => {
    const approved = !variant.approved;
    patchLocal(variant.id, { approved });
    updateSkuGalleryVariant(variant.id, { approved });
  };

  const handleQtyCommit = (variant, value) => {
    const cantidad = Number(value) || 0;
    patchLocal(variant.id, { cantidad });
    updateSkuGalleryVariant(variant.id, { cantidad });
  };

  const handleLabelCommit = (variant, value) => {
    const label = value.trim() || variant.code;
    patchLocal(variant.id, { label });
    updateSkuGalleryVariant(variant.id, { label });
  };

  const handleDelete = async (variant) => {
    if (!confirm(`¿Quitar "${variant.label}" de la galería? También se borra su foto guardada.`)) return;
    setVariants((prev) => prev.filter((v) => v.id !== variant.id));
    await deleteSkuGalleryVariant(variant.id);
  };

  const toggleExpanded = (modelo) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(modelo)) next.delete(modelo);
      else next.add(modelo);
      return next;
    });
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg("");
    try {
      const result = await syncSkuGallery();
      setSyncMsg(result.ok ? "✅ Sincronizado con Google Sheets." : `❌ ${result.error}`);
    } finally {
      setSyncing(false);
    }
  };

  // --- Colecciones ---

  const openNewCollectionForm = () => {
    setEditingCollectionId(null);
    setCollectionForm(emptyCollectionForm());
    setCollectionFormOpen(true);
  };

  const openEditCollectionForm = (collection) => {
    setEditingCollectionId(collection.id);
    setCollectionForm({
      name: collection.name,
      description: collection.description || "",
      pvpObjetivo: collection.pvpObjetivo || "",
      categoria: collection.categoria || "",
    });
    setCollectionFormOpen(true);
  };

  const handleSaveCollection = async (e) => {
    e.preventDefault();
    if (!collectionForm.name.trim()) return;
    setSavingCollection(true);
    try {
      const payload = {
        name: collectionForm.name.trim(),
        description: collectionForm.description.trim(),
        pvpObjetivo: Number(collectionForm.pvpObjetivo) || 0,
        categoria: collectionForm.categoria,
      };
      if (editingCollectionId) {
        const updated = await updateSkuGalleryCollection(editingCollectionId, payload);
        setCollections((prev) => prev.map((c) => (c.id === editingCollectionId ? updated : c)));
      } else {
        const created = await createSkuGalleryCollection(payload);
        setCollections((prev) => [...prev, created]);
      }
      setCollectionFormOpen(false);
    } finally {
      setSavingCollection(false);
    }
  };

  const handleDeleteCollection = async (collection) => {
    if (
      !confirm(
        `¿Borrar la colección "${collection.name}"? Los modelos asignados quedan como "Sin colección" (no se borra ninguna foto).`
      )
    )
      return;
    const result = await deleteSkuGalleryCollection(collection.id);
    setCollections((prev) => prev.filter((c) => c.id !== collection.id));
    setVariants(result.variants);
    if (collectionFilter === collection.id) setCollectionFilter("all");
  };

  const handleAssignModeloCollection = async (modelo, collectionId) => {
    const result = await assignSkuGalleryModelCollection(modelo, collectionId || null);
    setVariants(result.variants);
  };

  const filteredVariants =
    collectionFilter === "all"
      ? variants
      : collectionFilter === "none"
        ? variants.filter((v) => !v.collectionId)
        : variants.filter((v) => v.collectionId === collectionFilter);
  const buckets = groupByCollection(filteredVariants, collections);
  const modelosCount = buckets.reduce((sum, b) => sum + b.modeloGroups.length, 0);
  const approvedCount = filteredVariants.filter((v) => v.approved).length;

  return (
    <div>
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-6">
        <h1 className="text-lg font-bold text-slate-800 mb-1">🎨 Galería Privada de SKUs y Variantes de Color</h1>
        <p className="text-sm text-slate-500 mb-4">
          Revisa todas las fotos de color de cada modelo (de la encuesta pública o adicionales) y aprueba las que se
          piden, antes de pasar a la calculadora de pedidos.
        </p>

        {!loading && !photoHostConfigured && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 mb-4 text-sm text-amber-800">
            ⚠️ Todavía falta configurar Cloudinary en el backend (variable <code>CLOUDINARY_URL</code>, se copia tal
            cual del dashboard de cloudinary.com). Mientras tanto, subir fotos va a fallar.
          </div>
        )}

        {/* Colecciones: filtro + gestión */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <select
            value={collectionFilter}
            onChange={(e) => setCollectionFilter(e.target.value)}
            className="text-sm border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white"
          >
            <option value="all">Todas las colecciones</option>
            <option value="none">Sin colección</option>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            onClick={openNewCollectionForm}
            className="text-sm border border-brand-300 text-brand-700 rounded-lg px-3 py-1.5"
          >
            + Nueva colección
          </button>
          {collections.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {collections.map((c) => (
                <span
                  key={c.id}
                  className="inline-flex items-center gap-1 text-xs bg-slate-100 rounded-full pl-2.5 pr-1 py-1"
                >
                  {c.name}
                  <button
                    onClick={() => openEditCollectionForm(c)}
                    title="Editar"
                    className="w-5 h-5 rounded-full hover:bg-slate-200 flex items-center justify-center"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDeleteCollection(c)}
                    title="Borrar"
                    className="w-5 h-5 rounded-full hover:bg-red-100 text-red-500 flex items-center justify-center"
                  >
                    🗑️
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {collectionFormOpen && (
          <form
            onSubmit={handleSaveCollection}
            className="bg-white border border-slate-200 rounded-xl p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3"
          >
            <p className="sm:col-span-2 text-sm font-medium text-slate-700">
              {editingCollectionId ? "Editar colección" : "Nueva colección"}
            </p>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Nombre</label>
              <input
                value={collectionForm.name}
                onChange={(e) => setCollectionForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ej. Bolsos Precio Medio"
                required
                className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Categoría / Género</label>
              <select
                value={collectionForm.categoria}
                onChange={(e) => setCollectionForm((f) => ({ ...f, categoria: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm"
              >
                <option value="">—</option>
                {CATEGORIAS_COLECCION.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-slate-500 mb-1">Descripción / concepto</label>
              <input
                value={collectionForm.description}
                onChange={(e) => setCollectionForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Ej. Línea urbana funcional para estrato 2-4"
                className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">PVP objetivo sugerido (COP)</label>
              <input
                type="number"
                step="any"
                value={collectionForm.pvpObjetivo}
                onChange={(e) => setCollectionForm((f) => ({ ...f, pvpObjetivo: e.target.value }))}
                placeholder="89000"
                className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm"
              />
            </div>
            <div className="sm:col-span-2 flex gap-2">
              <button
                type="submit"
                disabled={savingCollection || !collectionForm.name.trim()}
                className="bg-brand-600 text-white rounded-lg px-4 py-1.5 text-sm font-medium disabled:opacity-60"
              >
                {savingCollection ? "Guardando..." : editingCollectionId ? "Guardar cambios" : "Crear colección"}
              </button>
              <button
                type="button"
                onClick={() => setCollectionFormOpen(false)}
                className="border border-slate-300 rounded-lg px-4 py-1.5 text-sm"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        {/* Resumen */}
        <div className="grid grid-cols-3 gap-3 mb-4 max-w-md">
          <SummaryCard label="Modelos" value={modelosCount} />
          <SummaryCard label="Variantes" value={filteredVariants.length} />
          <SummaryCard label="Aprobadas" value={approvedCount} highlight />
        </div>

        {/* Dropzone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFiles(e.dataTransfer.files);
          }}
          className={`border-2 border-dashed rounded-xl p-6 text-center mb-4 transition-colors ${
            dragOver ? "border-brand-500 bg-brand-50" : "border-slate-300 bg-white"
          }`}
        >
          <p className="text-sm text-slate-600 mb-1">
            📂 Arrastra aquí las fotos locales, o
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-brand-600 font-medium underline mx-1"
            >
              elige archivos
            </button>
          </p>
          <p className="text-xs text-slate-400">
            Nombra cada foto <code>LETRA+NÚMERO</code> (ej. <code>A1.jpg</code>, <code>A2.jpg</code>, <code>B1.jpg</code>) — la
            letra agrupa el modelo, el número es la variante de color. Se suben directo a Cloudinary, nunca a este
            servidor. Si vuelves a soltar una foto con el mismo código (ej. otra <code>A1.jpg</code>), reemplaza la
            foto anterior — no se duplica.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
          />
          {uploading && uploadProgress && (
            <div className="mt-3 max-w-xs mx-auto">
              <div className="flex justify-between text-xs text-brand-700 font-medium mb-1">
                <span>Subiendo fotos...</span>
                <span>
                  {uploadProgress.done} / {uploadProgress.total}
                </span>
              </div>
              <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-600 transition-all duration-300"
                  style={{ width: `${Math.round((uploadProgress.done / uploadProgress.total) * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {uploadWarnings.length > 0 && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 mb-4">
            <ul className="text-xs space-y-0.5 text-slate-600">
              {uploadWarnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
            {!uploading && failedBatches.length > 0 && (
              <button
                onClick={handleRetryFailed}
                className="mt-2 text-xs bg-red-50 text-red-700 border border-red-200 rounded-lg px-3 py-1.5 font-medium"
              >
                🔁 Reintentar {failedBatches.flat().length} foto(s) que no se pudieron subir
              </button>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="text-sm bg-brand-600 text-white rounded-lg px-4 py-1.5 disabled:opacity-60"
          >
            {syncing ? "Guardando..." : "💾 Guardar selección en Sheets"}
          </button>
          {syncMsg && <span className="text-xs text-slate-500">{syncMsg}</span>}
        </div>

        {!loading && buckets.length === 0 && (
          <div className="bg-white border border-dashed border-slate-300 rounded-xl p-10 text-center text-slate-500">
            {variants.length === 0
              ? "Todavía no hay ninguna variante — suelta fotos arriba para empezar."
              : "Ningún modelo en esta colección todavía."}
          </div>
        )}

        <div className="space-y-5">
          {buckets.map(({ collection, modeloGroups }) => {
            const bucketVariants = modeloGroups.flatMap(([, items]) => items);
            const bucketApproved = bucketVariants.filter((v) => v.approved).length;
            return (
              <div key={collection?.id || "__none__"}>
                {/* Encabezado de Colección */}
                <div
                  className={`rounded-xl p-3.5 mb-2.5 flex flex-wrap items-center justify-between gap-2 ${
                    collection ? "bg-brand-700 text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  <div>
                    <p className="font-display font-bold">{collection ? collection.name : "Sin colección"}</p>
                    {collection?.description && (
                      <p className={`text-xs ${collection ? "text-white/80" : "text-slate-500"}`}>
                        {collection.description}
                      </p>
                    )}
                    <p className={`text-xs mt-0.5 ${collection ? "text-white/70" : "text-slate-400"}`}>
                      {modeloGroups.length} modelo(s) · {bucketVariants.length} variante(s) · {bucketApproved} aprobada(s)
                      {collection?.categoria ? ` · ${collection.categoria}` : ""}
                    </p>
                  </div>
                  {collection?.pvpObjetivo > 0 && (
                    <span
                      className={`text-xs font-bold px-3 py-1.5 rounded-full ${
                        collection ? "bg-white/15 text-white" : "bg-white text-slate-700"
                      }`}
                    >
                      PVP objetivo {formatCOP(collection.pvpObjetivo)}
                    </span>
                  )}
                </div>

                {/* Grilla anidada: Modelos -> Variantes */}
                <div className="space-y-3">
                  {modeloGroups.map(([modelo, items]) => (
                    <div key={modelo} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                      <div className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 gap-2 flex-wrap">
                        <button
                          onClick={() => toggleExpanded(modelo)}
                          className="flex items-center gap-2 font-semibold text-slate-800 flex-1 min-w-0 text-left"
                        >
                          Modelo {modelo} <span className="text-slate-400 font-normal">· {items.length} variante(s)</span>
                          <span className="text-slate-400 ml-auto">{expanded.has(modelo) ? "▲" : "▼"}</span>
                        </button>
                        <select
                          value={collection?.id || ""}
                          onChange={(e) => handleAssignModeloCollection(modelo, e.target.value || null)}
                          onClick={(e) => e.stopPropagation()}
                          title="Asignar este modelo a una colección"
                          className="text-xs border border-slate-300 rounded-lg px-2 py-1 bg-white"
                        >
                          <option value="">Sin colección</option>
                          {collections.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      {expanded.has(modelo) && (
                        <div className="p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                          {items.map((v) => (
                            <VariantCard
                              key={v.id}
                              variant={v}
                              onZoom={() => setZoomItem({ photo: v.photoUrl, name: v.label })}
                              onToggleApproved={() => handleToggleApproved(v)}
                              onQtyCommit={(val) => handleQtyCommit(v, val)}
                              onLabelCommit={(val) => handleLabelCommit(v, val)}
                              onDelete={() => handleDelete(v)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <ZoomModal photo={zoomItem?.photo} name={zoomItem?.name} onClose={() => setZoomItem(null)} />
    </div>
  );
}

function VariantCard({ variant, onZoom, onToggleApproved, onQtyCommit, onLabelCommit, onDelete }) {
  const [qty, setQty] = useState(variant.cantidad);
  const [label, setLabel] = useState(variant.label);
  useEffect(() => setQty(variant.cantidad), [variant.cantidad]);
  useEffect(() => setLabel(variant.label), [variant.label]);

  return (
    <div
      className={`rounded-lg border overflow-hidden ${
        variant.approved ? "border-brand-500 ring-1 ring-brand-300" : "border-slate-200"
      }`}
    >
      <div className="aspect-square bg-slate-100 relative">
        {variant.photoUrl ? (
          <img
            src={variant.photoUrl}
            alt={variant.label}
            referrerPolicy="no-referrer"
            onClick={onZoom}
            className="w-full h-full object-cover cursor-zoom-in"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300 text-xs text-center px-2">
            Sin vista previa
          </div>
        )}
        <button
          type="button"
          onClick={onDelete}
          title="Quitar variante"
          className="absolute top-1 right-1 w-6 h-6 bg-black/45 hover:bg-red-600 rounded-full text-white text-xs flex items-center justify-center"
        >
          🗑️
        </button>
      </div>
      <div className="p-2 space-y-1.5">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={(e) => onLabelCommit(e.target.value)}
          className="w-full text-xs font-medium border border-transparent hover:border-slate-200 focus:border-brand-400 rounded px-1 py-0.5 -mx-1"
        />
        <label className="flex items-center gap-1.5 text-xs text-slate-600">
          <input type="checkbox" checked={variant.approved} onChange={onToggleApproved} />
          Aprobar SKU
        </label>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-slate-400">Empaques/Uds.</span>
          <input
            type="number"
            step="any"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            onBlur={(e) => onQtyCommit(e.target.value)}
            className="w-16 border border-slate-200 rounded px-1 py-0.5 text-xs"
          />
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, highlight }) {
  return (
    <div className={`rounded-lg py-2.5 text-center ${highlight ? "bg-brand-50" : "bg-slate-50"}`}>
      <p className={`text-base font-bold ${highlight ? "text-brand-700" : "text-slate-800"}`}>{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
