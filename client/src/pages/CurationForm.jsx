import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getCategories, createCurationSurvey } from "../api.js";
import { compressImageFiles } from "../utils/compressImage.js";
import Navbar from "../components/Navbar.jsx";

export default function CurationForm() {
  const [categories, setCategories] = useState([]);
  const [name, setName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [category, setCategory] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [selectionMode, setSelectionMode] = useState("exact");
  const [selectionCount, setSelectionCount] = useState(10);
  const [files, setFiles] = useState([]);
  const [compressing, setCompressing] = useState(false);
  const [itemNames, setItemNames] = useState([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [createdLink, setCreatedLink] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    getCategories().then((cats) => {
      setCategories(cats);
      setCategory(cats[0] || "");
    });
  }, []);

  const handleFiles = async (e) => {
    const selected = Array.from(e.target.files).slice(0, 40);
    setCompressing(true);
    try {
      const compressed = await compressImageFiles(selected);
      setFiles(compressed);
      setItemNames(compressed.map((f, i) => `Producto ${i + 1}`));
    } finally {
      setCompressing(false);
    }
  };

  const updateItemName = (i, value) => {
    setItemNames((prev) => prev.map((n, idx) => (idx === i ? value : n)));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const finalCategory = category === "__custom__" ? customCategory.trim() : category;
    if (!name.trim() || !finalCategory) {
      setError("Completa el nombre de la dinámica y la categoría.");
      return;
    }
    if (files.length < 2) {
      setError("Sube al menos 2 productos (ideal 15).");
      return;
    }
    const count = Number(selectionCount);
    if (!Number.isInteger(count) || count < 1) {
      setError("La cantidad a seleccionar debe ser un número entero mayor a 0.");
      return;
    }
    if (selectionMode === "exact" && count > files.length) {
      setError(`No puedes pedir seleccionar ${count} si solo subiste ${files.length} productos.`);
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("name", name.trim());
      fd.append("category", finalCategory);
      fd.append("instructions", instructions.trim());
      fd.append("selectionMode", selectionMode);
      fd.append("selectionCount", String(count));
      fd.append("names", JSON.stringify(itemNames));
      files.forEach((f) => fd.append("photos", f));
      const survey = await createCurationSurvey(fd);
      setCreatedLink(`${window.location.origin}/curacion/${survey.id}`);
    } catch (err) {
      setError(err.response?.data?.error || "Error creando la curaduría.");
    } finally {
      setSubmitting(false);
    }
  };

  if (createdLink) {
    return (
      <div>
        <Navbar />
        <div className="max-w-md mx-auto px-4 py-10 text-center">
          <div className="text-4xl mb-3">✅</div>
          <h1 className="text-lg font-bold text-slate-800 mb-1">Curaduría creada</h1>
          <p className="text-slate-500 mb-4">Comparte este link con tus evaluadores:</p>
          <div className="bg-white border border-slate-200 rounded-lg p-3 text-sm break-all mb-4">
            {createdLink}
          </div>
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => navigator.clipboard.writeText(createdLink)}
              className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              Copiar link
            </button>
            <button
              onClick={() => navigate("/admin")}
              className="border border-slate-300 px-4 py-2 rounded-lg text-sm font-medium"
            >
              Volver a productos
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-6">
        <h1 className="text-lg font-bold text-slate-800 mb-1">Nueva Curaduría de Portafolio</h1>
        <p className="text-sm text-slate-500 mb-4">
          Selección Top-K: el evaluador elige sus N favoritos de todo el conjunto que subas.
        </p>

        <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nombre de la dinámica</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
              placeholder="Ej: Colección Otoño 2026 - Calzado"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Categoría</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              <option value="__custom__">+ Nueva categoría...</option>
            </select>
            {category === "__custom__" && (
              <input
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 mt-2"
                placeholder="Ej: Bolsos"
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Instrucciones para el evaluador</label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={3}
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
              placeholder="Ej: Elige tus 10 favoritos pensando en cuáles se venderían mejor en tienda, no solo en cuáles te gustan más a ti."
            />
            <p className="text-xs text-slate-500 mt-1">
              Opcional. Se muestra resaltado arriba de las fotos cuando el evaluador abre el link.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Regla de selección</label>
              <select
                value={selectionMode}
                onChange={(e) => setSelectionMode(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
              >
                <option value="exact">Selecciona exactamente</option>
                <option value="max">Selecciona máximo</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Cantidad (X)</label>
              <input
                type="number"
                min={1}
                value={selectionCount}
                onChange={(e) => setSelectionCount(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
              />
            </div>
          </div>
          <p className="text-xs text-slate-500 -mt-2">
            Por defecto: 10 de 15. El evaluador deberá elegir {selectionCount || "X"} producto(s) para poder enviar.
          </p>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Fotos del portafolio (ideal 15)</label>
            <input type="file" accept="image/*" multiple onChange={handleFiles} className="w-full text-sm" />
            {compressing && <p className="text-xs text-slate-500 mt-1">Comprimiendo fotos...</p>}

            {!compressing && files.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mt-3">
                {files.map((f, i) => (
                  <div key={i}>
                    <img
                      src={URL.createObjectURL(f)}
                      alt={`preview-${i}`}
                      className="aspect-square object-cover rounded-lg mb-1"
                    />
                    <input
                      value={itemNames[i] || ""}
                      onChange={(e) => updateItemName(i, e.target.value)}
                      className="w-full border border-slate-300 rounded px-1.5 py-1 text-xs"
                      placeholder={`Producto ${i + 1}`}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={submitting || compressing}
            className="w-full bg-brand-600 text-white rounded-lg py-2 font-medium disabled:opacity-60"
          >
            {submitting ? "Creando..." : "Crear curaduría y generar link"}
          </button>
        </form>
      </div>
    </div>
  );
}
