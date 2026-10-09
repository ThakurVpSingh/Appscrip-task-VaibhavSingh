"use client";

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Product } from "@/lib/products";

type CartLine = { product: Product; quantity: number };
type Customer = { id: string; name: string; email: string; createdAt: string };
type CartContextValue = {
  items: CartLine[];
  itemCount: number;
  subtotal: number;
  customer: Customer | null;
  notice: string;
  ready: boolean;
  addItem: (product: Product) => Promise<void>;
  setQuantity: (productId: string, quantity: number) => Promise<void>;
  removeItem: (productId: string) => Promise<void>;
  refreshSession: () => Promise<void>;
  signOut: () => Promise<void>;
  clearNotice: () => void;
};

const apiUrl = process.env.NEXT_PUBLIC_PRODUCTS_API_URL ?? "http://localhost:4000";
const storageKey = "studio-co-guest-cart";
const CartContext = createContext<CartContextValue | null>(null);

function parseItems(value: string | null): CartLine[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as CartLine[];
    return Array.isArray(parsed)
      ? parsed.filter((item) => item?.product?.id && Number.isInteger(item.quantity) && item.quantity > 0)
      : [];
  } catch {
    return [];
  }
}

async function readCart(): Promise<CartLine[]> {
  const response = await fetch(`${apiUrl}/cart`, { credentials: "include" });
  if (!response.ok) throw new Error("Could not load your saved bag.");
  const data = await response.json();
  return data.items.map((item: { product: Product; quantity: number }) => ({
    product: item.product,
    quantity: item.quantity,
  }));
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartLine[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [notice, setNotice] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function initialize() {
      const guestItems = parseItems(localStorage.getItem(storageKey));
      setItems(guestItems);
      try {
        const response = await fetch(`${apiUrl}/auth/me`, { credentials: "include" });
        if (response.ok) {
          const data = await response.json();
          const serverItems = await readCart();
          if (!cancelled) {
            setCustomer(data.customer);
            setItems(serverItems);
            localStorage.removeItem(storageKey);
          }
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    }
    void initialize().catch((error: unknown) => console.error("Could not initialize customer session", error));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!ready || customer) return;
    localStorage.setItem(storageKey, JSON.stringify(items));
  }, [customer, items, ready]);

  const refreshSession = useCallback(async () => {
    const response = await fetch(`${apiUrl}/auth/me`, { credentials: "include" });
    if (!response.ok) throw new Error("Your account session could not be loaded.");
    const data = await response.json();
    const guestItems = parseItems(localStorage.getItem(storageKey));
    let skippedItems = false;
    for (const item of guestItems) {
      const addResponse = await fetch(`${apiUrl}/cart/items`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: item.product.id, quantity: item.quantity }),
      });
      if (addResponse.status === 404) {
        skippedItems = true;
        continue;
      }
      if (!addResponse.ok) throw new Error("Your guest bag could not be saved to your account.");
    }
    const serverItems = await readCart();
    localStorage.removeItem(storageKey);
    setCustomer(data.customer);
    setItems(serverItems);
    setReady(true);
    if (skippedItems) setNotice("Some items in your previous bag are no longer available and weren’t transferred.");
  }, []);

  const addItem = useCallback(async (product: Product) => {
    if (customer) {
      const response = await fetch(`${apiUrl}/cart/items`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id, quantity: 1 }),
      });
      if (!response.ok) throw new Error("Could not add this item to your saved bag.");
      setItems(await readCart());
      return;
    }
    setItems((current) => {
      const found = current.find((item) => item.product.id === product.id);
      return found
        ? current.map((item) => item.product.id === product.id ? { ...item, quantity: Math.min(10, item.quantity + 1) } : item)
        : [...current, { product, quantity: 1 }];
    });
  }, [customer]);

  const setQuantity = useCallback(async (productId: string, quantity: number) => {
    if (quantity < 1 || quantity > 10) return;
    if (customer) {
      const response = await fetch(`${apiUrl}/cart/items/${encodeURIComponent(productId)}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity }),
      });
      if (!response.ok) throw new Error("Could not update this item's quantity.");
      setItems(await readCart());
      return;
    }
    setItems((current) => current.map((item) => item.product.id === productId ? { ...item, quantity } : item));
  }, [customer]);

  const removeItem = useCallback(async (productId: string) => {
    if (customer) {
      const response = await fetch(`${apiUrl}/cart/items/${encodeURIComponent(productId)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Could not remove this item.");
    }
    setItems((current) => current.filter((item) => item.product.id !== productId));
  }, [customer]);

  const signOut = useCallback(async () => {
    const response = await fetch(`${apiUrl}/auth/logout`, { method: "POST", credentials: "include" });
    if (!response.ok) throw new Error("Could not sign out.");
    setCustomer(null);
  }, []);

  const clearNotice = useCallback(() => setNotice(""), []);

  const value = useMemo(() => ({
    items,
    itemCount: items.reduce((total, item) => total + item.quantity, 0),
    subtotal: items.reduce((total, item) => total + item.product.price * item.quantity, 0),
    customer,
    notice,
    ready,
    addItem,
    setQuantity,
    removeItem,
    refreshSession,
    signOut,
    clearNotice,
  }), [items, customer, notice, ready, addItem, setQuantity, removeItem, refreshSession, signOut, clearNotice]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside CartProvider");
  return context;
}
