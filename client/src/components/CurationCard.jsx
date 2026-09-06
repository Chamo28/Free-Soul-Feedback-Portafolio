export default function CurationCard({ item, rank, disabled, onToggle, onZoom }) {
  const selected = Boolean(rank);
  return (
    <div
      onClick={() => !disabled && onToggle(item.id)}
      className={`relative rounded-xl overflow-hidden border-2 transition-all duration-150 select-none ${
        selected
          ? "border-brand-600 shadow-md scale-[1.02]"
          : disabled
          ? "border-transparent opacity-40 cursor-not-allowed"
          : "border-transparent opacity-95 hover:opacity-100 hover:shadow-lg hover:-translate-y-0.5 cursor-pointer"
      }`}
    >
      <div className="aspect-square bg-slate-100">
        <img src={item.photo} alt={item.name} className="w-full h-full object-cover" draggable={false} />
      </div>

      {selected && (
        <div className="absolute top-1.5 right-1.5 min-w-7 h-7 px-1.5 bg-brand-600 rounded-full flex items-center justify-center text-white text-sm font-bold shadow">
          #{rank}
        </div>
      )}

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onZoom(item);
        }}
        aria-label="Ver en grande"
        className="absolute top-1.5 left-1.5 w-7 h-7 bg-black/45 rounded-full flex items-center justify-center text-white text-xs"
      >
        🔍
      </button>

      <div className="absolute bottom-0 left-0 right-0 bg-black/45 text-white text-xs px-2 py-1 truncate">
        {item.name}
      </div>
    </div>
  );
}
