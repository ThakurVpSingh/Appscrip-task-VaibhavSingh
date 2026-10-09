import type { Metadata } from "next";
import { CartProvider } from "@/components/cart-provider";
import { NotificationProvider } from "@/components/notification-provider";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "New Season Clothing | Studio & Co.",
    template: "%s | Studio & Co.",
  },
  description:
    "Discover considered everyday essentials, thoughtfully made with a lighter footprint. Shop the latest arrivals at Studio & Co.",
  openGraph: {
    title: "New Season Clothing | Studio & Co.",
    description: "Everyday essentials, thoughtfully made.",
    type: "website",
    siteName: "Studio & Co.",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><CartProvider><NotificationProvider>{children}</NotificationProvider></CartProvider></body>
    </html>
  );
}
