import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

// El token lleva la marca con la que se inició sesión — así un token de
// Free Soul no sirve para tocar datos de Alas de Amara ni viceversa, aunque
// las dos marcas compartan el mismo JWT_SECRET.
export function issueAdminToken(brandId) {
  return jwt.sign({ role: "admin", brand: brandId }, JWT_SECRET, { expiresIn: "12h" });
}

export function requireAdmin(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "No autorizado. Inicia sesión como admin." });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== "admin") throw new Error("rol inválido");
    // req.brand ya lo fijó el middleware withBrand a partir del header
    // X-Brand-Id — si el token es de otra marca, se trata como inválido en
    // vez de dejar pasar (evita que una sesión de una marca opere sobre los
    // datos de otra).
    if (req.brand && payload.brand && payload.brand !== req.brand.id) throw new Error("marca distinta");
    next();
  } catch {
    return res.status(401).json({ error: "Sesión inválida o expirada. Vuelve a iniciar sesión." });
  }
}
