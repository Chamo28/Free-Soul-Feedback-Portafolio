import { Link } from "react-router-dom";
import { useState } from "react";
import { deleteCurationSurvey, updateCurationSurvey } from "../api.js";
import { useBrand } from "../BrandContext.jsx";

export default function CurationSurveyCard({ survey, onDeleted }) {
  const brand = useBrand();
  const [copied, setCopied] = useState(false);
  const [editingInstructions, setEditingInstructions] = useState(false);
  const [instructions, setInstructions] = useState(survey.instructions || "");
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(survey.name);
  const [saving, setSaving] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const surveyPath = `/curacion/${survey.id}`;
  const { mode, count } = survey.selectionRule;

  const saveInstructions = async () => {
    setSaving(true);
    try {
      await updateCurationSurvey(survey.id, { instructions });
      survey.instructions = instructions; // refleja de inmediato sin recargar
      setEditingInstructions(false);
    } finally {
      setSaving(false);
    }
  };

  const saveName = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSavingName(true);
    try {
      await updateCurationSurvey(survey.id, { name: trimmed });
      survey.name = trimmed;
      setName(trimmed);
      setEditingName(false);
    } finally {
      setSavingName(false);
    }
  };

  const copyLink = async () => {
    const url = `${window.location.origin}${brand.pathPrefix}${surveyPath}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("Copia el link:", url);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`¿Eliminar "${survey.name}"? Esto no borra respuestas ya guardadas.`)) return;
    await deleteCurationSurvey(survey.id);
    onDeleted?.(survey.id);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
      <div className="grid grid-cols-4 gap-0.5 bg-slate-100 aspect-[4/2]">
        {survey.items.slice(0, 8).map((item) => (
          <img key={item.id} src={item.photo} alt={item.name} className="w-full h-full object-cover" />
        ))}
      </div>
      <div className="p-3 flex flex-col gap-2 flex-1">
        <div>
          {editingName ? (
            <div className="flex gap-1.5 mb-0.5">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveName();
                  if (e.key === "Escape") {
                    setName(survey.name);
                    setEditingName(false);
                  }
                }}
                className="flex-1 text-sm font-semibold border border-brand-300 rounded px-2 py-1"
                autoFocus
              />
              <button
                onClick={saveName}
                disabled={savingName}
                className="text-xs bg-brand-600 text-white px-2 rounded disabled:opacity-60"
              >
                ✓
              </button>
              <button
                onClick={() => {
                  setName(survey.name);
                  setEditingName(false);
                }}
                className="text-xs border border-slate-300 px-2 rounded"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditingName(true)}
              className="group flex items-center gap-1.5 text-left"
            >
              <p className="font-semibold text-slate-800 leading-tight">{survey.name}</p>
              <span className="text-slate-400 text-xs opacity-0 group-hover:opacity-100">✏️</span>
            </button>
          )}
          <p className="text-xs text-slate-500">
            {survey.category} · {survey.items.length} productos · {mode === "exact" ? "exactamente" : "máximo"} {count}
          </p>
          {survey.status && survey.status !== "activa" && (
            <span
              className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                survey.status === "inactiva" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
              }`}
            >
              {survey.status === "inactiva" ? "Inactiva" : "Borrador"}
            </span>
          )}
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
                  setInstructions(survey.instructions || "");
                  setEditingInstructions(false);
                }}
                className="px-2 text-xs border border-slate-300 rounded"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : survey.instructions ? (
          <button
            onClick={() => setEditingInstructions(true)}
            className="text-left text-xs bg-amber-50 border border-amber-200 rounded-lg p-2 text-amber-800"
          >
            <span className="font-bold">📋 Instrucciones: </span>
            {survey.instructions}
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
              to={`/admin/curaduria/${survey.id}/editar`}
              className="flex-1 text-center text-sm border border-slate-200 rounded-lg py-1.5 text-slate-600"
            >
              ✏️ Editar
            </Link>
            <Link
              to={surveyPath}
              target="_blank"
              className="flex-1 text-center text-sm border border-slate-200 rounded-lg py-1.5 text-slate-600"
            >
              Ver dinámica
            </Link>
            <Link
              to={`/admin/results?curaduria=${survey.id}`}
              className="flex-1 text-center text-sm border border-slate-200 rounded-lg py-1.5 text-slate-600"
            >
              Resultados
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
