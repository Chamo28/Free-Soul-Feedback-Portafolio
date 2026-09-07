// Cálculos del módulo de Gestión de Pedidos y Sourcing.
//
// Cadena de costeo hasta llegar al Costo Landed (puesto en Colombia), en
// este orden:
//   1. Costo Unitario RMB (lo que cotiza el proveedor).
//   2. + % Comisión Agente de Compra — se cobra sobre el valor en RMB.
//   3. + Costo de Reetiquetado (RMB/unidad) — se suma directo en RMB, no
//      lleva comisión del agente (es una operación aparte).
//   4. ÷ TRM Dólar → Yuan = Costo Unitario USD (la tasa se define como
//      "cuántos RMB vale 1 USD", ej. 7.2 — por eso se DIVIDE, no se
//      multiplica).
//   5. × Cantidad Total = Precio Total FOB (USD).
//   6. × TRM (USD → COP) = valor FOB en pesos.
//   7. + Flete Nacional (COP/unidad, un solo valor para todo el pedido).
//   8. × (1 + % Factor de Importación) — el factor de importación es la
//      ÚLTIMA variable: ya incluye todos los fletes internacionales,
//      aranceles y nacionalización, así que se aplica sobre el subtotal
//      (FOB + flete nacional) para llegar al Costo Landed.
//
// Todas las tasas/porcentajes se definen a nivel de pedido porque fluctúan y
// en cada negociación pueden variar.

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

  // Desglose informativo (ya están incluidos dentro de precioTotalFOB_USD /
  // fobTotalCOP, no se suman de nuevo — solo sirven para ver cuánto pesa
  // cada concepto dentro del FOB).
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

function round2(n) {
  return Math.round(n * 100) / 100;
}
