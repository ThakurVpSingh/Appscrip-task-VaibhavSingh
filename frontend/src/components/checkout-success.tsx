"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useNotifications } from "./notification-provider";
import { CustomerQuickLinks } from "./customer-quick-links";
import { authFetch } from "@/lib/api-client";

const apiUrl = process.env.NEXT_PUBLIC_PRODUCTS_API_URL ?? "http://localhost:4000";

function CheckoutConfirmation() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const { modal } = useNotifications();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) {
      setError("The payment confirmation link is missing its checkout reference.");
      setLoading(false);
      return;
    }
    let cancelled = false;
    authFetch(`${apiUrl}/orders/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message ?? "We couldn’t verify your payment.");
      return data as { orderId: string };
    }).then((data) => {
      if (!cancelled) modal("payment-completed", { invoiceHref: `/account/orders/${data.orderId}/invoice` });
    }).catch((confirmError: unknown) => {
      if (!cancelled) setError(confirmError instanceof Error ? confirmError.message : "We couldn’t verify your payment.");
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [sessionId, modal]);

  return (
    <section className="checkout-result" aria-live="polite">
      {loading ? <><p className="eyebrow">One moment</p><h1>Confirming your payment…</h1><p>We’re securely checking your Stripe checkout and saving your order.</p></>
        : error ? <><p className="eyebrow">Payment confirmation</p><h1>We couldn’t confirm that order yet.</h1><p className="form-error" role="alert">{error}</p><Link className="button button-dark" href="/account/login">Sign in and check My orders</Link></>
          : <><p className="eyebrow">Payment received</p><h1>Your order is on its way to our team.</h1><p>We’ve saved the order to your account. Open My orders for item tracking and your printable invoice.</p><Link className="button button-dark" href="/account#orders">View My orders</Link></>}
    </section>
  );
}

export function CheckoutSuccess() {
  return <main className="account-shell account-shell-wide"><header className="account-topbar"><Link className="wordmark" href="/">studio<span>&</span>co.</Link><CustomerQuickLinks /></header><Suspense fallback={<p className="account-loading">Confirming your payment…</p>}><CheckoutConfirmation /></Suspense></main>;
}
