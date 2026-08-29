import { Router } from "express";
import crypto from "node:crypto";
import tls from "node:tls";
import { db, usersTable, verificationCodesTable } from "@workspace/db";
import { and, desc, eq, gt } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { clearSession, createSession, getSessionId, hashCode, hashPassword, publicUser, randomCode, verifyPassword, SESSION_COOKIE, SESSION_TTL } from "../lib/auth";

const router = Router();
const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const CODE_COOLDOWN_MS = 60 * 1000;
let schemaReady: Promise<void> | null = null;

export async function ensureAuthSchema() {
  if (!schemaReady) schemaReady = (async () => {
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash varchar`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS role varchar NOT NULL DEFAULT 'user'`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS verification_codes (id varchar PRIMARY KEY, user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE, purpose varchar NOT NULL, code_hash varchar NOT NULL, expires_at timestamptz NOT NULL, attempts numeric NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now())`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_verification_codes_user_purpose ON verification_codes(user_id, purpose)`);
  })();
  return schemaReady;
}

function normalizeEmail(value: unknown): string { return String(value ?? "").trim().toLowerCase(); }
function validEmail(email: string): boolean { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
function validPassword(password: string): boolean { return password.length >= 8 && password.length <= 128; }

async function smtpCommand(socket: tls.TLSSocket, command: string, expected: number | number[] = 250): Promise<string> {
  const codes = Array.isArray(expected) ? expected : [expected];
  return new Promise((resolve, reject) => {
    let buffer = "";
    const onData = (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const match = line.match(/^(\d{3})([ -])(.*)$/);
        if (!match || match[2] !== " ") continue;
        socket.off("data", onData);
        const code = Number(match[1]);
        if (codes.includes(code)) resolve(line); else reject(new Error(`SMTP ${code}: ${match[3]}`));
        return;
      }
    };
    socket.on("data", onData);
    socket.write(`${command}\r\n`);
  });
}

async function sendEmail(to: string, subject: string, text: string) {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT || 465);
  const user = process.env.SMTP_USER || process.env.GMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD;
  const from = process.env.SMTP_FROM || user;
  if (!user || !pass || !from) throw new Error("Email service is not configured yet.");
  const socket = tls.connect({ host, port, servername: host, rejectUnauthorized: true });
  await new Promise<void>((resolve, reject) => { socket.once("secureConnect", resolve); socket.once("error", reject); });
  try {
    await smtpCommand(socket, "EHLO arvex.host", 250);
    await smtpCommand(socket, "AUTH LOGIN", 334);
    await smtpCommand(socket, Buffer.from(user).toString("base64"), 334);
    await smtpCommand(socket, Buffer.from(pass).toString("base64"), 235);
    await smtpCommand(socket, `MAIL FROM:<${from}>`, 250);
    await smtpCommand(socket, `RCPT TO:<${to}>`, [250, 251]);
    await smtpCommand(socket, "DATA", 354);
    const body = [`From: ArveX Hosting <${from}>`, `To: ${to}`, `Subject: ${subject}`, "MIME-Version: 1.0", "Content-Type: text/plain; charset=UTF-8", "", text, "."].join("\r\n");
    await smtpCommand(socket, body, 250);
    await smtpCommand(socket, "QUIT", 221).catch(() => undefined);
  } finally { socket.end(); }
}

export async function issueCode(userId: string, email: string, purpose: "verify_email" | "login" | "reset_password" | "admin_login") {
  const latest = await db.select().from(verificationCodesTable).where(and(eq(verificationCodesTable.userId, userId), eq(verificationCodesTable.purpose, purpose))).orderBy(desc(verificationCodesTable.createdAt)).limit(1);
  if (latest[0] && Date.now() - latest[0].createdAt.getTime() < CODE_COOLDOWN_MS) throw new Error("Please wait before requesting another code.");
  const code = randomCode();
  await db.delete(verificationCodesTable).where(and(eq(verificationCodesTable.userId, userId), eq(verificationCodesTable.purpose, purpose)));
  await db.insert(verificationCodesTable).values({ id: crypto.randomUUID(), userId, purpose, codeHash: hashCode(code), expiresAt: new Date(Date.now() + CODE_TTL_MS), attempts: "0" });
  const label = purpose === "verify_email" ? "verify your ArveX account" : purpose === "reset_password" ? "reset your ArveX password" : purpose === "admin_login" ? "enter the ArveX Control Room" : "sign in to your ArveX account";
  await sendEmail(email, `ArveX security code: ${code}`, `Your ArveX security code is ${code}.\n\nUse this code to ${label}. It expires in 10 minutes.\n\nIf you did not request this, you can safely ignore this email.`);
}

export async function verifyCode(userId: string, purpose: string, code: string) {
  const [row] = await db.select().from(verificationCodesTable).where(and(eq(verificationCodesTable.userId, userId), eq(verificationCodesTable.purpose, purpose), gt(verificationCodesTable.expiresAt, new Date()))).orderBy(desc(verificationCodesTable.createdAt)).limit(1);
  if (!row) return false;
  const attempts = Number(row.attempts || 0);
  if (attempts >= MAX_ATTEMPTS || !/^\d{6}$/.test(code)) return false;
  const actual = Buffer.from(hashCode(code), "utf8"); const expected = Buffer.from(row.codeHash, "utf8");
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) { await db.update(verificationCodesTable).set({ attempts: String(attempts + 1) }).where(eq(verificationCodesTable.id, row.id)); return false; }
  await db.delete(verificationCodesTable).where(eq(verificationCodesTable.id, row.id));
  return true;
}

