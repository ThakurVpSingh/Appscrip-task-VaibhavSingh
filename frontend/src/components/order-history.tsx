"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { authFetch } from "@/lib/api-client";

type OrderItem = {
  id: string;
  productId: string;
  productName: string;
  productSlug: string;
  imageUrl: string | null;
  unitPrice: string;
  quantity: number;
  fulfillmentStatus: string;
};
type Order = {
  id: string;
  status: string;
  paymentStatus: string;
  currency: string;
  total: string;
  createdAt: string;
  items: OrderItem[];
};

const apiUrl = process.env.NEXT_PUBLIC_PRODUCTS_API_URL ?? "http://localhost:4000";
const progressSteps = ["PROCESSING", "SHIPPED", "DELIVERED"];
const statusLabel: Record<string, string> = {
  PENDING_PAYMENT: "Awaiting payment",
  PROCESSING: "Processing",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

function money(amount: string | number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: currency.toUpperCase() }).format(Number(amount));
}

export function OrderHistory() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    authFetch(`${apiUrl}/orders`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Your order history could not be loaded.");
        return response.json();
      })
      .then((data) => { if (!cancelled) setOrders(data.orders); })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Your order history could not be loaded.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <section id="orders" className="order-history" aria-labelledby="orders-heading">
      <div className="section-title-row">
        <div><p className="eyebrow">From your bag to your door</p><h2 id="orders-heading">My orders</h2></div>
      </div>
      {loading ? <p className="order-empty" role="status">Loading your orders…</p>
        : error ? <p className="form-error" role="alert">{error}</p>
          : orders.length === 0 ? <p className="order-empty">Your order history will appear here after checkout.</p>
            : <div className="order-list">{orders.map((order) => (
              <article className="order-card" key={order.id}>
                <header className="order-card-header">
                  <div><p className="eyebrow">Order placed</p><strong>{new Date(order.createdAt).toLocaleDateString()}</strong></div>
                  <div><p className="eyebrow">Order number</p><strong>{order.id}</strong></div>
                  <div className="order-total"><p className="eyebrow">Total</p><strong>{money(order.total, order.currency)}</strong></div>
                  <span className={`order-status status-${order.status.toLowerCase()}`}>{statusLabel[order.status] ?? order.status}</span>
                </header>
                <div className="order-card-items">
                  {order.items.map((item) => <div className="order-product" key={item.id}>
                    {item.imageUrl ? <Image src={item.imageUrl} alt="" width={64} height={80} /> : <span className="order-image-placeholder" aria-hidden="true" />}
                    <div className="order-product-copy">
                      <Link href={`/products/${item.productSlug}`}>{item.productName}</Link>
                      <span>Qty {item.quantity} · {money(item.unitPrice, order.currency)} each</span>
                      <span className="order-status-line">Item status: <strong>{statusLabel[item.fulfillmentStatus] ?? item.fulfillmentStatus}</strong></span>
                    </div>
                  </div>)}
                </div>
                {order.paymentStatus === "PAID" && order.status !== "CANCELLED" && (
                  <ol className="tracking-steps" aria-label={`Order tracking: ${statusLabel[order.status] ?? order.status}`}>
                    {progressSteps.map((step) => {
                      const current = progressSteps.indexOf(order.status);
                      const complete = progressSteps.indexOf(step) <= current;
                      return <li className={complete ? "is-complete" : ""} key={step}><span aria-hidden="true" />{statusLabel[step]}</li>;
                    })}
                  </ol>
                )}
                <footer className="order-card-footer">
                  <span>Payment: {order.paymentStatus === "PAID" ? "Paid" : order.paymentStatus.toLowerCase()}</span>
                  {order.paymentStatus === "PAID" && <Link className="text-link" href={`/account/orders/${order.id}/invoice`}>View invoice ↗</Link>}
                </footer>
              </article>
            ))}</div>}
    </section>
  );
}
