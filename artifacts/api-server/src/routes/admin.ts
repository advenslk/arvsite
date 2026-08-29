import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { clearSession, createSession, getSessionId, publicUser, verifyPassword, SESSION_COOKIE, SESSION_TTL } from "../lib/auth";
import { ensureAuthSchema, issueCode, verifyCode } from "./auth";

const router = Router();

router.get("/admin/session", async (req, res) => {
  return res.json({ authenticated: Boolean(req.user?.role === "admin"), user: req.user?.role === "admin" ? req.user : null });
});

router.post("/admin/login", async (req, res) => {
  await ensureAuthSchema();
  const email = String(req.body?.email ?? "").trim().toLowerCase(); const password = String(req.body?.password ?? "");
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (!user || user.role !== "admin" || !user.passwordHash || !verifyPassword(password, user.passwordHash)) return res.status(401).json({ message: "Invalid administrator credentials." });
  try { await issueCode(user.id, email, "admin_login"); } catch (error) { return res.status(503).json({ message: error instanceof Error ? error.message : "Email delivery failed." }); }
  return res.json({ ok: true, challenge: "admin_otp", email });
});

router.post("/admin/verify", async (req, res) => {
  await ensureAuthSchema();
  const email = String(req.body?.email ?? "").trim().toLowerCase(); const code = String(req.body?.code ?? "");
  const [user] = await db.select().from(usersTable).where(and(eq(usersTable.email, email), eq(usersTable.role, "admin"))).limit(1);
  if (!user || !(await verifyCode(user.id, "admin_login", code))) return res.status(401).json({ message: "Invalid or expired verification code." });
  const sid = await createSession(publicUser(user)); res.cookie(SESSION_COOKIE, sid, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: SESSION_TTL });
  return res.json({ ok: true, authenticated: true });
});

router.post("/admin/logout", async (req, res) => { await clearSession(res, getSessionId(req)); return res.json({ ok: true }); });

export default router;