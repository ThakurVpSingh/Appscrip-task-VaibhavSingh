import "dotenv/config";
import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { productsRouter } from "./products";
import { categoriesRouter } from "./categories";
import { authRouter } from "./auth";
import { addressesRouter, cartRouter } from "./customer-data";
import { handleStripeWebhook, orderAdminRouter, ordersRouter } from "./orders";

const app = express();
const port = Number(process.env.PORT ?? process.env.API_PORT ?? 4000);
const allowedOrigins = process.env.FRONTEND_ORIGIN?.split(",").map((origin) => origin.trim()) ?? ["http://localhost:3000"];
function isAllowedOrigin(origin: string) {
  if (allowedOrigins.includes("*") || allowedOrigins.includes(origin)) return true;
  if (origin.endsWith(".vercel.app")) return true;
  if (process.env.NODE_ENV === "production") return false;
  try {
    const parsed = new URL(origin);
    return parsed.protocol === "http:"
      && ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
  } catch {
    return false;
  }
}

app.use(cors({
  origin: (origin, callback) => callback(null, !origin || isAllowedOrigin(origin)),
  credentials: true,
}));
app.post("/orders/stripe-webhook", express.raw({ type: "application/json" }), (request, response, next) => {
  void handleStripeWebhook(request, response).catch(next);
});
app.use(express.json({ limit: "16kb" }));
app.use((request, response, next) => {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method)
    && request.headers.origin
    && !isAllowedOrigin(request.headers.origin)) {
    response.status(403).json({ error: { code: "ORIGIN_NOT_ALLOWED", message: "Request origin is not allowed" } });
    return;
  }
  next();
});
app.get("/health", (_request, response) => response.json({ status: "ok" }));
app.use("/auth", authRouter);
app.use("/addresses", addressesRouter);
app.use("/cart", cartRouter);
app.use("/orders", ordersRouter);
app.use("/admin/orders", orderAdminRouter);
app.use("/products", productsRouter);
app.use("/categories", categoriesRouter);
app.use((_request, response) => response.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found" } }));
app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  if (error instanceof ZodError) {
    response.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid request parameters", details: error.issues } });
    return;
  }
  console.error(error);
  response.status(500).json({ error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } });
});

export { app };

if (require.main === module) {
  app.listen(port, () => console.info(`Product API listening on port ${port}`));
}
