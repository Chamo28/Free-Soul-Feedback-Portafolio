import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getCategories, createProduct } from "../api.js";
import { compressImageFiles } from "../utils/compressImage.js";
import Navbar from "../components/Navbar.jsx";

export default function ProductForm() {
  const [categories, setCategories] = useState([]);
  const [name, setName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [category, setCategory] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [files, setFiles] = useState([]);
  const [compressing, setCompressing] = useState(false);
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
    const selected = Array.from(e.target.files).slice(0, 7);
    setCompressing(true);
    try {
      const compressed = await compressImageFiles(selected);
      setFiles(compressed);
    } finally {
      setCompressing(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const finalCategory = category === "__custom__" ? customCategory.trim() : category;
    if (!name.trim() || !finalCategory) {
      setError("Completa el nombre y la categoría.");
      return;
    }
    if (files.length === 0) {
      setError("Sube al menos 1 foto (ideal 6-7).");
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("name", name.trim());
      fd.append("category", finalCategory);
      fd.append("instructions", instructions.trim());
      files.forEach((f) => fd.append("photos", f));
      const product = await createProduct(fd);
      setCreatedLink(`${window.location.origin}/survey/${product.id}`);
    } catch (err) {
      setError(err.response?.data?.error || "Error subiendo el producto.");
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
          <h1 className="text-lg font-bold text-slate-800 mb-1">Producto creado</h1>
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
              onClick={() => navigate("/admin/curaduria")}
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
      <div className="max-w-md mx-auto px-4 py-6">
        <h1 className="text-lg font-bold text-slate-800 mb-4">Nuevo producto</h1>
        <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del producto</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
              placeholder="Ej: Sneaker blanco modelo A"
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
              placeholder="Ej: Fíjate bien en el acabado de las costuras antes de calificar calidad."
            />
            <p className="text-xs text-slate-500 mt-1">
              Opcional. Se muestra resaltado arriba de las fotos cuando el evaluador abre el link.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Fotos (6-7 recomendado)</label>
            <input type="file" accept="image/*" multiple onChange={handleFiles} className="w-full text-sm" />
            {compressing && <p className="text-xs text-slate-500 mt-1">Comprimiendo fotos...</p>}
            {!compressing && files.length > 0 && (
              <div className="grid grid-cols-4 gap-2 mt-2">
                {files.map((f, i) => (
                  <img
                    key={i}
                    src={URL.createObjectURL(f)}
                    alt={`preview-${i}`}
                    className="aspect-square object-cover rounded-lg"
                  />
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
            {submitting ? "Subiendo..." : "Crear producto y generar link"}
          </button>
        </form>
      </div>
    </div>
  );
}
