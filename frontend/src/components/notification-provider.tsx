"use client";

import Image from "next/image";
import Link from "next/link";
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Product } from "@/lib/products";

type ToastKind = "cart-added" | "address-saved" | "quantity-modified";
type ModalKind = "payment-completed" | "account-registration-completed" | "login-completed";
type Toast = { id: number; kind: ToastKind; product?: Product };
type Modal = { kind: ModalKind; name?: string; email?: string; invoiceHref?: string };

type NotificationContextValue = {
  toast: (kind: ToastKind, product?: Product) => void;
  modal: (kind: ModalKind, details?: { name?: string; email?: string; invoiceHref?: string }) => void;
  dismissModal: () => void;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);
const toastCopy: Record<ToastKind, string> = {
  "cart-added": "Item added to cart",
  "address-saved": "Address saved",
  "quantity-modified": "Quantity modified",
};

function CheckIcon() {
  return <svg aria-hidden="true" viewBox="0 0 20 20" className="notification-icon"><path d="m4 10 4 4 8-8" /></svg>;
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [activeModal, setActiveModal] = useState<Modal | null>(null);
  const nextId = useRef(0);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);
  const dismissModal = useCallback(() => setActiveModal(null), []);
  const toast = useCallback((kind: ToastKind, product?: Product) => {
    const id = ++nextId.current;
    setToasts((current) => [...current, { id, kind, product }].slice(-4));
  }, []);
  const modal = useCallback((kind: ModalKind, details?: { name?: string; email?: string; invoiceHref?: string }) => {
    setActiveModal({ kind, ...details });
  }, []);

  const value = useMemo(() => ({ toast, modal, dismissModal }), [toast, modal, dismissModal]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <div className="notification-stack" aria-label="Notifications">
        {toasts.map((item) => (
          <ToastItem key={item.id} toast={item} onDismiss={dismissToast} />
        ))}
      </div>
      {activeModal && <CelebrationModal modal={activeModal} onDismiss={dismissModal} />}
    </NotificationContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timeout = window.setTimeout(() => onDismiss(toast.id), 4000);
    return () => window.clearTimeout(timeout);
  }, [toast.id, onDismiss]);

  return (
    <article className="notification-toast" role="status" aria-live="polite">
      <CheckIcon />
      {toast.kind === "cart-added" && toast.product?.images[0] && (
        <Image className="notification-thumbnail" src={toast.product.images[0].url} alt="" width={48} height={60} />
      )}
      <div className="notification-copy">
        <strong>{toastCopy[toast.kind]}</strong>
        {toast.kind === "cart-added" && toast.product && <span>{toast.product.name}</span>}
      </div>
      {toast.kind === "cart-added" && <Link href="/cart" className="notification-action">View Cart</Link>}
      <button className="notification-dismiss" type="button" aria-label="Dismiss notification" onClick={() => onDismiss(toast.id)}>×</button>
      <span className="notification-progress" aria-hidden="true" />
    </article>
  );
}

function CelebrationModal({ modal, onDismiss }: { modal: Modal; onDismiss: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const isPayment = modal.kind === "payment-completed";
  const isRegistration = modal.kind === "account-registration-completed";
  const title = isPayment ? "Payment completed" : isRegistration ? "Welcome to Studio & Co." : "You’re signed in";
  const description = isPayment
    ? "Your order is confirmed. Thank you for choosing more considered pieces."
    : isRegistration
      ? `Your account is ready${modal.name ? `, ${modal.name.split(" ")[0]}` : ""}. Your details and saved bag are now together.`
      : `Welcome back${modal.name ? `, ${modal.name.split(" ")[0]}` : ""}. Your saved details are ready.`;

  useEffect(() => {
    const dialog = dialogRef.current;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onDismiss();
      if (event.key === "Tab" && dialog) {
        const controls = dialog.querySelectorAll<HTMLElement>("button, a[href]");
        if (!controls.length) return;
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus();
    };
  }, [onDismiss]);

  return (
    <div className="notification-overlay">
      <section
        ref={dialogRef}
        className={`celebration-modal${isPayment ? " celebration-payment" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="celebration-title"
        aria-describedby="celebration-description"
        tabIndex={-1}
      >
        <button className="celebration-close" type="button" aria-label="Close message" onClick={onDismiss}>×</button>
        {isPayment ? <div className="confetti-slot" aria-hidden="true">{Array.from({ length: 12 }, (_, index) => <i key={index} />)}</div> :
          <div className={`celebration-symbol${isRegistration ? " welcome-symbol" : " login-symbol"}`} aria-hidden="true">
            {isRegistration ? <span>✦</span> : <span>{modal.name?.slice(0, 1).toUpperCase() || "✓"}</span>}
          </div>}
        <p className="eyebrow">{isPayment ? "A lovely choice" : isRegistration ? "A little more personal" : "Good to have you back"}</p>
        <h2 id="celebration-title">{title}</h2>
        <p id="celebration-description">{description}</p>
        {modal.email && <p className="celebration-email">{modal.email}</p>}
        {isPayment
          ? modal.invoiceHref
            ? <Link className="button button-dark celebration-cta" href={modal.invoiceHref} onClick={onDismiss}>Open &amp; print receipt</Link>
            : <button className="button button-dark celebration-cta" type="button" onClick={() => window.print()}>Print receipt</button>
          : <Link className="button button-dark celebration-cta" href="/account" onClick={onDismiss}>{isRegistration ? "Complete your profile" : "Go to your account"}</Link>}
      </section>
    </div>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error("useNotifications must be used inside NotificationProvider");
  return context;
}
