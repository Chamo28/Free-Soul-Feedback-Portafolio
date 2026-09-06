// Ranking para el módulo de Curaduría de Portafolio (Top-K / Selección Forzada Jerárquica).
//
// El orden de clic del evaluador ES un ranking de preferencia: el primer producto
// que marca es su favorito absoluto (#1) y el último de su selección es el que
// menos le convenció. Por eso el puntaje no es solo "cuántos lo eligieron" sino
// "en qué posición lo eligieron": un producto elegido de primero en 5 respuestas
// pesa más que uno elegido de último en esas mismas 5 respuestas. Este puntaje
// ponderado es el que debe usarse para priorizar volumen de compra.

const TOP_APPROVED = 10; // Top N = "Aprobado para importación"
const BOTTOM_DISCARD = 5; // Bottom N = "Sugerido descartar"

export function computeCurationRankings(survey, responses) {
  const totalEvaluadores = responses.length;
  const N = survey.selectionRule.count;

  const counts = new Map(survey.items.map((item) => [item.id, 0]));
  const favoriteCounts = new Map(survey.items.map((item) => [item.id, 0]));
  const weightedSum = new Map(survey.items.map((item) => [item.id, 0]));
  const positionSum = new Map(survey.items.map((item) => [item.id, 0]));

  for (const r of responses) {
    r.selectedProductIds.forEach((productId, index) => {
      if (!counts.has(productId)) return;
      counts.set(productId, counts.get(productId) + 1);
      const weight = N - index; // posición 1 (primer clic) = peso N ... última posición = peso 1
      weightedSum.set(productId, weightedSum.get(productId) + weight);
      positionSum.set(productId, positionSum.get(productId) + (index + 1));
    });
    if (r.favoriteId && favoriteCounts.has(r.favoriteId)) {
      favoriteCounts.set(r.favoriteId, favoriteCounts.get(r.favoriteId) + 1);
    }
  }

  const maxPuntosPosibles = totalEvaluadores * N;

  let ranking = survey.items.map((item) => {
    const votes = counts.get(item.id) || 0;
    const pct = totalEvaluadores > 0 ? Math.round((votes / totalEvaluadores) * 100) : 0;
    const puntos = weightedSum.get(item.id) || 0;
    const pctPonderado = maxPuntosPosibles > 0 ? Math.round((puntos / maxPuntosPosibles) * 100) : 0;
    const posicionPromedio = votes > 0 ? Math.round((positionSum.get(item.id) / votes) * 10) / 10 : null;
    return {
      productId: item.id,
      name: item.name,
      photo: item.photo,
      votos: votes,
      pctSeleccion: pct,
      puntajePonderado: puntos,
      pctPonderado,
      posicionPromedio,
      vecesFavorito: favoriteCounts.get(item.id) || 0,
    };
  });

  // Orden principal: puntaje ponderado (refleja qué tanto se prefiere, no solo si
  // fue elegido). Esto es lo que debe guiar la asignación de volumen de compra.
  ranking.sort((a, b) => b.pctPonderado - a.pctPonderado || b.votos - a.votos || b.pctSeleccion - a.pctSeleccion);

  // Etiquetado: Top N aprobado / Bottom N descartar, sin solaparse si la
  // lista es más chica que TOP_APPROVED + BOTTOM_DISCARD.
  const n = ranking.length;
  const topCount = Math.min(TOP_APPROVED, n);
  const remaining = n - topCount;
  const bottomCount = Math.min(BOTTOM_DISCARD, remaining);

  ranking = ranking.map((row, i) => {
    let label = "En revisión";
    if (i < topCount) label = "Aprobado para importación";
    else if (i >= n - bottomCount) label = "Sugerido descartar";
    return { ...row, label };
  });

  let favoritoTop1 = null;
  let maxFav = 0;
  for (const row of ranking) {
    if (row.vecesFavorito > maxFav) {
      maxFav = row.vecesFavorito;
      favoritoTop1 = row;
    }
  }

  return {
    surveyId: survey.id,
    surveyName: survey.name,
    category: survey.category,
    totalEvaluadores,
    selectionCount: N,
    ranking,
    favoritoTop1: favoritoTop1 && maxFav > 0 ? favoritoTop1 : null,
  };
}
