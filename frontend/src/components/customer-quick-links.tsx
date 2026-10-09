"use client";

import Link from "next/link";
import { useCart } from "./cart-provider";

export function CustomerQuickLinks() {
  const { customer, itemCount } = useCart();
  return <nav className="customer-quick-links"><Link href="/">New arrivals</Link><Link href={customer ? "/account" : "/account/login"}>{customer ? "My account" : "Account"}</Link><Link href="/cart">Your bag ({itemCount})</Link></nav>;
}
