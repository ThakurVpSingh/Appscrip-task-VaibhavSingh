import { createHash, timingSafeEqual } from "node:crypto";
import { Request, Response, Router } from "express";
import Stripe from "stripe";
import { z } from "zod";
import { requireCustomer } from "./auth";
import { prisma } from "./db";

export const ordersRouter = Router();
export const orderAdminRouter = Router();

function stripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  return key ? new Stripe(key) : null;
}

function cents(amount: number) {
  return Math.round(amount * 100);
}

async function markOrderPaid(session: Stripe.Checkout.Session) {
  const orderId = session.metadata?.orderId;
  const customerId = session.metadata?.customerId;
  if (!orderId || !customerId || session.payment_status !== "paid") return null;

  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: { id: orderId, customerId, stripeCheckoutSessionId: session.id },
    });
    if (!order) return null;
    if (order.paymentStatus === "PAID") return order;

    const paymentIntentId = typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;
    await tx.order.update({
      where: { id: order.id },
      data: {
        status: "PROCESSING",
        paymentStatus: "PAID",
        stripePaymentIntentId: paymentIntentId,
        paidAt: new Date(),
      },
    });
    await tx.orderItem.updateMany({
      where: { orderId: order.id },
      data: { fulfillmentStatus: "PROCESSING" },
    });
    await tx.cartItem.deleteMany({ where: { customerId } });
    return tx.order.findUnique({ where: { id: order.id } });
  });
}

