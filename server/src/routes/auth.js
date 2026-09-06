import { Router } from "express";
import { issueAdminToken } from "../middleware/auth.js";

const router = Router();

router.post("/login", (req, res) => {
  const { password } = req.body || {};
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
  if (!ADMIN_PASSWORD) {
    return res.status(500).json({ error: "El servidor no tiene configurada ADMIN_PASSWORD (.env)." });
  }
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Contraseña incorrecta." });
  }
  const token = issueAdminToken();
  res.json({ token });
});

export default router;