async function bootstrapAdmin() {
  const email = normalizeEmail(process.env.ADMIN_EMAIL); const password = process.env.ADMIN_PASSWORD;
  if (!email || !password || !validEmail(email) || !validPassword(password)) return;
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (!existing) await db.insert(usersTable).values({ id: crypto.randomUUID(), email, passwordHash: hashPassword(password), emailVerified: true, role: "admin", firstName: "ArveX", lastName: "Admin" });
  else if (existing.role !== "admin") await db.update(usersTable).set({ role: "admin", passwordHash: hashPassword(password), emailVerified: true }).where(eq(usersTable.id, existing.id));
}

router.use(async (_req, _res, next) => { try { await ensureAuthSchema(); await bootstrapAdmin(); next(); } catch (error) { next(error); } });
router.get("/auth/user", async (req, res) => res.json({ user: req.user ?? null }));

router.post("/auth/signup", async (req, res) => {
  const email = normalizeEmail(req.body?.email); const password = String(req.body?.password ?? ""); const firstName = String(req.body?.firstName ?? "").trim().slice(0, 80) || null; const lastName = String(req.body?.lastName ?? "").trim().slice(0, 80) || null;
  if (!validEmail(email)) return res.status(400).json({ error: "Enter a valid email address." });
  if (!validPassword(password)) return res.status(400).json({ error: "Password must be 8–128 characters." });
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing) return res.status(409).json({ error: existing.emailVerified ? "An account with this email already exists." : "This email is already registered. Request a new verification code." });
  const [user] = await db.insert(usersTable).values({ id: crypto.randomUUID(), email, firstName, lastName, passwordHash: hashPassword(password), emailVerified: false, role: "user" }).returning();
  try { await issueCode(user.id, email, "verify_email"); } catch (error) { await db.delete(usersTable).where(eq(usersTable.id, user.id)); return res.status(503).json({ error: error instanceof Error ? error.message : "Email delivery failed." }); }
  return res.json({ ok: true, challenge: "verify_email", email });
});

router.post("/auth/verify-email", async (req, res) => {
  const email = normalizeEmail(req.body?.email); const code = String(req.body?.code ?? ""); const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (!user) return res.status(404).json({ error: "Account not found." });
  if (user.emailVerified) return res.json({ ok: true });
  if (!(await verifyCode(user.id, "verify_email", code))) return res.status(400).json({ error: "Invalid or expired verification code." });
  const [updated] = await db.update(usersTable).set({ emailVerified: true }).where(eq(usersTable.id, user.id)).returning(); const sid = await createSession(publicUser(updated));
  res.cookie(SESSION_COOKIE, sid, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: SESSION_TTL }); return res.json({ ok: true, user: publicUser(updated) });
});

router.post("/auth/login", async (req, res) => {
  const email = normalizeEmail(req.body?.email); const password = String(req.body?.password ?? ""); const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) return res.status(401).json({ error: "Invalid email or password." });
  if (!user.emailVerified) return res.status(403).json({ error: "Please verify your email before signing in.", challenge: "verify_email" });
  try { await issueCode(user.id, email, "login"); } catch (error) { return res.status(503).json({ error: error instanceof Error ? error.message : "Email delivery failed." }); }
  return res.json({ ok: true, challenge: "login", email, role: user.role });
});

router.post("/auth/verify-login", async (req, res) => {
  const email = normalizeEmail(req.body?.email); const code = String(req.body?.code ?? ""); const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (!user || !user.emailVerified || !(await verifyCode(user.id, "login", code))) return res.status(401).json({ error: "Invalid or expired verification code." });
  const sid = await createSession(publicUser(user)); res.cookie(SESSION_COOKIE, sid, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: SESSION_TTL }); return res.json({ ok: true, user: publicUser(user) });
});

router.post("/auth/resend", async (req, res) => { const email = normalizeEmail(req.body?.email); const purpose = req.body?.purpose === "login" ? "login" : "verify_email"; const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1); if (user) { try { await issueCode(user.id, email, purpose); } catch (error) { return res.status(429).json({ error: error instanceof Error ? error.message : "Please try again later." }); } } return res.json({ ok: true }); });
router.post("/auth/forgot-password", async (req, res) => { const email = normalizeEmail(req.body?.email); const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1); if (user) { try { await issueCode(user.id, email, "reset_password"); } catch {} } return res.json({ ok: true, message: "If that email exists, a reset code has been sent." }); });
router.post("/auth/reset-password", async (req, res) => { const email = normalizeEmail(req.body?.email); const code = String(req.body?.code ?? ""); const password = String(req.body?.password ?? ""); if (!validPassword(password)) return res.status(400).json({ error: "Password must be 8–128 characters." }); const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1); if (!user || !(await verifyCode(user.id, "reset_password", code))) return res.status(400).json({ error: "Invalid or expired reset code." }); await db.update(usersTable).set({ passwordHash: hashPassword(password), emailVerified: true }).where(eq(usersTable.id, user.id)); return res.json({ ok: true }); });
router.get("/logout", async (req, res) => { await clearSession(res, getSessionId(req)); return res.redirect("/"); });

export default router;