import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getSyncStatus, getCurationSurveys, getPurchaseOrders, getPurchaseOrder, adminLogout } from "../api.js";

// Collage de portada: si el módulo ya tiene fotos reales (productos subidos,
// curadurías creadas, pedidos importados), arma una grilla con ellas. Si
// todavía no hay datos, cae a un degradado de marca + ícono grande — nunca
// se inventan fotos de stock externas.
function CoverCollage({ photos, icon, gradientClass }) {
  const shown = photos.slice(0, 4);
  if (shown.length === 0) {
    return (
      <div className={`h-36 sm:h-44 flex items-center justify-center text-6xl ${gradientClass}`}>
        <span className="drop-shadow-sm">{icon}</span>
      </div>
    );
  }
  return (
    <div className={`relative h-36 sm:h-44 overflow-hidden ${gradientClass}`}>
      <div className={`absolute inset-0 grid ${shown.length === 1 ? "grid-cols-1" : "grid-cols-2"} grid-rows-2 gap-0.5`}>
        {shown.map((src, i) => (
          <img key={i} src={src} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
        ))}
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/5 to-transparent" />
      <span className="absolute bottom-2 right-3 text-4xl drop-shadow-lg">{icon}</span>
    </div>
  );
}

function ModuleCard({ to, icon, gradientClass, photos, title, subtitle, disabled, badge }) {
  const body = (
    <div
      className={`h-full bg-white rounded-2xl border-2 shadow-sm overflow-hidden flex flex-col transition-all duration-200 ${
        disabled
          ? "border-slate-200 opacity-75"
          : "border-transparent hover:shadow-lg hover:-translate-y-0.5 hover:scale-[1.01] hover:border-brand-700 active:scale-[0.99] cursor-pointer"
      }`}
    >
      <div className="relative">
        <CoverCollage photos={photos} icon={icon} gradientClass={gradientClass} />
        {badge && (
          <span className="absolute top-3 right-3 bg-sand-500 text-brand-900 text-[11px] font-bold tracking-wide px-2.5 py-1 rounded-full shadow">
            {badge}
          </span>
        )}
      </div>
      <div className="p-4 sm:p-5 flex-1 flex flex-col gap-1">
        <h3 className="font-display font-bold text-slate-800 text-base sm:text-lg leading-snug">{title}</h3>
        <p className="text-sm text-slate-500 leading-snug">{subtitle}</p>
        {!disabled && (
          <span className="mt-2 text-sm font-semibold text-brand-700 inline-flex items-center gap-1">
            Entrar <span aria-hidden>→</span>
          </span>
        )}
      </div>
    </div>
  );

  if (disabled) return <div aria-disabled="true">{body}</div>;
  return (
    <Link to={to} className="block h-full">
      {body}
    </Link>
  );
}

export default function Home() {
  const [status, setStatus] = useState(null);
  const [curationPhotos, setCurationPhotos] = useState([]);
  const [orderPhotos, setOrderPhotos] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    getSyncStatus()
      .then(setStatus)
      .catch(() => setStatus({ configured: false }));

    getCurationSurveys()
      .then((surveys) => {
        const photos = [];
        outer: for (const s of surveys) {
          for (const item of s.items || []) {
            const p = (item.photos && item.photos[0]) || item.photo;
            if (p) photos.push(p);
            if (photos.length >= 4) break outer;
          }
        }
        setCurationPhotos(photos);
      })
      .catch(() => {});

    getPurchaseOrders()
      .then(async (orders) => {
        if (orders.length === 0) return;
        try {
          const full = await getPurchaseOrder(orders[0].id);
          const photos = (full.items || [])
            .map((i) => i.photos?.[0])
            .filter(Boolean)
            .slice(0, 4);
          setOrderPhotos(photos);
        } catch {
          // sin conexión puntual: la tarjeta simplemente cae al ícono
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <img src="/icon-512.png" alt="Free Soul DNA" className="h-11 w-11 rounded-full flex-shrink-0" />
            <div className="min-w-0">
              <p className="font-display font-bold text-brand-700 text-lg leading-tight truncate">Free Soul DNA</p>
              <p className="text-xs text-slate-500 -mt-0.5">Operations Suite</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {status && (
              <span
                className={`text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1.5 whitespace-nowrap ${
                  status.configured ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${status.configured ? "bg-green-500" : "bg-slate-400"}`} />
                <span className="hidden sm:inline">{status.configured ? "Servidor conectado" : "Sheets no configurado"}</span>
                <span className="sm:hidden">{status.configured ? "Conectado" : "Sin config."}</span>
              </span>
            )}
            <button
              onClick={() => {
                adminLogout();
                navigate("/admin/login");
              }}
              className="text-sm text-slate-500 hover:text-slate-700 font-medium"
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 sm:py-10">
        <div className="mb-6 sm:mb-8">
          <h1 className="font-display font-bold text-2xl sm:text-3xl text-slate-800">
            Plataforma Integral de Operaciones
          </h1>
          <p className="text-slate-500 mt-1">Elige un módulo para empezar a trabajar.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
          <ModuleCard
            to="/admin/curaduria"
            icon="📊"
            gradientClass="bg-gradient-to-br from-brand-600 to-brand-900"
            photos={curationPhotos}
            title="Curaduría & Testeo de Mercado"
            subtitle="Validación de muestras, encuestas detalladas y selección Top-K de productos."
          />
          <ModuleCard
            to="/admin/pedidos"
            icon="📦"
            gradientClass="bg-gradient-to-br from-sand-600 to-sand-800"
            photos={orderPhotos}
            title="Gestión de Pedidos & Sourcing (1688)"
            subtitle="Importación masiva de URLs, calculadora de costos FOB/Landed y Órdenes de Compra."
          />
          <ModuleCard
            icon="🛍️"
            gradientClass="bg-gradient-to-br from-slate-400 to-slate-600"
            photos={[]}
            title="Portal Mayoristas & Distribuidores"
            subtitle="Catálogo interactivo, recepción de pedidos por volumen y carritos B2B."
            disabled
            badge="Próximamente"
          />
          <ModuleCard
            icon="📈"
            gradientClass="bg-gradient-to-br from-slate-400 to-slate-600"
            photos={[]}
            title="Márgenes & Métricas de Operación"
            subtitle="Consolidado de respuestas de mercado, cálculo de márgenes y ROI."
            disabled
            badge="Próximamente"
          />
        </div>
      </main>
    </div>
  );
}
