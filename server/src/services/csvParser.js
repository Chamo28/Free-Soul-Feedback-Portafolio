// Parsea el archivo de importación de pedidos/curadurías.
//
// Acepta DOS formatos, autodetectados por el encabezado:
//
// 1) "Columnas independientes" (recomendado, más amigable en Excel): una
//    fila por producto, con una columna por cada foto —
//    URL_Producto, Referencia, URL_Imagen_1, URL_Imagen_2, URL_Imagen_3...
//    (el número de columnas de imagen es libre, se detectan todas).
//
// 2) "Una fila por imagen" (formato largo, útil si el archivo viene
//    generado desde otro sistema): URL_Producto, URL_Imagen, Referencia —
//    si un producto tiene varias fotos, se repite la misma URL de producto
//    en varias filas.
//
// En ambos casos, con o sin fila de encabezado (sin encabezado se asume el
// orden fijo URL_Producto, URL_Imagen, Referencia — formato largo).

const HEADER_ALIASES = {
  url_producto: ["url_producto", "urlproducto", "product_url", "link", "link_producto", "producto"],
  url_imagen: ["url_imagen", "urlimagen", "image_url", "imagen", "imagen_url", "foto", "img"],
  referencia: ["referencia", "nombre", "reference", "name", "ref"],
};

// Nombres de columna de imagen numerada: URL_Imagen_1, Imagen2, Foto_3, IMG4...
const NUMBERED_IMAGE_RE = /^(?:url_imagen|urlimagen|image_url|imagen|foto|img)_?([0-9]+)$/;

function detectDelimiter(line) {
  const tabs = (line.match(/\t/g) || []).length;
  const commas = (line.match(/,/g) || []).length;
  return tabs > commas ? "\t" : ",";
}

function normalizeHeaderCell(cell) {
  return cell
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita tildes
    .replace(/\s+/g, "_");
}

function splitLine(line, delimiter) {
  // División simple: suficiente para URLs/nombres sin comas internas. Si el
  // valor viene entre comillas, se respetan (caso típico de export de Excel).
  const cells = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

export function parseImportText(text) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return { items: [], warnings: ["El archivo está vacío."] };

  const delimiter = detectDelimiter(lines[0]);
  const firstCells = splitLine(lines[0], delimiter);
  const normalizedFirst = firstCells.map(normalizeHeaderCell);

  let colIndex = { url_producto: 0, url_imagen: 1, referencia: 2 };
  let dataStart = 0;
  let imageColIndexes = []; // índices de columnas de imagen, en orden (formato "columnas independientes")

  const numberedImageCols = normalizedFirst
    .map((cell, idx) => ({ idx, match: cell.match(NUMBERED_IMAGE_RE) }))
    .filter((c) => c.match);

  const looksLikeHeader =
    numberedImageCols.length > 0 ||
    normalizedFirst.some((cell) => Object.values(HEADER_ALIASES).some((aliases) => aliases.includes(cell)));

  if (looksLikeHeader) {
    colIndex = {};
    for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
      const idx = normalizedFirst.findIndex((cell) => aliases.includes(cell));
      if (idx !== -1) colIndex[key] = idx;
    }
    dataStart = 1;

    if (numberedImageCols.length > 0) {
      // Formato "columnas independientes": una columna por foto. Se ordenan
      // por su número (Imagen_1, Imagen_2...) para que el orden sea estable.
      imageColIndexes = numberedImageCols
        .sort((a, b) => Number(a.match[1]) - Number(b.match[1]))
        .map((c) => c.idx);
      delete colIndex.url_imagen; // se usa imageColIndexes en su lugar
    }
  }

  // Solo la columna de URL de producto es obligatoria: la de imagen y la de
  // referencia son opcionales. Un archivo sin fotos (o incompleto) igual debe
  // poder importarse — el admin completa lo que falte después, a mano, en
  // la grilla del pedido.
  if (colIndex.url_producto == null) {
    return {
      items: [],
      warnings: [
        "No se pudo identificar la columna de URL de producto. Usa un encabezado como 'URL_Producto', o el orden fijo (producto, imagen, referencia) sin encabezado.",
      ],
    };
  }

  const groups = new Map(); // url_producto -> { productUrl, referencia, images: [] }
  const warnings = [];

  for (let i = dataStart; i < lines.length; i++) {
    const cells = splitLine(lines[i], delimiter);
    const productUrl = (cells[colIndex.url_producto] || "").trim();
    const referencia = colIndex.referencia != null ? (cells[colIndex.referencia] || "").trim() : "";
    const rowImages =
      imageColIndexes.length > 0
        ? imageColIndexes.map((idx) => (cells[idx] || "").trim()).filter(Boolean)
        : colIndex.url_imagen != null
          ? [(cells[colIndex.url_imagen] || "").trim()].filter(Boolean)
          : [];

    if (!productUrl) {
      warnings.push(`Fila ${i + 1}: sin URL de producto, se omite.`);
      continue;
    }

    if (!groups.has(productUrl)) {
      groups.set(productUrl, { productUrl, referencia: referencia || "", images: [] });
    }
    const group = groups.get(productUrl);
    if (!group.referencia && referencia) group.referencia = referencia;
    for (const imageUrl of rowImages) {
      if (imageUrl && !group.images.includes(imageUrl)) group.images.push(imageUrl);
    }
  }

  const items = Array.from(groups.values()).map((g, i) => ({
    productUrl: g.productUrl,
    referencia: g.referencia || `Producto ${i + 1}`,
    images: g.images,
  }));

  // Si varias filas traen la MISMA referencia (típico cuando se llena la
  // misma celda para todos, ej. "Tennis Mujer" repetido en cada fila para
  // toda una línea de producto), se numeran para que sigan siendo
  // distinguibles a simple vista — si no, todas las tarjetas se ven
  // "iguales" en el texto aunque las fotos sean de productos distintos.
  const nameCounts = new Map();
  for (const it of items) nameCounts.set(it.referencia, (nameCounts.get(it.referencia) || 0) + 1);
  const seenSoFar = new Map();
  let renamedGroups = 0;
  for (const it of items) {
    if (nameCounts.get(it.referencia) > 1) {
      const n = (seenSoFar.get(it.referencia) || 0) + 1;
      seenSoFar.set(it.referencia, n);
      if (n === 1) renamedGroups++;
      it.referencia = `${it.referencia} ${n}`;
    }
  }
  if (renamedGroups > 0) {
    warnings.push(
      `${renamedGroups} nombre(s) de referencia se repetían en varias filas — se numeraron automáticamente (ej. "Tennis Mujer 1", "Tennis Mujer 2"...) para que se distingan. Puedes renombrar cada producto individualmente (por color, talla, etc.) desde la pantalla de editar.`
    );
  }

  const withoutImages = items.filter((it) => it.images.length === 0).length;
  if (withoutImages > 0) {
    warnings.push(`${withoutImages} producto(s) no tienen ninguna imagen asociada.`);
  }

  return { items, warnings };
}
