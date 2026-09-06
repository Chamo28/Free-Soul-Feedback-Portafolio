import { Link } from "react-router-dom";
import { useState } from "react";
import { deleteProduct, updateProduct } from "../api.js";

export default function ProductCard({ product, onDeleted }) {
  const [copied, setCopied] = useState(false);
  const [editingInstructions, setEditingInstructions] = useState(false);
  const [instructions, setInstructions] = useState(product.instructions || "");
  const [saving, setSaving] = useState(false);
  const surveyPath = `/survey/${product.id}`;

  const copyLink = async () => {
    const url = `${window.location.origin}${surveyPath}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("Copia el link:", url);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`¿Eliminar "${product.name}"? Esto no borra respuestas ya guardadas.`)) return;
    await deleteProduct(product.id);
    onDeleted?.(product.id);
  };

  const saveInstructions = async () => {
    setSaving(true);
    try {
      await updateProduct(product.id, { instructions });
      product.instructions = instructions;
      setEditingInstructions(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
      <div className="aspect-square bg-slate-100">
        {product.photos?.[0] && (
          <img src={product.photos[0]} alt={product.name} className="w-full h-full object-cover" />
        )}
      </div>
      <div className="p-3 flex flex-col gap-2 flex-1">
        <div>
          <p className="font-semibold text-slate-800 leading-tight">{product.name}</p>
          <p className="text-xs text-slate-500">{product.category}</p>
        </div>

        {editingInstructions ? (
          <div className="border border-amber-300 bg-amber-50 rounded-lg p-2">
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={2}
              className="w-full text-xs border border-amber-300 rounded px-2 py-1"
              placeholder="Instrucciones para el evaluador..."
              autoFocus
            />
            <div className="flex gap-1.5 mt-1.5">
              <button
                onClick={saveInstructions}
                disabled={saving}
                className="flex-1 bg-brand-600 text-white text-xs font-medium rounded py-1 disabled:opacity-60"
              >
                {saving ? "Guardando..." : "Guardar"}
              </button>
              <button
                onClick={() => {
                  setInstructions(product.instructions || "");
                  setEditingInstructions(false);
                }}
                className="px-2 text-xs border border-slate-300 rounded"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : product.instructions ? (
          <button
            onClick={() => setEditingInstructions(true)}
            className="text-left text-xs bg-amber-50 border border-amber-200 rounded-lg p-2 text-amber-800"
          >
            <span className="font-bold">📋 Instrucciones: </span>
            {product.instructions}
          </button>
        ) : (
          <button
            onClick={() => setEditingInstructions(true)}
            className="text-xs text-slate-500 border border-dashed border-slate-300 rounded-lg py-1.5"
          >
            + Agregar instrucciones para el evaluador
          </button>
        )}

        <div className="mt-auto flex flex-col gap-1.5">
          <button
            onClick={copyLink}
            className="text-sm bg-brand-50 text-brand-700 rounded-lg py-1.5 font-medium"
          >
            {copied ? "¡Copiado!" : "Copiar link evaluador"}
          </button>
          <div className="flex gap-1.5">
            <Link
              to={surveyPath}
              target="_blank"
              className="flex-1 text-center text-sm border border-slate-200 rounded-lg py-1.5 text-slate-600"
            >
              Ver encuesta
            </Link>
            <button
              onClick={handleDelete}
              className="px-3 text-sm border border-red-200 text-red-500 rounded-lg py-1.5"
            >
              Borrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
