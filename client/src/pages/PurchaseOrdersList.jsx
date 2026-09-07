import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar.jsx";
import { getPurchaseOrders, createPurchaseOrder, deletePurchaseOrder } from "../api.js";
import { formatCOP } from "../utils/purchaseOrderCalc.js";

export default function PurchaseOrdersList() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    getPurchaseOrders()
      .then(setOrders)
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const order = await createPurchaseOrder(newName.trim());
      navigate(`/admin/pedidos/${order.id}`);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`¿Eliminar el pedido "${name}"? También se borran las fotos descargadas de sus productos.`)) return;
    await deletePurchaseOrder(id);
    load();
  };

  return (
    <div>
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-6">
        <h1 className="text-lg font-bold text-slate-800 mb-1">Pedidos de Sourcing</h1>
        <p className="text-sm text-slate-500 mb-4">
          Importa tus links de 1688/Alibaba, digita cantidades y costos, y calcula el costo puesto en Colombia.
        </p>

        <form onSubmit={handleCreate} className="flex gap-2 mb-6">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nombre del pedido (ej. Bolsos Octubre 2026)"
            className="flex-1 border border-slate-300 rounded-lg px-3 py-2"
          />
          <button
            type="submit"
            disabled={creating}
            className="bg-brand-600 text-white rounded-lg px-4 py-2 font-medium disabled:opacity-60 whitespace-nowrap"
          >
            {creating ? "Creando..." : "+ Nuevo pedido"}
          </button>
        </form>

        {loading && <p className="text-slate-500">Cargando...</p>}

        {!loading && orders.length === 0 && (
          <div className="bg-white border border-dashed border-slate-300 rounded-xl p-10 text-center text-slate-500">
            Todavía no has creado ningún pedido.
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {orders.map((o) => (
            <div key={o.id} className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-1.5">
              <Link to={`/admin/pedidos/${o.id}`} className="font-semibold text-slate-800 hover:text-brand-700">
                {o.name}
              </Link>
              <p className="text-xs text-slate-500">
                {o.totalProductos} producto(s) · {o.totalUnidades} unidades
              </p>
              <p className="text-sm font-bold text-brand-700">
                {formatCOP(o.totalLandedCOP)} <span className="text-xs font-normal text-slate-400">landed estimado</span>
              </p>
              <div className="flex gap-2 mt-2">
                <Link
                  to={`/admin/pedidos/${o.id}`}
                  className="flex-1 text-center text-sm border border-slate-200 rounded-lg py-1.5 text-slate-600"
                >
                  Abrir
                </Link>
                <button
                  onClick={() => handleDelete(o.id, o.name)}
                  className="px-3 text-sm border border-red-200 text-red-500 rounded-lg py-1.5"
                >
                  Borrar
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
