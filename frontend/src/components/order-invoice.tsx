"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CustomerQuickLinks } from "./customer-quick-links";

type InvoiceOrder = {
  id: string;
  status: string;
  paymentStatus: string;
  currency: string;
  total: string;
  createdAt: string;
  paidAt: string | null;
  addressFullName: string;
  addressLine1: string;
  addressLine2: string | null;
  addressCity: string;
  addressState: string;
  addressPostalCode: string;
  addressCountry: string;
  items: { id: string; productName: string; imageUrl: string | null; unitPrice: string; quantity: number }[];
};

const apiUrl = process.env.NEXT_PUBLIC_PRODUCTS_API_URL ?? "http://localhost:4000";
const money = (amount: string | number, currency: string) => new Intl.NumberFormat(undefined, { style: "currency", currency: currency.toUpperCase() }).format(Number(amount));

export function OrderInvoice() {
  const params = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<InvoiceOrder | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`${apiUrl}/orders/${encodeURIComponent(params.orderId)}`, { credentials: "include" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message ?? "Invoice could not be loaded.");
        return data.order as InvoiceOrder;
      })
      .then((data) => { if (!cancelled) setOrder(data); })
      .catch((loadError: unknown) => { if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Invoice could not be loaded."); });
    return () => { cancelled = true; };
  }, [params.orderId]);

  return (
    <main className="account-shell account-shell-wide invoice-page">
      <header className="account-topbar no-print"><Link className="wordmark" href="/">studio<span>&</span>co.</Link><CustomerQuickLinks /></header>
      <div className="invoice-wrap">
        <div className="invoice-actions no-print"><Link className="text-link" href="/account#orders">← My orders</Link>{order?.paymentStatus === "PAID" && <button className="button button-dark" type="button" onClick={() => window.print()}>Print invoice</button>}</div>
        {error ? <p className="form-error" role="alert">{error}</p> : !order ? <p className="account-loading" role="status">Loading invoice…</p> : (
          <article className="invoice-document">
            <header className="invoice-heading"><div><Link className="wordmark" href="/">studio<span>&</span>co.</Link><p>Thoughtfully chosen. Carefully packed.</p></div><div><p className="eyebrow">Payment receipt</p><h1>Invoice</h1><strong>{order.id}</strong></div></header>
            <div className="invoice-meta"><div><p className="eyebrow">Order date</p><strong>{new Date(order.createdAt).toLocaleDateString()}</strong></div><div><p className="eyebrow">Payment status</p><strong>{order.paymentStatus === "PAID" ? "Paid" : order.paymentStatus}</strong></div><div><p className="eyebrow">Delivery address</p><strong>{order.addressFullName}</strong><span>{order.addressLine1}{order.addressLine2 ? `, ${order.addressLine2}` : ""}</span><span>{order.addressCity}, {order.addressState} {order.addressPostalCode}</span><span>{order.addressCountry}</span></div></div>
            <div className="invoice-lines">
              {order.items.map((item) => <div className="invoice-line" key={item.id}>
                {item.imageUrl && <Image src={item.imageUrl} alt="" width={52} height={65} />}
                <strong>{item.productName}</strong><span>{item.quantity} × {money(item.unitPrice, order.currency)}</span><strong>{money(Number(item.unitPrice) * item.quantity, order.currency)}</strong>
              </div>)}
            </div>
            <div className="invoice-total"><span>Total paid</span><strong>{money(order.total, order.currency)}</strong></div>
            <p className="invoice-footnote">Thank you for shopping with Studio &amp; Co. This invoice confirms your recorded order and payment.</p>
          </article>
        )}
      </div>
    </main>
  );
}
