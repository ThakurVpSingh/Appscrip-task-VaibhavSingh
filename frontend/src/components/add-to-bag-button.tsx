"use client";

import { useState } from "react";
import type { Product } from "@/lib/products";
import { useCart } from "./cart-provider";
import { useNotifications } from "./notification-provider";

export function AddToBagButton({ product }: { product: Product }) {
  const { addItem } = useCart();
  const notifications = useNotifications();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function add() {
    setPending(true);
    setMessage("");
    try {
      await addItem(product);
      setMessage("Added to your bag.");
      notifications.toast("cart-added", product);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "This item could not be added.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button className="button button-dark add-to-bag" type="button" onClick={() => void add()} disabled={pending}>
        {pending ? "Adding…" : "Add to bag"}
      </button>
      <p className="bag-feedback" role="status" aria-live="polite">{message}</p>
    </>
  );
}
