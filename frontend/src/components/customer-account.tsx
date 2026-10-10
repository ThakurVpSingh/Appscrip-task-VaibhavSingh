"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "./cart-provider";
import { GoogleAddressForm } from "./google-address-form";
import { CustomerQuickLinks } from "./customer-quick-links";
import { OrderHistory } from "./order-history";
import { authFetch } from "@/lib/api-client";

type Address = {
  id: string;
  fullName: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  latitude?: number | null;
  longitude?: number | null;
};
const apiUrl = process.env.NEXT_PUBLIC_PRODUCTS_API_URL ?? "http://localhost:4000";

export function CustomerAccount() {
  const router = useRouter();
  const { customer, notice, ready, signOut, clearNotice } = useCart();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [error, setError] = useState("");

  const loadAddresses = useCallback(async () => {
    const response = await authFetch(`${apiUrl}/addresses`);
    if (!response.ok) throw new Error("Saved addresses could not be loaded.");
    const data = await response.json();
    setAddresses(data.addresses);
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!customer) {
      router.replace("/account/login");
      return;
    }
    void loadAddresses().catch((loadError: unknown) => {
      setError(loadError instanceof Error ? loadError.message : "Saved addresses could not be loaded.");
    });
  }, [customer, ready, router, loadAddresses]);

  async function deleteAddress(id: string) {
    try {
      const response = await authFetch(`${apiUrl}/addresses/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("This address could not be removed.");
      setAddresses((current) => current.filter((address) => address.id !== id));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "This address could not be removed.");
    }
  }

  async function handleSignOut() {
    try {
      await signOut();
      router.push("/");
      router.refresh();
    } catch (signOutError) {
      setError(signOutError instanceof Error ? signOutError.message : "Could not sign out.");
    }
  }

  if (!ready || !customer) return <main className="account-shell"><p className="account-loading">Loading your account…</p></main>;
  return (
    <main className="account-shell account-shell-wide">
      <header className="account-topbar"><Link className="wordmark" href="/">studio<span>&</span>co.</Link><CustomerQuickLinks /></header>
      <div className="account-dashboard">
        {notice && <p className="cart-notice" role="status">{notice}<button type="button" aria-label="Dismiss message" onClick={clearNotice}>×</button></p>}
        <section className="account-welcome">
          <div><p className="eyebrow">Your Studio &amp; Co.</p><h1>Good to see you, {customer.name.split(" ")[0]}.</h1><p>{customer.email}</p></div>
          <button className="text-button" onClick={() => void handleSignOut()}>Sign out</button>
        </section>
        <section className="saved-addresses" aria-labelledby="saved-addresses-title">
          <div className="section-title-row"><div><p className="eyebrow">A little more personal</p><h2 id="saved-addresses-title">Your addresses</h2></div><button className="button button-dark" onClick={() => setShowAddressForm(!showAddressForm)}>{showAddressForm ? "Close" : "Add an address"}</button></div>
              {error && <p className="form-error" role="alert">{error}</p>}
          {showAddressForm && <GoogleAddressForm onSaved={(address) => { setAddresses((current) => [address, ...current]); setShowAddressForm(false); }} />}
          {addresses.length === 0 && !showAddressForm ? <p className="no-addresses">You haven’t saved an address yet. Add one to make future checkouts easier.</p> :
            <div className="address-grid">{addresses.map((address) => <article className="saved-address" key={address.id}>
              <h3>{address.fullName}</h3><p>{address.line1}{address.line2 ? `, ${address.line2}` : ""}<br />{address.city}, {address.state} {address.postalCode}<br />{address.country}</p>
              {address.latitude != null && address.longitude != null && <a target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${address.latitude},${address.longitude}`}>View on map ↗</a>}
              <button className="text-button address-remove" onClick={() => void deleteAddress(address.id)}>Remove</button>
            </article>)}</div>}
        </section>
        <section className="account-bag-preview"><div><p className="eyebrow">Ready when you are</p><h2>Your saved bag</h2></div><Link className="text-link" href="/cart">View your bag →</Link></section>
        <OrderHistory />
      </div>
    </main>
  );
}