ordersRouter.post("/checkout", requireCustomer, async (request, response, next) => {
  try {
    const stripe = stripeClient();
    if (!stripe) {
      response.status(503).json({
        error: { code: "PAYMENTS_NOT_CONFIGURED", message: "Stripe test checkout is not configured. Add STRIPE_SECRET_KEY to backend/.env." },
      });
      return;
    }

    const { addressId } = z.object({ addressId: z.string().min(1).max(100) }).parse(request.body);
    const customerId = response.locals.customerId as string;
    const [address, cart] = await Promise.all([
      prisma.customerAddress.findFirst({ where: { id: addressId, customerId } }),
      prisma.cartItem.findMany({
        where: { customerId },
        include: { product: { include: { images: { orderBy: { position: "asc" }, take: 1 } } } },
        orderBy: { createdAt: "asc" },
      }),
    ]);
    if (!address) {
      response.status(404).json({ error: { code: "ADDRESS_NOT_FOUND", message: "Choose a saved delivery address before checkout." } });
      return;
    }
    if (cart.length === 0) {
      response.status(409).json({ error: { code: "CART_EMPTY", message: "Add an item to your bag before checkout." } });
      return;
    }

    const currency = (process.env.STRIPE_CURRENCY ?? "usd").toLowerCase();
    if (!/^[a-z]{3}$/.test(currency)) {
      throw new Error("STRIPE_CURRENCY must be a 3-letter ISO currency code.");
    }
    const total = cart.reduce((sum, item) => sum + Number(item.product.price) * item.quantity, 0);
    const order = await prisma.order.create({
      data: {
        customerId,
        total: total.toFixed(2),
        currency,
        addressFullName: address.fullName,
        addressLine1: address.line1,
        addressLine2: address.line2,
        addressCity: address.city,
        addressState: address.state,
        addressPostalCode: address.postalCode,
        addressCountry: address.country,
        items: {
          create: cart.map(({ product, quantity }) => ({
            productId: product.id,
            productName: product.name,
            productSlug: product.slug,
            imageUrl: product.images[0]?.url,
            unitPrice: product.price,
            quantity,
          })),
        },
      },
    });

    const origin = request.get("origin") ?? process.env.SITE_ORIGIN ?? process.env.FRONTEND_ORIGIN?.split(",")[0];
    if (!origin) {
      await prisma.order.delete({ where: { id: order.id } });
      response.status(500).json({ error: { code: "SITE_ORIGIN_MISSING", message: "The storefront origin is not configured." } });
      return;
    }
    try {
      const checkoutSession = await stripe.checkout.sessions.create({
        mode: "payment",
        client_reference_id: customerId,
        customer_email: (await prisma.customer.findUniqueOrThrow({ where: { id: customerId }, select: { email: true } })).email,
        line_items: cart.map(({ product, quantity }) => ({
          quantity,
          price_data: {
            currency,
            unit_amount: cents(Number(product.price)),
            product_data: {
              name: product.name,
              ...(product.images[0]?.url.startsWith("https://") ? { images: [product.images[0].url] } : {}),
              metadata: { productId: product.id },
            },
          },
        })),
        metadata: { orderId: order.id, customerId },
        payment_intent_data: { metadata: { orderId: order.id, customerId } },
        success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/cart?checkout=cancelled`,
      });
      if (!checkoutSession.url) throw new Error("Stripe did not return a checkout URL.");
      await prisma.order.update({
        where: { id: order.id },
        data: { stripeCheckoutSessionId: checkoutSession.id },
      });
      response.status(201).json({ checkoutUrl: checkoutSession.url });
    } catch (error) {
      await prisma.order.delete({ where: { id: order.id } });
      response.status(502).json({ error: { code: "CHECKOUT_UNAVAILABLE", message: "Secure checkout could not be started. Please try again." } });
      console.error("Stripe checkout session could not be created", error);
    }
  } catch (error) {
    next(error);
  }
});

ordersRouter.post("/confirm", requireCustomer, async (request, response, next) => {
  try {
    const { sessionId } = z.object({ sessionId: z.string().min(1).max(255) }).parse(request.body);
    const customerId = response.locals.customerId as string;
    const order = await prisma.order.findFirst({
      where: { stripeCheckoutSessionId: sessionId, customerId },
      select: { id: true },
    });
    if (!order) {
      response.status(404).json({ error: { code: "ORDER_NOT_FOUND", message: "This checkout session does not belong to your account." } });
      return;
    }
    const stripe = stripeClient();
    if (!stripe) {
      response.status(503).json({ error: { code: "PAYMENTS_NOT_CONFIGURED", message: "Payment verification is not configured." } });
      return;
    }
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.metadata?.orderId !== order.id || session.metadata?.customerId !== customerId) {
      response.status(403).json({ error: { code: "CHECKOUT_MISMATCH", message: "Payment verification failed." } });
      return;
    }
    if (session.payment_status !== "paid") {
      response.status(409).json({ error: { code: "PAYMENT_NOT_COMPLETE", message: "Payment has not been completed." } });
      return;
    }
    await markOrderPaid(session);
    response.json({ orderId: order.id });
  } catch (error) {
    next(error);
  }
});

ordersRouter.get("/", requireCustomer, async (_request, response, next) => {
  try {
    const orders = await prisma.order.findMany({
      where: { customerId: response.locals.customerId as string },
      include: { items: { orderBy: { createdAt: "asc" } } },
      orderBy: { createdAt: "desc" },
    });
    response.json({ orders });
  } catch (error) {
    next(error);
  }
});

ordersRouter.get("/:orderId", requireCustomer, async (request, response, next) => {
  try {
    const { orderId } = z.object({ orderId: z.string().min(1).max(100) }).parse(request.params);
    const order = await prisma.order.findFirst({
      where: { id: orderId, customerId: response.locals.customerId as string },
      include: { items: { orderBy: { createdAt: "asc" } } },
    });
    if (!order) {
      response.status(404).json({ error: { code: "ORDER_NOT_FOUND", message: "Order not found." } });
      return;
    }
    response.json({ order });
  } catch (error) {
    next(error);
  }
});

export async function handleStripeWebhook(request: Request, response: Response) {
  const stripe = stripeClient();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.header("stripe-signature");
  if (!stripe || !webhookSecret || !signature || !Buffer.isBuffer(request.body)) {
    response.status(503).json({ error: { code: "WEBHOOK_NOT_CONFIGURED", message: "Stripe webhook is not configured." } });
    return;
  }
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(request.body, signature, webhookSecret);
  } catch {
    response.status(400).json({ error: { code: "INVALID_WEBHOOK_SIGNATURE", message: "Invalid Stripe webhook signature." } });
    return;
  }
  if (event.type === "checkout.session.completed") {
    await markOrderPaid(event.data.object as Stripe.Checkout.Session);
  }
  response.json({ received: true });
}

orderAdminRouter.patch("/:orderId/status", async (request, response, next) => {
  try {
    const configuredKey = process.env.ORDER_STATUS_ADMIN_KEY;
    const suppliedKey = request.header("x-order-admin-key") ?? "";
    if (!configuredKey || suppliedKey.length !== configuredKey.length
      || !timingSafeEqual(Buffer.from(suppliedKey), Buffer.from(configuredKey))) {
      response.status(401).json({ error: { code: "ADMIN_AUTH_REQUIRED", message: "Order administration is not authorized." } });
      return;
    }
    const { orderId } = z.object({ orderId: z.string().min(1).max(100) }).parse(request.params);
    const { status } = z.object({ status: z.enum(["SHIPPED", "DELIVERED"]) }).parse(request.body);
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.paymentStatus !== "PAID" || order.status === "CANCELLED"
      || (status === "SHIPPED" && order.status !== "PROCESSING")
      || (status === "DELIVERED" && order.status !== "SHIPPED")) {
      response.status(409).json({ error: { code: "INVALID_ORDER_TRANSITION", message: "This order cannot move to the requested status." } });
      return;
    }
    await prisma.$transaction([
      prisma.order.update({ where: { id: order.id }, data: { status } }),
      prisma.orderItem.updateMany({ where: { orderId }, data: { fulfillmentStatus: status } }),
    ]);
    response.json({ orderId, status });
  } catch (error) {
    next(error);
  }
});
