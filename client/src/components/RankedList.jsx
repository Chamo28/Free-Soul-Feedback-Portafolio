import { useEffect, useRef, useState } from "react";

// Lista reordenable por arrastre (mouse y touch) tipo "armar el orden con la mano".
// items: array de {id, name, photo} YA en el orden actual (posición 0 = #1).
// onReorder: (newOrderedIds) => void
export default function RankedList({ items, onReorder }) {
  const itemRefs = useRef({});
  const orderRef = useRef(items.map((i) => i.id));
  const [dragId, setDragId] = useState(null);
  const [overIndex, setOverIndex] = useState(null);

  useEffect(() => {
    orderRef.current = items.map((i) => i.id);
  }, [items]);

  useEffect(() => {
    if (!dragId) return;

    const getY = (e) => (e.touches && e.touches[0] ? e.touches[0].clientY : e.clientY);

    const handleMove = (e) => {
      const y = getY(e);
      if (y == null) return;
      const ids = orderRef.current;
      let newIndex = ids.length - 1;
      for (let i = 0; i < ids.length; i++) {
        const el = itemRefs.current[ids[i]];
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        const mid = rect.top + rect.height / 2;
        if (y < mid) {
          newIndex = i;
          break;
        }
      }
      setOverIndex(newIndex);
      const curIndex = ids.indexOf(dragId);
      if (curIndex === -1 || curIndex === newIndex) return;
      const next = [...ids];
      next.splice(curIndex, 1);
      next.splice(newIndex, 0, dragId);
      orderRef.current = next;
      onReorder(next);
    };

    const handleUp = () => {
      setDragId(null);
      setOverIndex(null);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragId]);

  return (
    <ol className="space-y-2 mb-6">
      {items.map((item, i) => (
        <li
          key={item.id}
          ref={(el) => {
            itemRefs.current[item.id] = el;
          }}
          className={`flex items-center gap-3 bg-white border rounded-xl p-2 transition-shadow ${
            dragId === item.id ? "border-brand-500 shadow-lg opacity-90 scale-[1.01]" : "border-slate-200"
          }`}
        >
          <span
            className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
              i === 0 ? "bg-amber-500 text-white" : "bg-brand-50 text-brand-700"
            }`}
          >
            {i === 0 ? "★" : `#${i + 1}`}
          </span>
          <img src={item.photo} alt={item.name} className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
          <span className="font-medium text-slate-800 truncate flex-1">{item.name}</span>
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              setDragId(item.id);
            }}
            aria-label="Arrastrar para cambiar el orden"
            className="w-9 h-9 flex-shrink-0 flex items-center justify-center text-slate-400 text-lg cursor-grab active:cursor-grabbing touch-none select-none"
          >
            ⠿
          </button>
        </li>
      ))}
    </ol>
  );
}
