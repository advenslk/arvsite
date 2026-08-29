import crypto from "node:crypto";
import { db, sessionsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { Response, Request } from "express";

export const SESSION_COOKIE = "arvex_sid";
export const SESSION_TTL = 7 * 24 * 60 * 60 * 1000;
export type AuthUser = Pick<typeof usersTable.$inferSelect, "id" | "email" | "firstName" | "lastName" | "profileImageUrl" | "emailVerified" | "role">;
export interface SessionData { user: AuthUser; }

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, expected] = stored.split(":");
  if (!salt || !expected) return false;
  const actual = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
}

export function hashCode(code: string): string {
  return crypto.createHash("sha256").update(`${code}:${process.env.AUTH_SECRET ?? "arvex-auth"}`).digest("hex");
}

export function randomCode(): string { return String(crypto.randomInt(100000, 1000000)); }

export async function createSession(user: AuthUser): Promise<string> {
  const sid = crypto.randomBytes(32).toString("hex");
  await db.insert(sessionsTable).values({ sid, sess: { user }, expire: new Date(Date.now() + SESSION_TTL) });
  return sid;
}

export async function getSession(sid: string): Promise<SessionData | null> {
  const [row] = await db.select().from(sessionsTable).where(eq(sessionsTable.sid, sid));
  if (!row || row.expire < new Date()) {
    if (row) await db.delete(sessionsTable).where(eq(sessionsTable.sid, sid));
    return null;
  }
  return row.sess as unknown as SessionData;
}

export async function deleteSession(sid: string) { await db.delete(sessionsTable).where(eq(sessionsTable.sid, sid)); }
export async function clearSession(res: Response, sid?: string) { if (sid) await deleteSession(sid); res.clearCookie(SESSION_COOKIE, { path: "/" }); }
export function getSessionId(req: Request) { return req.cookies?.[SESSION_COOKIE]; }

export function publicUser(user: typeof usersTable.$inferSelect): AuthUser {
  return { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, profileImageUrl: user.profileImageUrl, emailVerified: user.emailVerified, role: user.role };
}