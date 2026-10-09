import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createServer, Server } from "node:http";
import { AddressInfo } from "node:net";
import { PrismaClient } from "@prisma/client";
import { app } from "../src/server";

const prisma = new PrismaClient();
let server: Server;
let baseUrl: string;
let sessionCookie = "";
const testEmail = `auth-test-${Date.now()}@example.com`;
let productId = "";
let addressId = "";

before(async () => {
  const product = await prisma.product.findFirst();
  if (!product) throw new Error("Seed the catalog before running backend tests.");
  productId = product.id;
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  if (addressId && sessionCookie) {
    await fetch(`${baseUrl}/addresses/${addressId}`, { method: "DELETE", headers: { Cookie: sessionCookie } });
  }
  if (sessionCookie) await fetch(`${baseUrl}/auth/logout`, { method: "POST", headers: { Cookie: sessionCookie } });
  await prisma.customer.deleteMany({ where: { email: testEmail } });
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await prisma.$disconnect();
});

test("registration stores only a password hash and sets an authenticated session", async () => {
  const response = await fetch(`${baseUrl}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Test Customer", email: testEmail, password: "long-test-password" }),
  });
  assert.equal(response.status, 201);
  const data = await response.json();
  assert.equal(data.customer.email, testEmail);
  assert.equal("passwordHash" in data.customer, false);
  sessionCookie = response.headers.get("set-cookie")!.split(";")[0];
  const saved = await prisma.customer.findUniqueOrThrow({ where: { email: testEmail } });
  assert.notEqual(saved.passwordHash, "long-test-password");
  assert.match(saved.passwordHash, /^[\da-f]+:[\da-f]+$/);
});

test("credentialed authentication requests are allowed from a local frontend dev port", async () => {
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: "OPTIONS",
    headers: {
      Origin: "http://localhost:3002",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type",
    },
  });
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-origin"), "http://localhost:3002");
  assert.equal(response.headers.get("access-control-allow-credentials"), "true");
});

test("login checks password and session endpoint returns the customer", async () => {
  const invalid = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: testEmail, password: "wrong" }),
  });
  assert.equal(invalid.status, 401);
  const invalidBody = await invalid.json();
  assert.equal(invalidBody.error.code, "INVALID_CREDENTIALS");
  assert.equal(invalidBody.error.message, "Email or password is incorrect.");
  const missingAccount = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: `missing-${testEmail}`, password: "long-test-password" }),
  });
  assert.equal(missingAccount.status, 401);
  assert.deepEqual(await missingAccount.json(), invalidBody);
  const login = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: testEmail, password: "long-test-password" }),
  });
  assert.equal(login.status, 200);
  sessionCookie = login.headers.get("set-cookie")!.split(";")[0];
  const me = await fetch(`${baseUrl}/auth/me`, { headers: { Cookie: sessionCookie } });
  assert.equal(me.status, 200);
  assert.equal((await me.json()).customer.email, testEmail);
});

test("cart quantities and saved postal addresses belong to the signed-in customer", async () => {
  const headers = { "Content-Type": "application/json", Cookie: sessionCookie };
  const add = await fetch(`${baseUrl}/cart/items`, {
    method: "POST",
    headers,
    body: JSON.stringify({ productId, quantity: 2 }),
  });
  assert.equal(add.status, 201);
  const cart = await fetch(`${baseUrl}/cart`, { headers });
  const cartBody = await cart.json();
  assert.equal(cartBody.items[0].quantity, 2);
  assert.ok(cartBody.items[0].product.name);

  const addressResponse = await fetch(`${baseUrl}/addresses`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      fullName: "Test Customer",
      line1: "1 Orchard Road",
      city: "Singapore",
      state: "Central",
      postalCode: "238841",
      country: "Singapore",
      latitude: 1.3048,
      longitude: 103.8318,
    }),
  });
  assert.equal(addressResponse.status, 201);
  const addressBody = await addressResponse.json();
  addressId = addressBody.address.id;
  const addresses = await fetch(`${baseUrl}/addresses`, { headers });
  const savedAddress = (await addresses.json()).addresses[0];
  assert.equal(savedAddress.postalCode, "238841");
  assert.equal(savedAddress.latitude, 1.3048);
});

test("orders are customer-scoped and checkout reports missing Stripe configuration", async () => {
  const unauthenticated = await fetch(`${baseUrl}/orders`);
  assert.equal(unauthenticated.status, 401);

  const orders = await fetch(`${baseUrl}/orders`, { headers: { Cookie: sessionCookie } });
  assert.equal(orders.status, 200);
  assert.ok(Array.isArray((await orders.json()).orders));

  const checkout = await fetch(`${baseUrl}/orders/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: sessionCookie },
    body: JSON.stringify({ addressId: "address-not-required-when-stripe-is-unconfigured" }),
  });
  assert.equal(checkout.status, 503);
  assert.equal((await checkout.json()).error.code, "PAYMENTS_NOT_CONFIGURED");
});
