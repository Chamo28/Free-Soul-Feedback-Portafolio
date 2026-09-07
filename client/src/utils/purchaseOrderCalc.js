// Mismas fórmulas que server/src/services/purchaseOrderCalc.js — se
// duplican aquí para que la grilla calcule en vivo mientras el admin digita,
// sin esperar la respuesta del servidor en cada tecla.
//
// Cadena de costeo: Costo RMB + % comisión agente + Costo reetiquetado
// (RMB/unidad) → ÷ TRM Dólar→Yuan → FOB (USD) → × TRM Dólar→Peso → + Flete
// Nacional (COP/unidad) → × (1 + % Factor de importación, que ya incluye
// todos los fletes internacionales/aranceles) = Costo Landed.

export function computeItem(item, order) {
  const costoUnitarioRMB = Number(item.costoUnitarioRMB) || 0;
  const cantidadPorEmpaque = Number(item.cantidadPorEmpaque) || 0;
  const cantidadEmpaques = Number(item.cantidadEmpaques) || 0;
  const tasaUSDaRMB = Number(order.tasaUSDaRMB) || 0;
  const trmUSDaCOP = Number(order.trmUSDaCOP) || 0;
  const comisionAgentePct = Number(order.comisionAgentePct) || 0;
  const costoReetiquetadoUnitarioRMB = Number(order.costoReetiquetadoUnitarioRMB) || 0;
  const factorImportacionPct = Number(order.factorImportacionPct) || 0;
  const fleteNacionalUnitarioCOP = Number(order.fleteNacionalUnitarioCOP) || 0;

  const cantidadTotal = cantidadPorEmpaque * cantidadEmpaques;

  const costoUnitarioConComisionRMB = costoUnitarioRMB * (1 + comisionAgentePct / 100);
  const costoUnitarioTotalRMB = costoUnitarioConComisionRMB + costoReetiquetadoUnitarioRMB;
  const costoUnitarioUSD = tasaUSDaRMB > 0 ? costoUnitarioTotalRMB / tasaUSDaRMB : 0;
  const precioTotalFOB_USD = costoUnitarioUSD * cantidadTotal;

  const comisionAgenteTotalCOP =
    tasaUSDaRMB > 0 ? ((costoUnitarioConComisionRMB - costoUnitarioRMB) / tasaUSDaRMB) * cantidadTotal * trmUSDaCOP : 0;
  const reetiquetadoTotalCOP =
    tasaUSDaRMB > 0 ? (costoReetiquetadoUnitarioRMB / tasaUSDaRMB) * cantidadTotal * trmUSDaCOP : 0;

  const fobTotalCOP = precioTotalFOB_USD * trmUSDaCOP;
  const fleteNacionalTotalCOP = fleteNacionalUnitarioCOP * cantidadTotal;
  const subtotalCOP = fobTotalCOP + fleteNacionalTotalCOP;
  const factorImportacionMontoCOP = subtotalCOP * (factorImportacionPct / 100);
  const costoLandedTotalCOP = subtotalCOP + factorImportacionMontoCOP;

  return {
    cantidadTotal,
    costoUnitarioUSD: round2(costoUnitarioUSD),
    precioTotalFOB_USD: round2(precioTotalFOB_USD),
    comisionAgenteTotalCOP: Math.round(comisionAgenteTotalCOP),
    reetiquetadoTotalCOP: Math.round(reetiquetadoTotalCOP),
    fleteNacionalUnitarioCOP,
    fleteNacionalTotalCOP: Math.round(fleteNacionalTotalCOP),
    factorImportacionMontoCOP: Math.round(factorImportacionMontoCOP),
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
