import { useEffect } from "react";

export default function ZoomModal({ photo, name, onClose }) {
  useEffect(() => {
    if (!photo) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [photo, onClose]);

  if (!photo) return null;
  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
        <img src={photo} alt={name} className="w-full rounded-xl object-contain max-h-[80vh] mx-auto" />
        <div className="flex items-center justify-between mt-3">
          <p className="text-white font-medium">{name}</p>
          <button
            onClick={onClose}
            className="bg-white/90 text-slate-800 text-sm font-medium px-3 py-1.5 rounded-lg"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
