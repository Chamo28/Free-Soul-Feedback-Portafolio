// Cálculos del módulo de Gestión de Pedidos y Sourcing.
//
// Cadena de moneda: el proveedor cotiza en RMB (yuanes). El admin define, a
// nivel de pedido, una tasa RMB→USD y la TRM (USD→COP) — ambas editables
// porque fluctúan y en cada negociación pueden variar.
//
// El flete/impuesto estimado se maneja en COP por unidad, con una tarifa por
// categoría (definida en el pedido) que se puede excepcionar fila por fila.

export const DEFAULT_CATEGORY_FREIGHT_COP = {
  Bolsos: 8000,
  Calzado: 9000,
  Ropa: 6000,
  Accesorios: 4000,
};

export function freightPerUnitCOP(item, order) {
  if (item.fleteOverrideCOP != null && item.fleteOverrideCOP !== "") {
    return Number(item.fleteOverrideCOP) || 0;
  }
  const rates = order.categoryFreightRates || {};
  return Number(rates[item.categoria]) || 0;
}

export function computeItem(item, order) {
  const costoUnitarioRMB = Number(item.costoUnitarioRMB) || 0;
  const cantidadPorEmpaque = Number(item.cantidadPorEmpaque) || 0;
  const cantidadEmpaques = Number(item.cantidadEmpaques) || 0;
  const tasaRMBaUSD = Number(order.tasaRMBaUSD) || 0;
  const trmUSDaCOP = Number(order.trmUSDaCOP) || 0;

  const cantidadTotal = cantidadPorEmpaque * cantidadEmpaques;
  const costoUnitarioUSD = costoUnitarioRMB * tasaRMBaUSD;
  const precioTotalFOB_USD = costoUnitarioUSD * cantidadTotal;
  const fleteUnitarioCOP = freightPerUnitCOP(item, order);
  const fleteTotalCOP = fleteUnitarioCOP * cantidadTotal;
  const costoLandedTotalCOP = precioTotalFOB_USD * trmUSDaCOP + fleteTotalCOP;

  return {
    cantidadTotal,
    costoUnitarioUSD: round2(costoUnitarioUSD),
    precioTotalFOB_USD: round2(precioTotalFOB_USD),
    fleteUnitarioCOP,
    fleteTotalCOP: Math.round(fleteTotalCOP),
    costoLandedTotalCOP: Math.round(costoLandedTotalCOP),
  };
}

export function computeOrderSummary(order) {
  const items = order.items || [];
  let totalUnidades = 0;
  let totalCajas = 0;
  let totalFOB_USD = 0;
  let totalLandedCOP = 0;

  const computedItems = items.map((item) => {
    const c = computeItem(item, order);
    totalUnidades += c.cantidadTotal;
    totalCajas += Number(item.cantidadEmpaques) || 0;
    totalFOB_USD += c.precioTotalFOB_USD;
    totalLandedCOP += c.costoLandedTotalCOP;
    return { ...item, ...c };
  });

  return {
    items: computedItems,
    totales: {
      totalProductos: items.length,
      totalUnidades,
      totalCajas,
      totalFOB_USD: round2(totalFOB_USD),
      totalLandedCOP: Math.round(totalLandedCOP),
    },
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
