import { Router, type IRouter } from "express";
import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import { db, ordersTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";

const router: IRouter = Router();
const SESSION_COOKIE = "arvex_admin_session";
const ADMIN_SESSION_TTL = 8 * 60 * 60 * 1000;

const VPS_PRICES: Record<string, number> = {
  'ARX-VPS-02': 680, 'ARX-VPS-04': 1350, 'ARX-VPS-06': 1950, 'ARX-VPS-08': 2650,
  'ARX-VPS-12': 3850, 'ARX-VPS-16': 5200, 'ARX-VPS-24': 7250, 'ARX-VPS-32': 9500,
  'ARX-VPS-48': 14250, 'ARX-VPS-64': 18500, 'ARX-VPS-96': 24000, 'ARX-VPS-128': 29000,
};

function requiredString(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} is required`);
  }
  return value.trim();
}

function signSession(email: string) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not configured");
  const expiresAt = Date.now() + ADMIN_SESSION_TTL;
  const payload = `${email}:${expiresAt}`;
  const signature = createHmac("sha256", secret).update(payload).digest("hex");
  return `${Buffer.from(payload).toString("base64url")}.${signature}`;
}

function isValidSession(value: string | undefined) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || !value) return false;
  const [encoded, signature] = value.split(".");
  if (!encoded || !signature) return false;
  const payload = Buffer.from(encoded, "base64url").toString("utf8");
  const separator = payload.lastIndexOf(":");
  if (separator < 0) return false;
  const email = payload.slice(0, separator);
  const expiresAt = Number(payload.slice(separator + 1));
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  if (expiresAt < Date.now() || signature.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected)) && email === process.env.ADMIN_EMAIL;
}

router.post("/orders", async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Sign in before placing an order." });
    }
    const name = [req.user.firstName, req.user.lastName].filter(Boolean).join(" ") || "ArveX customer";
    const email = req.user.email;
    if (!email) return res.status(400).json({ message: "Your account does not have an email address." });
    const plan = requiredString(req.body?.plan, "plan");
    const service = requiredString(req.body?.service, "service");
    const region = requiredString(req.body?.region, "region");
    const total = Number(req.body?.total);
    const currency = typeof req.body?.currency === 'string' ? req.body.currency.toUpperCase() : 'USD';
    if (service === 'vps') {
      const expected = VPS_PRICES[plan];
      if (!expected || currency !== 'LKR' || Math.abs(total - expected) > 0.01) {
        return res.status(400).json({ message: 'Invalid VPS plan or price.' });
      }
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: "Enter a valid email address." });
    }
    if (!Number.isFinite(total) || total <= 0) {
      return res.status(400).json({ message: "Order total must be a positive number." });
    }

    const webhook = process.env.DISCORD_WEBHOOK_URL;
    if (!webhook) {
      return res.status(503).json({
        message: "Orders are temporarily unavailable because Discord notifications are not configured.",
      });
    }

    const orderId = `ARX-${randomUUID().slice(0, 8).toUpperCase()}`;
    await db.insert(ordersTable).values({
      id: orderId,
      userId: req.user.id,
      plan,
      service,
      region,
      total: total.toFixed(2),
      status: "received",
    });
    const discordResponse = await fetch(webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username: "ArveX Orders",
        embeds: [{
          title: "New ArveX order",
          color: 0x9c6cff,
          fields: [
            { name: "Order", value: orderId, inline: true },
            { name: "Customer", value: `${name}\n${email}`, inline: true },
            { name: "Service", value: `${service} / ${plan}`, inline: true },
            { name: "Region", value: region, inline: true },
            { name: "Total", value: `${currency} ${total.toFixed(2)} / month`, inline: true },
          ],
          timestamp: new Date().toISOString(),
          footer: { text: "ArveX Hosting order desk" },
        }],
      }),
    });

    if (!discordResponse.ok) {
      await db.update(ordersTable).set({ status: "notification_failed" }).where(eq(ordersTable.id, orderId));
      return res.status(502).json({ message: "Discord could not accept the order notification. Please try again." });
    }

    return res.status(201).json({ orderId, status: "received" });
  } catch (error) {
    return res.status(400).json({ message: error instanceof Error ? error.message : "Invalid order." });
  }
});

router.get("/orders", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Sign in to view orders." });
  const orders = await db.select().from(ordersTable).where(eq(ordersTable.userId, req.user.id)).orderBy(desc(ordersTable.createdAt));
  return res.json({ orders });
});

router.post("/admin/login", (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const configuredEmail = process.env.ADMIN_EMAIL;
  const configuredPassword = process.env.ADMIN_PASSWORD;
  if (!configuredEmail || !configuredPassword || !process.env.SESSION_SECRET) {
    return res.status(503).json({ message: "Admin access is not configured yet." });
  }
  if (email !== configuredEmail || password !== configuredPassword) {
    return res.status(401).json({ message: "Incorrect admin email or password." });
  }
  res.cookie(SESSION_COOKIE, signSession(email), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ADMIN_SESSION_TTL,
    path: "/",
  });
  return res.json({ authenticated: true, email });
});

router.get("/admin/session", (req, res) => {
  const authenticated = isValidSession(req.cookies?.[SESSION_COOKIE]);
  return res.json({ authenticated });
});

router.post("/admin/logout", (_req, res) => {
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: "lax", path: "/" });
  return res.json({ authenticated: false });
});

export default router;