// Mismas fórmulas que server/src/services/purchaseOrderCalc.js — se
// duplican aquí para que la grilla calcule en vivo mientras el admin digita,
// sin esperar la respuesta del servidor en cada tecla.
//
// Cadena de costeo hasta el Costo Landed: Costo RMB + % comisión agente de
// compra → USD (tasa RMB→USD) → Precio FOB → COP (TRM) + % factor de
// importación + Flete (por categoría o excepción) + Costo de reetiquetado.

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
  const comisionAgentePct = Number(order.comisionAgentePct) || 0;
  const factorImportacionPct = Number(order.factorImportacionPct) || 0;
  const costoReetiquetadoUnitarioCOP = Number(order.costoReetiquetadoUnitarioCOP) || 0;

  const cantidadTotal = cantidadPorEmpaque * cantidadEmpaques;

  const costoUnitarioConComisionRMB = costoUnitarioRMB * (1 + comisionAgentePct / 100);
  const costoUnitarioUSD = costoUnitarioConComisionRMB * tasaRMBaUSD;
  const precioTotalFOB_USD = costoUnitarioUSD * cantidadTotal;
  const comisionAgenteTotalCOP = (costoUnitarioConComisionRMB - costoUnitarioRMB) * tasaRMBaUSD * cantidadTotal * trmUSDaCOP;

  const fobTotalCOP = precioTotalFOB_USD * trmUSDaCOP;
  const factorImportacionCOP = fobTotalCOP * (factorImportacionPct / 100);

  const fleteUnitarioCOP = freightPerUnitCOP(item, order);
  const fleteTotalCOP = fleteUnitarioCOP * cantidadTotal;

  const costoReetiquetadoTotalCOP = costoReetiquetadoUnitarioCOP * cantidadTotal;

  const costoLandedTotalCOP = fobTotalCOP + factorImportacionCOP + fleteTotalCOP + costoReetiquetadoTotalCOP;

  return {
    cantidadTotal,
    costoUnitarioUSD: round2(costoUnitarioUSD),
    precioTotalFOB_USD: round2(precioTotalFOB_USD),
    comisionAgenteTotalCOP: Math.round(comisionAgenteTotalCOP),
    fleteUnitarioCOP,
    fleteTotalCOP: Math.round(fleteTotalCOP),
    factorImportacionCOP: Math.round(factorImportacionCOP),
    costoReetiquetadoTotalCOP: Math.round(costoReetiquetadoTotalCOP),
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

export function formatCOP(n) {
  return "$" + Math.round(n || 0).toLocaleString("es-CO");
}

export function formatUSD(n) {
  return "US$" + (n || 0).toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
