import { useState } from "react";

export default function PhotoCarousel({ photos = [] }) {
  const [index, setIndex] = useState(0);

  if (photos.length === 0) {
    return (
      <div className="aspect-square w-full bg-slate-200 rounded-xl flex items-center justify-center text-slate-400">
        Sin fotos
      </div>
    );
  }

  const go = (delta) => {
    setIndex((i) => (i + delta + photos.length) % photos.length);
  };

  return (
    <div className="w-full select-none">
      <div className="relative aspect-square w-full bg-slate-100 rounded-xl overflow-hidden shadow-sm">
        <img
          src={photos[index]}
          alt={`Foto ${index + 1}`}
          className="w-full h-full object-cover"
          draggable={false}
        />
        {photos.length > 1 && (
          <>
            <button
              onClick={() => go(-1)}
              aria-label="Foto anterior"
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 text-white w-9 h-9 rounded-full flex items-center justify-center active:scale-95"
            >
              ‹
            </button>
            <button
              onClick={() => go(1)}
              aria-label="Foto siguiente"
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 text-white w-9 h-9 rounded-full flex items-center justify-center active:scale-95"
            >
              ›
            </button>
          </>
        )}
      </div>
      {photos.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-3">
          {photos.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              aria-label={`Ir a foto ${i + 1}`}
              className={`w-2 h-2 rounded-full ${i === index ? "bg-brand-600" : "bg-slate-300"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
