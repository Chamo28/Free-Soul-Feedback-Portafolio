// Parsea el archivo de importación de pedidos: una fila por imagen, agrupada
// por URL de producto repetida. Acepta CSV (coma) o TXT (tab), con o sin fila
// de encabezado (si detecta nombres de columna conocidos, los usa; si no,
// asume el orden fijo URL_Producto, URL_Imagen, Referencia).

const HEADER_ALIASES = {
  url_producto: ["url_producto", "urlproducto", "product_url", "link", "link_producto", "producto"],
  url_imagen: ["url_imagen", "urlimagen", "image_url", "imagen", "imagen_url", "foto", "img"],
  referencia: ["referencia", "nombre", "reference", "name", "ref"],
};

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

  const looksLikeHeader = normalizedFirst.some((cell) =>
    Object.values(HEADER_ALIASES).some((aliases) => aliases.includes(cell))
  );

  if (looksLikeHeader) {
    colIndex = {};
    for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
      const idx = normalizedFirst.findIndex((cell) => aliases.includes(cell));
      if (idx !== -1) colIndex[key] = idx;
    }
    dataStart = 1;
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

  const groups = new Map(); // url_producto -> { productUrl, referencia, images: Set }
  const warnings = [];

  for (let i = dataStart; i < lines.length; i++) {
    const cells = splitLine(lines[i], delimiter);
    const productUrl = (cells[colIndex.url_producto] || "").trim();
    const imageUrl = colIndex.url_imagen != null ? (cells[colIndex.url_imagen] || "").trim() : "";
    const referencia = colIndex.referencia != null ? (cells[colIndex.referencia] || "").trim() : "";

    if (!productUrl) {
      warnings.push(`Fila ${i + 1}: sin URL de producto, se omite.`);
      continue;
    }

    if (!groups.has(productUrl)) {
      groups.set(productUrl, { productUrl, referencia: referencia || "", images: [] });
    }
    const group = groups.get(productUrl);
    if (!group.referencia && referencia) group.referencia = referencia;
    if (imageUrl && !group.images.includes(imageUrl)) group.images.push(imageUrl);
  }

  const items = Array.from(groups.values()).map((g, i) => ({
    productUrl: g.productUrl,
    referencia: g.referencia || `Producto ${i + 1}`,
    images: g.images,
  }));

  const withoutImages = items.filter((it) => it.images.length === 0).length;
  if (withoutImages > 0) {
    warnings.push(`${withoutImages} producto(s) no tienen ninguna imagen asociada.`);
  }

  return { items, warnings };
}
