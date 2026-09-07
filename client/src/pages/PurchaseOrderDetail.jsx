import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import Navbar from "../components/Navbar.jsx";
import ZoomModal from "../components/ZoomModal.jsx";
import {
  getPurchaseOrder,
  updatePurchaseOrder,
  importPurchaseOrderText,
  updatePurchaseOrderItem,
  deletePurchaseOrderItem,
  syncPurchaseOrder,
  downloadPurchaseOrderCsv,
} from "../api.js";
import { computeOrderSummary, formatCOP, formatUSD } from "../utils/purchaseOrderCalc.js";

const CATEGORIAS = ["Bolsos", "Calzado", "Ropa", "Accesorios"];
const GENEROS = ["Mujer", "Hombre", "Infantil", "Unisex"];

function PhotoCell({ item, onZoom }) {
  const [index, setIndex] = useState(0);
  const photos = item.photos || [];
  if (photos.length === 0) {
    return <div className="w-14 h-14 rounded-lg bg-slate-100 flex items-center justify-center text-slate-300 text-xs">Sin foto</div>;
  }
  return (
    <div className="relative w-14 h-14 flex-shrink-0">
      <img
        src={photos[index]}
        alt={item.referencia}
        onClick={() => onZoom({ photo: photos[index], name: item.referencia })}
        className="w-14 h-14 print:w-28 print:h-28 rounded-lg object-cover cursor-zoom-in hover:opacity-80"
      />
      {photos.length > 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIndex((i) => (i + 1) % photos.length);
          }}
          className="print:hidden absolute -bottom-1 -right-1 bg-brand-700 text-white text-[9px] font-bold rounded-full w-5 h-5 flex items-center justify-center"
          title="Ver siguiente foto"
        >
          {index + 1}/{photos.length}
        </button>
      )}
    </div>
  );
}

