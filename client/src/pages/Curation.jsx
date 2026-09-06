import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getCurationSurvey, submitCurationResponse } from "../api.js";
import CurationCard from "../components/CurationCard.jsx";
import ZoomModal from "../components/ZoomModal.jsx";
import RankedList from "../components/RankedList.jsx";

export default function Curation() {
  const { surveyId } = useParams();
  const navigate = useNavigate();
  const [survey, setSurvey] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [selected, setSelected] = useState([]); // orden de clic = ranking: [0] es el favorito absoluto
  const [zoomItem, setZoomItem] = useState(null);
  const [step, setStep] = useState("intro"); // intro | grid | confirm
  const [evaluador, setEvaluador] = useState("");
  const [comentarios, setComentarios] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Ref (no state) para bloquear un doble-tap al instante: en mobile, dos taps
  // muy rápidos en "Enviar selección" pueden disparar el submit dos veces
  // antes de que React vuelva a renderizar el botón con disabled=true.
  const submittingRef = useRef(false);

  useEffect(() => {
    getCurationSurvey(surveyId)
      .then(setSurvey)
      .catch(() => setNotFound(true));
  }, [surveyId]);

  const count = survey?.selectionRule?.count || 0;
  const mode = survey?.selectionRule?.mode || "exact";
  const limitReached = selected.length >= count;
  const quotaMet = selected.length === count;

  const rankOf = (id) => {
    const i = selected.indexOf(id);
    return i === -1 ? null : i + 1;
  };

  const toggle = (id) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id); // al desmarcar, los siguientes suben de puesto solos
      if (prev.length >= count) return prev; // límite alcanzado, no permite marcar más
      return [...prev, id]; // se agrega al final: el clic número K es el puesto #K
    });
  };

  const selectedItemsInOrder = useMemo(
    () => (survey ? selected.map((id) => survey.items.find((i) => i.id === id)).filter(Boolean) : []),
    [survey, selected]
  );

  const goToConfirm = () => {
    if (!quotaMet) return;
    setStep("confirm");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleFinalSubmit = async (e) => {
    e.preventDefault();
    if (submittingRef.current) return; // bloquea doble-tap al instante
    setError("");
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await submitCurationResponse({
        surveyId,
        evaluador,
        selectedProductIds: selected,
        comentarios,
      });
      navigate(`/curacion/${surveyId}/gracias`);
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo enviar tu selección. Intenta de nuevo.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 text-center">
        <p className="text-slate-500">Esta curaduría ya no está disponible.</p>
      </div>
    );
  }

  if (!survey) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-400">Cargando...</p>
      </div>
    );
  }

  if (step === "intro") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
        <div className="max-w-md w-full">
          <p className="text-xs uppercase tracking-wide text-brand-600 font-semibold mb-1">{survey.category}</p>
          <h1 className="text-xl font-bold text-slate-800 mb-3">{survey.name}</h1>

          {survey.instructions && (
            <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 mb-4">
              <p className="text-amber-900 font-bold text-sm">📋 {survey.instructions}</p>
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4">
            <p className="text-sm text-slate-600">
              Vas a ver <b>{survey.items.length} productos</b>. Tu tarea: haz clic en tus{" "}
              <b>{count} favoritos, en orden</b> — el primero que marques será tu <b>#1 (el que más te gusta)</b>, y
              así hasta el último. Cada foto va a mostrar el número de puesto que le diste.
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              setStep("grid");
            }}
            className="bg-white border border-slate-200 rounded-xl p-4"
          >
            <label className="block text-sm font-medium text-slate-700 mb-1">Tu nombre</label>
            <p className="text-xs text-slate-500 mb-2">Opcional — puedes dejarlo en blanco</p>
            <input
              value={evaluador}
              onChange={(e) => setEvaluador(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 mb-4"
              placeholder="Anónimo"
              autoFocus
            />
            <button type="submit" className="w-full bg-brand-600 text-white rounded-lg py-3 font-semibold">
              Comenzar
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (step === "confirm") {
    return (
      <div className="min-h-screen bg-slate-50 pb-10">
        <div className="max-w-md mx-auto px-4 pt-6">
          <p className="text-xs uppercase tracking-wide text-brand-600 font-semibold mb-1">{survey.category}</p>
          <h1 className="text-xl font-bold text-slate-800 mb-1">{survey.name}</h1>
          <p className="text-slate-500 mb-1">
            Este es tu orden de preferencia: #1 es tu favorito absoluto, #{count} el que menos te convenció de tu
            selección.
          </p>
          <p className="text-xs text-slate-400 mb-4">
            ¿Te equivocaste de orden? Arrastra una foto con el ⠿ para subirla o bajarla.
          </p>

          <RankedList items={selectedItemsInOrder} onReorder={(newIds) => setSelected(newIds)} />

          <form onSubmit={handleFinalSubmit} className="space-y-4">
            <div>
              <p className="font-medium text-slate-800">Comentarios</p>
              <p className="text-sm text-slate-500 mb-2">¿Por qué descartaste los demás? (opcional)</p>
              <textarea
                value={comentarios}
                onChange={(e) => setComentarios(e.target.value)}
                rows={3}
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
              />
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep("grid")}
                className="flex-1 border border-slate-300 rounded-lg py-3 font-medium"
              >
                Volver
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-[2] bg-brand-600 text-white rounded-lg py-3 font-semibold disabled:opacity-60"
              >
                {submitting ? "Enviando..." : "Enviar selección"}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-brand-600 font-semibold">{survey.category}</p>
          <div className="flex items-center justify-between gap-3">
            <h1 className="font-bold text-slate-800 leading-tight">{survey.name}</h1>
            <span
              className={`whitespace-nowrap text-sm font-bold px-3 py-1 rounded-full ${
                quotaMet ? "bg-green-100 text-green-700" : "bg-brand-50 text-brand-700"
              }`}
            >
              Seleccionados: {selected.length} / {count}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {mode === "exact" ? `Elige exactamente ${count} productos, ` : `Elige hasta ${count} productos, `}
            en orden: el primer clic es tu #1 favorito.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 pt-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {survey.items.map((item) => (
            <CurationCard
              key={item.id}
              item={item}
              rank={rankOf(item.id)}
              disabled={!selected.includes(item.id) && limitReached}
              onToggle={toggle}
              onZoom={setZoomItem}
            />
          ))}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-3">
        <div className="max-w-3xl mx-auto">
          <button
            onClick={goToConfirm}
            disabled={!quotaMet}
            className="w-full bg-brand-600 text-white rounded-lg py-3 font-semibold disabled:opacity-40 disabled:bg-slate-400"
          >
            {quotaMet ? "Ver mi orden y enviar" : `Selecciona ${count - selected.length} más para continuar`}
          </button>
        </div>
      </div>

      <ZoomModal photo={zoomItem?.photo} name={zoomItem?.name} onClose={() => setZoomItem(null)} />
    </div>
  );
}
