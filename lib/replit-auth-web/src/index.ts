import { useCallback, useEffect, useState } from "react";

export interface AuthUser { id: string; email: string | null; firstName: string | null; lastName: string | null; profileImageUrl: string | null; emailVerified: boolean; role: string; }

type ApiResult = { ok?: boolean; error?: string; challenge?: string; email?: string; role?: string; message?: string; user?: AuthUser };

async function api(path: string, body: Record<string, unknown>): Promise<ApiResult> {
  const response = await fetch(path, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.error || "Request failed"), { data });
  return data;
}

function root(): HTMLElement | null { return document.querySelector(".auth-form-wrap"); }
function escapeHtml(value: string): string { return value.replace(/[&<>\"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]!)); }
function errorBox(message: string) { const old = document.querySelector("[data-auth-error]"); old?.remove(); const el = document.createElement("div"); el.dataset.authError = "1"; el.style.cssText = "margin:12px 0;padding:12px;border:1px solid rgba(255,90,90,.35);border-radius:10px;color:#ff9d9d;background:rgba(255,70,70,.07);font-size:13px"; el.textContent = message; root()?.querySelector("form")?.before(el); }
function setBusy(form: HTMLFormElement, busy: boolean) { const button = form.querySelector<HTMLButtonElement>("button[type=submit]"); if (button) { button.disabled = busy; button.style.opacity = busy ? ".65" : "1"; } }

function renderCode(email: string, purpose: "verify_email" | "login", returnTo: string) {
  const r = root(); if (!r) return;
  r.innerHTML = `<div class="auth-form-head"><p class="eyebrow">EMAIL VERIFICATION</p><h2>Check your inbox.</h2><p>We sent a 6-digit code to <strong>${escapeHtml(email)}</strong>. The code expires in 10 minutes.</p></div><form class="settings-form" data-auth-code-form><label>VERIFICATION CODE<input inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" required placeholder="000000" data-auth-code /></label><button class="btn btn-primary auth-submit" type="submit">Verify code <span>→</span></button></form><p class="auth-switch"><button type="button" data-resend style="background:none;border:0;color:inherit;text-decoration:underline;cursor:pointer">Resend code</button> · <button type="button" data-back style="background:none;border:0;color:inherit;text-decoration:underline;cursor:pointer">Back</button></p>`;
  const form = r.querySelector<HTMLFormElement>("[data-auth-code-form]")!;
  form.addEventListener("submit", async e => { e.preventDefault(); setBusy(form, true); try { const code = (form.querySelector("[data-auth-code]") as HTMLInputElement).value; const result = await api(purpose === "login" ? "/api/auth/verify-login" : "/api/auth/verify-email", { email, code }); if (result.ok) window.location.href = returnTo || "/dashboard"; } catch (e) { errorBox(e instanceof Error ? e.message : "Invalid code"); } finally { setBusy(form, false); } });
  r.querySelector("[data-resend]")?.addEventListener("click", async () => { try { await api("/api/auth/resend", { email, purpose }); } catch (e) { errorBox(e instanceof Error ? e.message : "Unable to resend code"); } });
  r.querySelector("[data-back]")?.addEventListener("click", () => renderAuthForm(purpose === "verify_email" ? "register" : "login", returnTo));
}

function renderAuthForm(mode: "login" | "register", returnTo = "/dashboard") {
  const r = root(); if (!r) return;
  const register = mode === "register";
  r.innerHTML = `<div class="auth-form-head"><p class="eyebrow">${register ? "CREATE YOUR ACCOUNT" : "WELCOME BACK"}</p><h2>${register ? "Build from here." : "Good to see you."}</h2><p>${register ? "Create your ArveX client account. We’ll verify your email before activating it." : "Sign in with your ArveX email and password. A verification code will be sent to your email."}</p></div><form class="settings-form" data-auth-form>${register ? `<label>FIRST NAME<input name="firstName" autocomplete="given-name" maxlength="80" required placeholder="Your first name" /></label><label>LAST NAME<input name="lastName" autocomplete="family-name" maxlength="80" placeholder="Your last name" /></label>` : ""}<label>EMAIL ADDRESS<input name="email" type="email" autocomplete="email" required placeholder="you@example.com" /></label><label>PASSWORD<input name="password" type="password" autocomplete="${register ? "new-password" : "current-password"}" minlength="8" maxlength="128" required placeholder="At least 8 characters" /></label><button class="btn btn-primary auth-submit" type="submit">${register ? "Create account" : "Sign in"} <span>→</span></button></form><div class="auth-extra-links">${!register ? `<button type="button" data-forgot>Forgot password?</button>` : ""}</div><p class="auth-switch">${register ? "Already have an account?" : "Need an account?"} <button type="button" data-switch>${register ? "Sign in" : "Create an account"}</button></p>`;
  const form = r.querySelector<HTMLFormElement>("[data-auth-form]")!;
  form.addEventListener("submit", async e => { e.preventDefault(); setBusy(form, true); try { const fd = new FormData(form); const body: Record<string, unknown> = Object.fromEntries(fd.entries()); const result = await api(register ? "/api/auth/signup" : "/api/auth/login", body); renderCode(String(result.email), register ? "verify_email" : "login", returnTo); } catch (e) { errorBox(e instanceof Error ? e.message : "Unable to continue"); } finally { setBusy(form, false); } });
  r.querySelector("[data-switch]")?.addEventListener("click", () => renderAuthForm(register ? "login" : "register", returnTo));
  r.querySelector("[data-forgot]")?.addEventListener("click", () => renderForgot(returnTo));
}

function renderForgot(returnTo: string) {
  const r = root(); if (!r) return;
  r.innerHTML = `<div class="auth-form-head"><p class="eyebrow">PASSWORD RESET</p><h2>Reset your password.</h2><p>Enter your account email and we’ll send a one-time reset code.</p></div><form class="settings-form" data-forgot-form><label>EMAIL ADDRESS<input name="email" type="email" required placeholder="you@example.com" /></label><button class="btn btn-primary auth-submit" type="submit">Send reset code <span>→</span></button></form><p class="auth-switch"><button type="button" data-back-login>Back to sign in</button></p>`;
  const form = r.querySelector<HTMLFormElement>("[data-forgot-form]")!;
  form.addEventListener("submit", async e => { e.preventDefault(); setBusy(form, true); try { const email = String(new FormData(form).get("email")); await api("/api/auth/forgot-password", { email }); renderReset(email, returnTo); } catch (e) { errorBox(e instanceof Error ? e.message : "Unable to send reset code"); } finally { setBusy(form, false); } });
  r.querySelector("[data-back-login]")?.addEventListener("click", () => renderAuthForm("login", returnTo));
}

function renderReset(email: string, returnTo: string) {
  const r = root(); if (!r) return;
  r.innerHTML = `<div class="auth-form-head"><p class="eyebrow">PASSWORD RESET</p><h2>Choose a new password.</h2><p>Enter the reset code sent to <strong>${escapeHtml(email)}</strong>.</p></div><form class="settings-form" data-reset-form><label>RESET CODE<input name="code" inputmode="numeric" maxlength="6" pattern="[0-9]{6}" required placeholder="000000" /></label><label>NEW PASSWORD<input name="password" type="password" minlength="8" maxlength="128" required placeholder="At least 8 characters" /></label><button class="btn btn-primary auth-submit" type="submit">Update password <span>→</span></button></form>`;
  const form = r.querySelector<HTMLFormElement>("[data-reset-form]")!;
  form.addEventListener("submit", async e => { e.preventDefault(); setBusy(form, true); try { const body = Object.fromEntries(new FormData(form).entries()); body.email = email; await api("/api/auth/reset-password", body); renderAuthForm("login", returnTo); } catch (e) { errorBox(e instanceof Error ? e.message : "Unable to reset password"); } finally { setBusy(form, false); } });
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setLoading] = useState(true);
  useEffect(() => { fetch("/api/auth/user", { credentials: "include" }).then(r => r.json()).then(data => setUser(data.user ?? null)).catch(() => setUser(null)).finally(() => setLoading(false)); }, []);
  const login = useCallback(() => {
    const path = window.location.pathname;
    const returnTo = new URLSearchParams(window.location.search).get("returnTo") || (path === "/login" || path === "/register" ? "/dashboard" : path);
    if (path === "/login" || path === "/register") renderAuthForm(path === "/register" ? "register" : "login", returnTo);
    else window.location.href = `/login?returnTo=${encodeURIComponent(returnTo)}`;
  }, []);
  const logout = useCallback(() => { window.location.href = "/api/logout"; }, []);
  return { user, isLoading, isAuthenticated: Boolean(user), login, logout };
}