export default function PurchaseOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importWarnings, setImportWarnings] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [zoomItem, setZoomItem] = useState(null);
  const [ratesOpen, setRatesOpen] = useState(false);
  const fileInputRef = useRef(null);

  const load = () => {
    getPurchaseOrder(id)
      .then((o) => {
        setOrder(o);
        setLoading(false);
      })
      .catch(() => {
        setNotFound(true);
        setLoading(false);
      });
  };

  useEffect(load, [id]);

  if (loading) {
    return (
      <div>
        <Navbar />
        <p className="text-center text-slate-400 mt-10">Cargando...</p>
      </div>
    );
  }

  if (notFound || !order) {
    return (
      <div>
        <Navbar />
        <div className="max-w-5xl mx-auto px-4 py-6">
          <p className="text-slate-500">Pedido no encontrado.</p>
          <Link to="/admin/pedidos" className="text-brand-600 text-sm">
            ← Volver a pedidos
          </Link>
        </div>
      </div>
    );
  }

  const { items, totales } = computeOrderSummary(order);

  const patchOrderField = async (patch) => {
    setOrder((prev) => ({ ...prev, ...patch }));
    await updatePurchaseOrder(id, patch);
  };

  const patchCategoryRate = async (categoria, value) => {
    const nextRates = { ...order.categoryFreightRates, [categoria]: Number(value) || 0 };
    setOrder((prev) => ({ ...prev, categoryFreightRates: nextRates }));
    await updatePurchaseOrder(id, { categoryFreightRates: nextRates });
  };

  const patchItemLocal = (itemId, patch) => {
    setOrder((prev) => ({
      ...prev,
      items: prev.items.map((it) => (it.id === itemId ? { ...it, ...patch } : it)),
    }));
  };

  const saveItem = async (itemId, patch) => {
    await updatePurchaseOrderItem(id, itemId, patch);
  };

  const handleDeleteItem = async (itemId, referencia) => {
    if (!confirm(`¿Quitar "${referencia}" de este pedido?`)) return;
    setOrder((prev) => ({ ...prev, items: prev.items.filter((it) => it.id !== itemId) }));
    await deletePurchaseOrderItem(id, itemId);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImportText(String(reader.result || ""));
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!importText.trim()) return;
    setImporting(true);
    setImportWarnings([]);
    try {
      const updated = await importPurchaseOrderText(id, importText);
      setOrder(updated);
      setImportWarnings(updated.importWarnings || []);
      setImportText("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (!updated.importWarnings || updated.importWarnings.length === 0) setImportOpen(false);
    } catch (err) {
      setImportWarnings([err.response?.data?.error || "Error importando el archivo."]);
    } finally {
      setImporting(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg("");
    try {
      const result = await syncPurchaseOrder(id);
      setSyncMsg(result.ok ? "✅ Sincronizado con Google Sheets." : `❌ ${result.error}`);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div>
      <div className="print:hidden">
        <Navbar />
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
          <Link to="/admin/pedidos" className="text-sm text-slate-400 print:hidden">
            ← Pedidos
          </Link>
        </div>
        <h1 className="text-lg font-bold text-slate-800 mb-4">{order.name}</h1>

        {/* Resumen consolidado */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
          <SummaryCard label="Productos" value={totales.totalProductos} />
          <SummaryCard label="Unidades" value={totales.totalUnidades} />
          <SummaryCard label="Cajas" value={totales.totalCajas} />
          <SummaryCard label="Inversión FOB" value={formatUSD(totales.totalFOB_USD)} />
          <SummaryCard label="Landed Colombia" value={formatCOP(totales.totalLandedCOP)} highlight />
        </div>

        {/* Tasas y flete por categoría */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 mb-4 print:hidden">
          <button
            onClick={() => setRatesOpen((v) => !v)}
            className="text-sm font-medium text-slate-700 flex items-center gap-1"
          >
            ⚙️ Tasas de conversión y flete {ratesOpen ? "▲" : "▼"}
          </button>
          {ratesOpen && (
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
              <RateInput
                label="Tasa RMB → USD"
                value={order.tasaRMBaUSD}
                onCommit={(v) => patchOrderField({ tasaRMBaUSD: Number(v) || 0 })}
              />
              <RateInput
                label="TRM (USD → COP)"
                value={order.trmUSDaCOP}
                onCommit={(v) => patchOrderField({ trmUSDaCOP: Number(v) || 0 })}
              />
              <div />
              {CATEGORIAS.map((cat) => (
                <RateInput
                  key={cat}
                  label={`Flete ${cat} (COP/unidad)`}
                  value={order.categoryFreightRates?.[cat] ?? 0}
                  onCommit={(v) => patchCategoryRate(cat, v)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Acciones */}
        <div className="flex flex-wrap gap-2 mb-4 print:hidden">
          <button
            onClick={() => setImportOpen((v) => !v)}
            className="text-sm bg-brand-600 text-white rounded-lg px-3 py-1.5"
          >
            📥 Importar CSV/TXT
          </button>
          <button
            onClick={() => downloadPurchaseOrderCsv(id, `pedido_${order.name}.csv`)}
            className="text-sm border border-slate-300 rounded-lg px-3 py-1.5"
          >
            Descargar CSV
          </button>
          <button onClick={() => window.print()} className="text-sm border border-slate-300 rounded-lg px-3 py-1.5">
            🖨️ Exportar / Imprimir
          </button>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 disabled:opacity-60"
          >
            {syncing ? "Sincronizando..." : "Sincronizar con Sheets"}
          </button>
          {syncMsg && <span className="text-xs text-slate-500 self-center">{syncMsg}</span>}
        </div>

        {importOpen && (
          <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4 print:hidden">
            <p className="text-sm font-medium text-slate-700 mb-1">Importar productos</p>
            <p className="text-xs text-slate-500 mb-2">
              Columnas: <code>URL_Producto, URL_Imagen, Referencia</code> — una fila por imagen; si un producto tiene
              varias fotos, repite la misma URL de producto en varias filas. Acepta CSV (comas) o TXT (tabs), con o
              sin encabezado.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              onChange={handleFileChange}
              className="text-sm mb-2"
            />
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              rows={6}
              placeholder="O pega aquí el contenido del archivo..."
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono mb-2"
            />
            {importWarnings.length > 0 && (
              <ul className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2 mb-2 space-y-0.5">
                {importWarnings.map((w, i) => (
                  <li key={i}>⚠️ {w}</li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleImport}
                disabled={importing || !importText.trim()}
                className="bg-brand-600 text-white rounded-lg px-4 py-1.5 text-sm font-medium disabled:opacity-60"
              >
                {importing ? "Importando y descargando fotos..." : "Importar"}
              </button>
              <button
                onClick={() => setImportOpen(false)}
                className="border border-slate-300 rounded-lg px-4 py-1.5 text-sm"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}

        {items.length === 0 && (
          <div className="bg-white border border-dashed border-slate-300 rounded-xl p-10 text-center text-slate-500">
            Todavía no importas ningún producto. Usa "Importar CSV/TXT" arriba.
          </div>
        )}

        {items.length > 0 && (
          <div className="overflow-x-auto bg-white border border-slate-200 rounded-xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th className="p-2">Foto</th>
                  <th className="p-2 min-w-[160px]">Referencia</th>
                  <th className="p-2 print:hidden">Categoría</th>
                  <th className="p-2 print:hidden">Género</th>
                  <th className="p-2 w-24">Costo RMB</th>
                  <th className="p-2 w-20">x Empaque</th>
                  <th className="p-2 w-20"># Empaques</th>
                  <th className="p-2 text-right">Cant. Total</th>
                  <th className="p-2 text-right">FOB Total</th>
                  <th className="p-2 text-right">Landed COP</th>
                  <th className="p-2 print:hidden"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100 align-middle">
                    <td className="p-2">
                      <PhotoCell item={item} onZoom={setZoomItem} />
                    </td>
                    <td className="p-2">
                      <input
                        defaultValue={item.referencia}
                        onBlur={(e) => {
                          patchItemLocal(item.id, { referencia: e.target.value });
                          saveItem(item.id, { referencia: e.target.value });
                        }}
                        className="w-full border border-slate-200 rounded px-1.5 py-1 text-sm mb-1"
                      />
                      {item.productUrl && (
                        <a
                          href={item.productUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-brand-600 underline print:hidden"
                        >
                          🔗 ver producto
                        </a>
                      )}
                      {item.curationMeta && (
                        <p
                          className="text-[10px] text-amber-700 bg-amber-50 rounded px-1.5 py-0.5 mt-1 inline-block"
                          title={`De la curaduría "${item.curationMeta.surveyName}"`}
                        >
                          📊 {item.curationMeta.surveyName} · {item.curationMeta.pctPonderado}% peso ·{" "}
                          {item.curationMeta.votos} voto(s)
                        </p>
                      )}
                    </td>
                    <td className="p-2 print:hidden">
                      <select
                        value={item.categoria || ""}
                        onChange={(e) => {
                          patchItemLocal(item.id, { categoria: e.target.value });
                          saveItem(item.id, { categoria: e.target.value });
                        }}
                        className="border border-slate-200 rounded px-1 py-1 text-xs w-full"
                      >
                        <option value="">—</option>
                        {CATEGORIAS.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2 print:hidden">
                      <select
                        value={item.genero || ""}
                        onChange={(e) => {
                          patchItemLocal(item.id, { genero: e.target.value });
                          saveItem(item.id, { genero: e.target.value });
                        }}
                        className="border border-slate-200 rounded px-1 py-1 text-xs w-full"
                      >
                        <option value="">—</option>
                        {GENEROS.map((g) => (
                          <option key={g} value={g}>
                            {g}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2">
                      <NumberCell
                        value={item.costoUnitarioRMB}
                        onCommit={(v) => {
                          patchItemLocal(item.id, { costoUnitarioRMB: v });
                          saveItem(item.id, { costoUnitarioRMB: v });
                        }}
                      />
                    </td>
                    <td className="p-2">
                      <NumberCell
                        value={item.cantidadPorEmpaque}
                        onCommit={(v) => {
                          patchItemLocal(item.id, { cantidadPorEmpaque: v });
                          saveItem(item.id, { cantidadPorEmpaque: v });
                        }}
                      />
                    </td>
                    <td className="p-2">
                      <NumberCell
                        value={item.cantidadEmpaques}
                        onCommit={(v) => {
                          patchItemLocal(item.id, { cantidadEmpaques: v });
                          saveItem(item.id, { cantidadEmpaques: v });
                        }}
                      />
                    </td>
                    <td className="p-2 text-right font-medium">{item.cantidadTotal}</td>
                    <td className="p-2 text-right">{formatUSD(item.precioTotalFOB_USD)}</td>
                    <td className="p-2 text-right font-semibold text-brand-700">{formatCOP(item.costoLandedTotalCOP)}</td>
                    <td className="p-2 print:hidden">
                      <button
                        onClick={() => handleDeleteItem(item.id, item.referencia)}
                        className="text-red-400 hover:text-red-600 text-xs"
                        title="Quitar producto"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ZoomModal photo={zoomItem?.photo} name={zoomItem?.name} onClose={() => setZoomItem(null)} />
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

function RateInput({ label, value, onCommit }) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  return (
    <div>
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      <input
        type="number"
        step="any"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => onCommit(local)}
        className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
      />
    </div>
  );
}

function NumberCell({ value, onCommit }) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  return (
    <input
      type="number"
      step="any"
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => onCommit(Number(local) || 0)}
      className="w-20 border border-slate-200 rounded px-1.5 py-1 text-sm print:border-none"
    />
  );
}
