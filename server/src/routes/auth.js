import { Router } from "express";
import { issueAdminToken } from "../middleware/auth.js";

const router = Router();

router.post("/login", (req, res) => {
  const { password } = req.body || {};
  const brand = req.brand;
  const ADMIN_PASSWORD = process.env[brand.adminPasswordEnv] || "";
  if (!ADMIN_PASSWORD) {
    return res
      .status(500)
      .json({ error: `El servidor no tiene configurada ${brand.adminPasswordEnv} para ${brand.name} (.env).` });
  }
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Contraseña incorrecta." });
  }
  const token = issueAdminToken(brand.id);
  res.json({ token });
});

export default router;
