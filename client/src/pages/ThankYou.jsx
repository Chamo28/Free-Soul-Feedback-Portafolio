import { useBrand } from "../BrandContext.jsx";

export default function ThankYou() {
  const brand = useBrand();
  return (
    <div className="min-h-screen flex items-center justify-center px-4 text-center bg-brand-700">
      <div>
        <img src={brand.logo} alt={brand.name} className="h-20 w-20 rounded-2xl shadow-lg mx-auto mb-6" />
        <div className="text-5xl mb-4">🙌</div>
        <h1 className="text-xl font-display font-bold text-white mb-2">¡Gracias por tu opinión!</h1>
        <p className="text-brand-100/80">Tu feedback ayuda a decidir qué productos vamos a importar.</p>
      </div>
    </div>
  );
}
