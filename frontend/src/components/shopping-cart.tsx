"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useCart } from "./cart-provider";
import { CartAddressPicker } from "./cart-address-picker";
import { CustomerQuickLinks } from "./customer-quick-links";
import { useNotifications } from "./notification-provider";

const apiUrl = process.env.NEXT_PUBLIC_PRODUCTS_API_URL ?? "http://localhost:4000";

export function ShoppingCart() {
  const { items, itemCount, subtotal, customer, notice, ready, setQuantity, removeItem, clearNotice } = useCart();
  const notifications = useNotifications();
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState("");
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [checkoutPending, setCheckoutPending] = useState(false);

  async function updateQuantity(productId: string, quantity: number) {
    setPendingId(productId);
    setError("");
    try {
      await setQuantity(productId, quantity);
      notifications.toast("quantity-modified");
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "The bag could not be updated.");
    } finally {
      setPendingId("");
    }
  }

  async function deleteItem(productId: string) {
    setPendingId(productId);
    setError("");
    try {
      await removeItem(productId);
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "The item could not be removed.");
    } finally {
      setPendingId("");
    }
  }

  async function startCheckout() {
    setError("");
    setCheckoutPending(true);
    try {
      const response = await fetch(`${apiUrl}/orders/checkout`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addressId: selectedAddressId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message ?? "Secure checkout could not be started.");
      if (typeof data.checkoutUrl !== "string") throw new Error("Secure checkout did not return a payment link.");
      window.location.assign(data.checkoutUrl);
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Secure checkout could not be started.");
      setCheckoutPending(false);
    }
  }

  if (!ready) return <main className="cart-page"><p className="account-loading">Loading your bag…</p></main>;

  return (
    <main className="cart-page">
      <header className="account-topbar"><Link className="wordmark" href="/">studio<span>&</span>co.</Link><CustomerQuickLinks /></header>
      <div className="cart-content">
        {notice && <p className="cart-notice" role="status">{notice}<button type="button" aria-label="Dismiss message" onClick={clearNotice}>×</button></p>}
        <nav className="breadcrumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span>/</span><span aria-current="page">Your bag</span></nav>
        <div className="cart-heading"><div><p className="eyebrow">Thoughtfully picked</p><h1>Your bag <span>({itemCount})</span></h1></div><Link className="text-link" href="/">Keep exploring</Link></div>
        {error && <p className="form-error" role="alert">{error}</p>}
        {items.length === 0 ? <section className="cart-empty"><p>Your bag is enjoying a quiet moment.</p><Link className="button button-dark" href="/">Explore new arrivals</Link></section> :
          <div className="cart-layout">
            <section className="cart-lines" aria-label="Items in your bag">
              {items.map(({ product, quantity }) => <article className="cart-line" key={product.id} aria-busy={pendingId === product.id}>
                <Link className="cart-line-image" href={`/products/${product.slug}`}>
                  {product.images[0] && <Image src={product.images[0].url} alt={product.images[0].alt} fill sizes="120px" />}
                </Link>
                <div className="cart-line-copy">
                  <p className="product-category">{product.category.name}</p>
                  <Link className="cart-line-name" href={`/products/${product.slug}`}>{product.name}</Link>
                  <p className="cart-line-price">${product.price.toFixed(2)}</p>
                  <div className="quantity-control" aria-label={`Quantity for ${product.name}`}>
                    <button type="button" aria-label={`Decrease ${product.name} quantity`} disabled={quantity <= 1 || pendingId === product.id} onClick={() => void updateQuantity(product.id, quantity - 1)}>−</button>
                    <span>{quantity}</span>
                    <button type="button" aria-label={`Increase ${product.name} quantity`} disabled={quantity >= 10 || pendingId === product.id} onClick={() => void updateQuantity(product.id, quantity + 1)}>+</button>
                  </div>
                  <button className="text-button remove-line" type="button" disabled={pendingId === product.id} onClick={() => void deleteItem(product.id)}>Remove</button>
                </div>
                <p className="cart-line-total">${(product.price * quantity).toFixed(2)}</p>
              </article>)}
            </section>
            <aside className="order-summary">
              <p className="eyebrow">The little details</p>
              <h2>Order summary</h2>
              <div><span>Subtotal · {itemCount} {itemCount === 1 ? "item" : "items"}</span><strong>${subtotal.toFixed(2)}</strong></div>
              <div><span>Shipping</span><span>Calculated at checkout</span></div>
              <p className="summary-note">Shipping and taxes are calculated once you choose a delivery address.</p>
              {customer ? <CartAddressPicker selectedId={selectedAddressId} onSelect={setSelectedAddressId} /> :
                <><Link href="/account/login?next=/cart" className="button button-dark checkout-button">Sign in to choose an address</Link><p className="summary-note">Your bag stays on this device. Sign in to save it to your account.</p></>}
              {customer && <>
                <fieldset className="payment-options">
                  <legend>Payment method</legend>
                  <label><input type="radio" name="payment-method" value="stripe" checked readOnly /><span><strong>Credit or debit card</strong><small>Secure payment powered by Stripe</small></span><span className="payment-brands" aria-label="Visa, Mastercard, American Express">VISA · MC · AMEX</span></label>
                </fieldset>
                <button className="button button-dark checkout-button" type="button" disabled={!selectedAddressId || checkoutPending} onClick={() => void startCheckout()}>
                  {checkoutPending ? "Connecting to secure checkout…" : "Place order · pay securely"}
                </button>
                <p className="summary-note">You’ll review and complete payment on Stripe’s secure test checkout. No card details are stored here.</p>
              </>}
              <p className="secure-note">A little more considered, every step of the way.</p>
            </aside>
          </div>}
      </div>
    </main>
  );
}
