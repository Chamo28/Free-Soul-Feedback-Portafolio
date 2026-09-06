// Banner de marca para las vistas del evaluador (encuesta / curaduría),
// con el mismo estilo y tamaños que el Navbar del panel admin.
export default function EvaluatorHeader({ subtitle }) {
  return (
    <div className="bg-brand-700 shadow-md">
      <div className="max-w-3xl mx-auto px-4 py-2.5 flex items-center gap-2">
        <img src="/icon-512.png" alt="Free Soul DNA" className="h-9 w-9 rounded-full flex-shrink-0" />
        <div>
          <p className="font-display font-semibold text-white leading-tight">Free Soul DNA</p>
          <p className="text-[11px] font-normal text-brand-100/80 -mt-0.5">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}
