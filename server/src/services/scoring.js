// Reglas de recomendación estandarizadas para cualquier categoría.
// avgOverall: promedio de Atractivo, Calidad y Precio (escala 1-5)
// pctCompraria: porcentaje (0-100) de evaluadores que comprarían

export function computeRecommendation(avgOverall, pctCompraria) {
  if (avgOverall >= 4 && pctCompraria >= 70) {
    return { label: "Adelante", detail: "Buen puntaje y alta intención de compra. Procede a importar." };
  }
  if (avgOverall < 2.5 || pctCompraria < 30) {
    return { label: "Descartar", detail: "Puntaje bajo o poca intención de compra. No importar este modelo." };
  }
  return { label: "Renegociar", detail: "Resultados intermedios. Revisa precio/calidad con el proveedor antes de decidir." };
}

export function summarizeResponses(responses) {
  const byProduct = new Map();
  for (const r of responses) {
    if (!byProduct.has(r.productId)) byProduct.set(r.productId, []);
    byProduct.get(r.productId).push(r);
  }

  const summaries = [];
  for (const [productId, list] of byProduct.entries()) {
    const n = list.length;
    const avg = (key) => list.reduce((sum, r) => sum + Number(r[key] || 0), 0) / n;
    const atractivo = avg("atractivo");
    const calidad = avg("calidad");
    const precio = avg("precio");
    const compraria = list.filter((r) => r.compraria === true).length;
    const pctCompraria = n > 0 ? Math.round((compraria / n) * 100) : 0;
    const avgOverall = (atractivo + calidad + precio) / 3;
    const recommendation = computeRecommendation(avgOverall, pctCompraria);

    summaries.push({
      productId,
      totalRespuestas: n,
      atractivo: round1(atractivo),
      calidad: round1(calidad),
      precio: round1(precio),
      promedio: round1(avgOverall),
      pctCompraria,
      recommendation,
      comentarios: list
        .filter((r) => r.comentarios && r.comentarios.trim())
        .map((r) => ({ evaluador: r.evaluador, comentario: r.comentarios, fecha: r.fecha })),
    });
  }
  return summaries;
}

function round1(n) {
  return Math.round(n * 10) / 10;
}
