export default function ScoreInput({ label, hint, value, onChange }) {
  return (
    <div className="mb-5">
      <p className="font-medium text-slate-800">{label}</p>
      {hint && <p className="text-sm text-slate-500 mb-2">{hint}</p>}
      <div className="flex gap-2 mt-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`w-11 h-11 rounded-full border text-sm font-semibold transition ${
              value === n
                ? "bg-brand-600 border-brand-600 text-white"
                : "bg-white border-slate-300 text-slate-600 active:bg-slate-100"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
