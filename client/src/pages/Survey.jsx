import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getProduct, submitResponse } from "../api.js";
import PhotoCarousel from "../components/PhotoCarousel.jsx";
import ScoreInput from "../components/ScoreInput.jsx";

export default function Survey() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [evaluador, setEvaluador] = useState("");
  const [atractivo, setAtractivo] = useState(null);
  const [calidad, setCalidad] = useState(null);
  const [precio, setPrecio] = useState(null);
  const [compraria, setCompraria] = useState(null);
  const [comentarios, setComentarios] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Ref (no state) para bloquear un doble-tap al instante: en mobile, dos taps
  // muy rápidos pueden disparar el submit dos veces antes de que React
  // vuelva a renderizar el botón con disabled=true.
  const submittingRef = useRef(false);

  useEffect(() => {
    getProduct(productId)
      .then(setProduct)
      .catch(() => setNotFound(true));
  }, [productId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submittingRef.current) return; // bloquea doble-tap al instante
    setError("");
    if (!atractivo || !calidad || !precio || compraria === null) {
      setError("Por favor responde todas las preguntas antes de enviar.");
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await submitResponse({
        productId,
        evaluador,
        atractivo,
        calidad,
        precio,
        compraria,
        comentarios,
      });
      navigate(`/survey/${productId}/gracias`);
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo enviar tu respuesta. Intenta de nuevo.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 text-center">
        <p className="text-slate-500">Esta encuesta ya no está disponible.</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-400">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      <div className="max-w-md mx-auto px-4 pt-6">
        <img src="/icon-512.png" alt="Free Soul DNA" className="h-10 w-10 rounded-xl mb-3" />
        <p className="text-xs uppercase tracking-wide text-brand-600 font-semibold mb-1">{product.category}</p>
        <h1 className="text-xl font-display font-bold text-slate-800 mb-4">{product.name}</h1>

        {product.instructions && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 mb-4">
            <p className="text-amber-900 font-bold text-sm">📋 {product.instructions}</p>
          </div>
        )}

        <PhotoCarousel photos={product.photos} />

        <form onSubmit={handleSubmit} className="mt-6 space-y-1">
          <ScoreInput
            label="Atractivo visual"
            hint="¿Qué tan atractivo es el diseño?"
            value={atractivo}
            onChange={setAtractivo}
          />
          <ScoreInput
            label="Calidad percibida"
            hint="¿Sientes que la calidad es buena?"
            value={calidad}
            onChange={setCalidad}
          />
          <ScoreInput
            label="Precio justo"
            hint="¿El precio es justo para lo que ves?"
            value={precio}
            onChange={setPrecio}
          />

          <div className="mb-5">
            <p className="font-medium text-slate-800">¿Lo comprarías?</p>
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={() => setCompraria(true)}
                className={`flex-1 py-2 rounded-lg border font-medium ${
                  compraria === true ? "bg-green-600 border-green-600 text-white" : "bg-white border-slate-300"
                }`}
              >
                Sí
              </button>
              <button
                type="button"
                onClick={() => setCompraria(false)}
                className={`flex-1 py-2 rounded-lg border font-medium ${
                  compraria === false ? "bg-red-500 border-red-500 text-white" : "bg-white border-slate-300"
                }`}
              >
                No
              </button>
            </div>
          </div>

          <div className="mb-5">
            <p className="font-medium text-slate-800">Comentarios</p>
            <p className="text-sm text-slate-500 mb-2">¿Qué cambiarías o qué te gusta?</p>
            <textarea
              value={comentarios}
              onChange={(e) => setComentarios(e.target.value)}
              rows={3}
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
              placeholder="Opcional"
            />
          </div>

          <div className="mb-5">
            <p className="font-medium text-slate-800">Tu nombre</p>
            <p className="text-sm text-slate-500 mb-2">Opcional — puedes dejarlo en blanco</p>
            <input
              value={evaluador}
              onChange={(e) => setEvaluador(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
              placeholder="Anónimo"
            />
          </div>

          {error && <p className="text-sm text-red-500 mb-3">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-brand-600 text-white rounded-lg py-3 font-semibold disabled:opacity-60"
          >
            {submitting ? "Enviando..." : "Enviar mi opinión"}
          </button>
        </form>
      </div>
    </div>
  );
}
