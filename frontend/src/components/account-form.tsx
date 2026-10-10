"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "./cart-provider";
import { useNotifications } from "./notification-provider";
import { setAuthToken } from "@/lib/api-client";

const apiUrl = process.env.NEXT_PUBLIC_PRODUCTS_API_URL ?? "http://localhost:4000";

export function AccountForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const { refreshSession } = useCart();
  const notifications = useNotifications();
  const [error, setError] = useState("");
  const [showRegisterPrompt, setShowRegisterPrompt] = useState(false);
  const [pending, setPending] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const isRegister = mode === "register";

  useEffect(() => setHydrated(true), []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setShowRegisterPrompt(false);
    const form = new FormData(event.currentTarget);
    const payload = {
      ...(isRegister ? { name: String(form.get("name") ?? "") } : {}),
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
    };
    try {
      const response = await fetch(`${apiUrl}/auth/${mode}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        setShowRegisterPrompt(mode === "login" && data.error?.code === "INVALID_CREDENTIALS");
        throw new Error(data.error?.message ?? "We couldn’t complete your request.");
      }
      if (data.token) {
        setAuthToken(data.token);
      }
      await refreshSession(data.customer);
      notifications.modal(isRegister ? "account-registration-completed" : "login-completed", {
        name: data.customer?.name,
        email: data.customer?.email,
      });
      router.push(isRegister ? "/account" : "/cart");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "We couldn’t complete your request.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="account-shell">
      <Link className="wordmark account-wordmark" href="/">studio<span>&</span>co.</Link>
      <section className="account-panel" aria-labelledby="account-title">
        <p className="eyebrow">{isRegister ? "A little more personal" : "Good to have you back"}</p>
        <h1 id="account-title">{isRegister ? "Create your account." : "Welcome back."}</h1>
        <p className="account-intro">{isRegister ? "Keep your bag, details, and considered finds together." : "Sign in to see your saved bag and account details."}</p>
        <form className="account-form" method="post" onSubmit={submit}>
          {isRegister && <label>Full name<input name="name" autoComplete="name" required minLength={2} maxLength={80} /></label>}
          <label>Email address<input id="account-email" name="email" type="email" autoComplete="email" required maxLength={254} aria-invalid={showRegisterPrompt || undefined} aria-describedby={showRegisterPrompt ? "account-auth-error" : undefined} /></label>
          <label>Password<input id="account-password" name="password" type="password" autoComplete={isRegister ? "new-password" : "current-password"} required minLength={isRegister ? 10 : 1} maxLength={128} aria-invalid={showRegisterPrompt || undefined} aria-describedby={showRegisterPrompt ? "account-auth-error" : undefined} />{isRegister && <small>Use at least 10 characters.</small>}</label>
          {error && <div id="account-auth-error" className="form-error" role="alert" aria-live="assertive">
            <span className="inline-error-icon" aria-hidden="true">!</span>
            <span>{mode === "login" && showRegisterPrompt ? "Wrong password or user ID/email address." : error}
              {showRegisterPrompt && <> <Link href="#forgot-password" onClick={(event) => {
                event.preventDefault();
                setError("Password reset is not available yet. If you’re new here, create an account.");
                setShowRegisterPrompt(false);
              }}>Forgot Password?</Link> · <Link href="/account/register">Create an account</Link></>}
              {mode === "register" && error.includes("already exists") && <> <Link href="/account/login">Sign in instead</Link>.</>}
            </span>
          </div>}
          <button className="button button-dark account-submit" type="submit" disabled={pending}>{pending ? "One moment…" : isRegister ? "Create account" : "Sign in"}</button>
        </form>
        <p className="account-switch">{isRegister ? "Already have an account?" : "New to Studio & Co.?"} <Link href={isRegister ? "/account/login" : "/account/register"}>{isRegister ? "Sign in" : "Create an account"}</Link></p>
        <Link className="text-link account-back" href="/">← Continue browsing</Link>
      </section>
    </main>
  );
}
