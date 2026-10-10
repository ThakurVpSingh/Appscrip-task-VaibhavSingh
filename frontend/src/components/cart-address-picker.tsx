"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
};
const apiUrl = process.env.NEXT_PUBLIC_PRODUCTS_API_URL ?? "http://localhost:4000";

export function CartAddressPicker({ selectedId, onSelect }: { selectedId: string; onSelect: (id: string) => void }) {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    authFetch(`${apiUrl}/addresses`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Saved addresses could not be loaded.");
        return response.json();
      })
      .then((data) => {
        if (!cancelled) {
          setAddresses(data.addresses);
          if (data.addresses[0]) onSelect(data.addresses[0].id);
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Saved addresses could not be loaded.");
      });
    return () => { cancelled = true; };
  }, [onSelect]);

  const selectedAddress = addresses.find((address) => address.id === selectedId);
  return (
    <div className="cart-address-picker">
      <p className="eyebrow">Delivery address</p>
      {addresses.length > 0 ? <>
        <label className="sr-only" htmlFor="delivery-address">Choose a saved delivery address</label>
        <select id="delivery-address" value={selectedId} onChange={(event) => onSelect(event.target.value)}>
          {addresses.map((address) => <option key={address.id} value={address.id}>{address.fullName} · {address.city}, {address.country}</option>)}
        </select>
        {selectedAddress && <address>{selectedAddress.fullName}<br />{selectedAddress.line1}{selectedAddress.line2 ? `, ${selectedAddress.line2}` : ""}<br />{selectedAddress.city}, {selectedAddress.state} {selectedAddress.postalCode}<br />{selectedAddress.country}</address>}
      </> : <p className="summary-note">No delivery address saved yet.</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <Link className="text-link" href="/account#saved-addresses-title">{addresses.length ? "Manage addresses →" : "Add a delivery address →"}</Link>
    </div>
  );
}
