# Appscrip — Product Listing Page

A responsive apparel storefront built for the Appscrip Full-Stack Engineer assignment. It uses server-rendered Next.js pages backed by a separately deployed Express API and PostgreSQL database.

## Live URLs

- Frontend: **Not deployed yet** — deploy this repository to Vercel with `frontend` as the root directory.
- API: **Not deployed yet** — deploy this repository's checked-in Render Blueprint.
- API health check: `/health`; endpoint reference is below.

No hosting or database credentials were supplied, so this repository is ready to deploy but does not claim publicly available URLs.

## Stack

- **Next.js App Router, React, TypeScript** for server rendering, metadata, and URL-based client navigation.
- **Express, TypeScript, Zod** for a small, validated REST API with consistent errors.
- **PostgreSQL and Prisma** for relational catalog data, schema migrations, seed data, and typed queries.
- Hand-written CSS, with no UI kit, icon package, or client-side data-fetching dependency.

## Run locally

Requirements: Node.js 20+, npm, and PostgreSQL 15+ (local installation or a managed PostgreSQL instance). This project uses its own named database, `appscrip_store`, plus a separate `appscrip_store_shadow` database for Prisma migrations. Do not point the application at PostgreSQL's default `postgres` or `template1` databases.

```powershell
npm install
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env.local
```

Create a dedicated local database role and two project-specific databases in pgAdmin's Query Tool or a `psql` session connected to a maintenance database:

```sql
CREATE ROLE appscrip_app WITH LOGIN PASSWORD 'replace-with-a-strong-local-password';
CREATE DATABASE appscrip_store OWNER appscrip_app;
CREATE DATABASE appscrip_store_shadow OWNER appscrip_app;
```

Replace the placeholder password in both `DATABASE_URL` and `SHADOW_DATABASE_URL` in `backend/.env` with the same password (URL-encode special characters). Keep both URLs local and never commit `backend/.env`. The application URL must end with `/appscrip_store?schema=public`; the shadow URL must end with `/appscrip_store_shadow?schema=public`. Prisma uses the shadow database only to calculate and validate development migrations; it can be cleared during migration commands, so never point it at data you need.

```powershell
npm run db:migrate
npm run db:seed
```

For a fresh setup, `db:migrate` applies the checked-in migrations and generates the Prisma Client. Use `npm run db:deploy` to apply already-created migrations in production; production must use a dedicated migration credential and a separate, disposable shadow database if running `migrate dev` there is ever required. Do not use `db:push` for the assignment deployment because it bypasses migration history.

Start the API and storefront:

```powershell
npm run dev
```

The storefront is at `http://localhost:3001`; the API is at `http://localhost:4000`. Alternatively use `npm run dev:web` and `npm run dev:api`. Set `FRONTEND_ORIGIN` on the API to the allowed frontend origin(s) (comma-separated). Development CORS allows local HTTP origins; production requires explicitly configured origins. Set `PRODUCTS_API_URL` in the frontend environment to the API origin.

## Architecture

```text
frontend/
  public/static-preview.html       Static HTML/CSS design-first reference
  src/app/                         App Router pages, metadata, shared CSS
  src/components/product-listing.tsx  Interactive listing and product cards
  src/components/notification-provider.tsx  Typed toast and celebration notification context
  src/lib/products.ts              Typed server-side REST client
backend/
  prisma/schema.prisma             Product, category, image models and indexes
  prisma/migrations/               PostgreSQL migration history
  prisma/seed.ts                   Idempotent Fake Store API catalog import
  src/server.ts                    CORS, middleware, API error handling
  src/products.ts                  Product list and product detail endpoints
  src/orders.ts                    Stripe Checkout, verified payment, order history and status
  src/categories.ts                Category endpoint
```

`frontend/public/static-preview.html` is the standalone plain HTML/CSS starting point. The functional page is rendered by the Next.js server from `/products` and `/categories` on the backend. Search, category, price, sort, and pagination are serialized into query parameters; Next.js client navigation requests a fresh server-rendered result without a full browser reload. Product routes are server-rendered as well. A missing or unavailable API produces an explicit storefront error state.

The client-side `NotificationProvider` supplies typed `toast` and `modal` actions through `useNotifications()`. Cart additions, quantity changes, address saves, account registration, and login use the shared accessible UI; timed toasts dismiss after four seconds and celebration dialogs remain open until dismissed or navigated. The notification UI uses the storefront's own CSS and React context, with no component-kit dependency.

## Deploy (Vercel + Render + Neon)

There is no PostgreSQL data file to upload or commit. The database is a hosted PostgreSQL service; `backend/prisma/schema.prisma` and `backend/prisma/migrations/` describe its structure, while `backend/prisma/seed.ts` imports catalog rows. Keep database credentials in hosting-provider environment variables, never in the repository.

1. Create a PostgreSQL project on [Neon](https://neon.tech/) and copy its PostgreSQL connection string. Use the direct (non-pooler) URL for the API and migrations. Keep this URL private.
2. Push this repository to GitHub, then create a Render Blueprint from it using the checked-in `render.yaml`. Set `DATABASE_URL` to the Neon URL, `SHADOW_DATABASE_URL` to a separate disposable Neon branch/database URL, and `FRONTEND_ORIGIN` to the eventual Vercel origin (for example `https://your-store.vercel.app`, without a trailing slash). Render builds the backend, applies checked-in migrations before starting it, and checks `/health`. The API listens on Render's assigned `PORT`.
3. In Vercel, import the same repository and set the project Root Directory to `frontend`. Add these environment variables in Production (and Preview if needed):

   ```text
   PRODUCTS_API_URL=https://<your-render-service>.onrender.com
   NEXT_PUBLIC_PRODUCTS_API_URL=https://<your-render-service>.onrender.com
   NEXT_PUBLIC_SITE_URL=https://<your-vercel-domain>
   ```

   `PRODUCTS_API_URL` is used by server rendering; `NEXT_PUBLIC_PRODUCTS_API_URL` is used by browser account/cart actions. Redeploy the frontend after setting them.
4. Once the migration has been applied, seed the hosted catalog from this repository's root using the production `DATABASE_URL` and a valid `SHADOW_DATABASE_URL` in `backend/.env` (never commit that file):

   ```powershell
   npm run db:seed
   ```

   This fetches Fake Store API data once from the backend seed script and upserts product, category, image, and rating data into PostgreSQL. The running storefront reads only from the Appscrip API/database; it does not call Fake Store from the browser. The catalog endpoints list the imported Fake Store products. The seed is repeatable and does not delete existing products or customer/order data.
5. Verify `https://<your-render-service>.onrender.com/health`, `https://<your-render-service>.onrender.com/products`, and the deployed storefront's page source. The page source should contain actual product names and prices. Put the final public URLs in the Live URLs section above.

Render's free web service may sleep when idle, and free database/provider plans have their own limits. Do not use a development migration (`prisma migrate dev`) against production; the Render start command uses `prisma migrate deploy` against the checked-in migration history.

## API

- `GET /health` — service status.
- `GET /products?page=1&limit=12` — paginated catalog; `limit` is 1–48.
- `GET /products?category=mens-clothing&minPrice=25&maxPrice=150&sort=price-asc&q=backpack` — filter and search. `sort` accepts `featured`, `newest`, `price-asc`, and `price-desc`. Fake Store ratings are returned as `ratingRate` and `ratingCount`.
- `GET /products/:id` — product lookup by ID or slug.
- `GET /categories` — alphabetized categories with product counts.
- `POST /auth/register` — create an account with a scrypt-hashed password; sets an HTTP-only session cookie.
- `POST /auth/login`, `GET /auth/me`, `POST /auth/logout` — authenticate and manage the signed-in customer session.
- `GET /cart`, `POST /cart/items`, `PUT /cart/items/:productId`, `DELETE /cart/items/:productId` — customer-owned cart.
- `GET /addresses`, `POST /addresses`, `DELETE /addresses/:id` — customer-owned postal addresses, optionally including map coordinates.
- `POST /orders/checkout` — validates a saved address and database cart, stores an order snapshot, and creates a Stripe Checkout Session.
- `POST /orders/confirm` — verifies a completed Checkout Session with Stripe before marking the order paid and clearing its cart.
- `POST /orders/stripe-webhook` — verifies Stripe signatures and idempotently records completed checkout sessions.
- `GET /orders`, `GET /orders/:orderId` — signed-in customer's order history and individual invoice data.
- `PATCH /admin/orders/:orderId/status` — secret-key protected fulfillment update (`x-order-admin-key`) to shipped, delivered, or cancelled; delivered requires shipped first.

List responses contain `items` and a `pagination` object. Invalid query parameters return HTTP 400 with `{ "error": { "code", "message", "details" } }`; missing products return 404, unknown routes return 404, and unexpected server errors return 500. The API is self-describing through this endpoint reference; Swagger can be added if the service contract expands.

Passwords are never returned to the frontend or stored in plaintext. Accounts use a salted scrypt password hash and opaque, random session tokens whose SHA-256 hashes are stored in PostgreSQL; browser cookies are HTTP-only and secure in production. Registration requires a 10-character minimum password. Guest bags are kept in local storage until sign-in, then transferred to the customer's saved cart.

## Checkout, payments, orders, and invoices

The cart requires a customer session and a saved delivery address. It displays Stripe-hosted card checkout and submits only the address ID; the API reloads product prices and quantities from PostgreSQL, snapshots the order and delivery address, and then redirects to Stripe Checkout. Card data is handled by Stripe and is never stored by this application. Orders are not marked paid based on the browser redirect alone: the success route asks the backend to retrieve the Checkout Session from Stripe, and the webhook verifies Stripe's signature and can safely process the completion as well. Both paths are idempotent.

Set these values in `backend/.env` to enable Stripe test checkout:

```dotenv
STRIPE_SECRET_KEY="sk_test_replace_with_your_test_secret"
STRIPE_WEBHOOK_SECRET="whsec_replace_with_your_local_webhook_secret"
STRIPE_CURRENCY="usd"
SITE_ORIGIN="http://localhost:3001"
ORDER_STATUS_ADMIN_KEY="use-a-long-random-private-fulfillment-key"
```

Use Stripe test-mode credentials only during local development; never commit `.env` files. For localhost webhook testing, install and authenticate the Stripe CLI, then run `stripe listen --forward-to localhost:4000/orders/stripe-webhook`; copy the CLI's generated webhook signing secret into `STRIPE_WEBHOOK_SECRET` and restart the API. Use Stripe's documented test card details on Stripe's hosted page; no real payment is taken in test mode. If `STRIPE_SECRET_KEY` is absent, payment choices remain visible but checkout responds with a clear configuration message and does not create a paid order.

After payment, orders appear under **My orders** on `/account`, with each product's line status and order tracking milestones. Fulfillment progresses using `PATCH /admin/orders/:orderId/status` and the configured `ORDER_STATUS_ADMIN_KEY`; the customer's invoice link opens a printable invoice. Payment confirmation changes items to `PROCESSING`; a fulfillment operator advances them to `SHIPPED`, then `DELIVERED`. Never expose the admin key to the frontend.

To enable Google Places address autocomplete and the live map preview, set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in `frontend/.env.local`. Enable Maps JavaScript API and Places API for that key; restrict it by HTTP referrer to the storefront origins and by API to the minimum required. The address form remains usable manually when no Google key is configured. Postal code, city, state/region, country, and location coordinates are stored on the customer address in PostgreSQL. Do not commit a live key.

## SSR and SEO

The product and category data are fetched in the Next.js server component, so the initial response contains real catalog HTML. The response includes a canonical URL, page title/description, Open Graph metadata, and an `ItemList` JSON-LD block containing individual products and offers. Product detail pages include their own metadata and `Product` JSON-LD. One H1 is used per page, with semantic section headings, breadcrumb navigation, and product-specific image alt text. Product images use Next.js image sizing/lazy loading where possible; the seeded Fake Store image URLs are external demo assets and should be replaced with licensed, owned assets before production.

## Dependencies

`next`, `react`, and `react-dom` provide the app and server rendering; TypeScript and the corresponding types provide static checks. ESLint with `eslint-config-next` checks the frontend using Next.js rules. `express` serves the API, `zod` validates input, `cors` limits browser origins, and `dotenv` loads local configuration. `prisma` and `@prisma/client` provide schema migrations and database queries. `stripe` is the official Node SDK used to create hosted Checkout Sessions and verify webhook signatures; card entry and processing remain on Stripe. `tsx` runs TypeScript during development and seeding; `concurrently` runs the two development servers together. The visual layer is plain CSS to keep the client bundle small.

## AI usage

Copilot SDK in VS Code was used to scaffold and implement the UI, API, schema, and documentation. I corrected an initial browse-only product-card approach by adding server-rendered product detail routes so a card opens a real product page. I also kept rendering on the project’s own API and seeded PostgreSQL catalog rather than using FakeStore directly in the browser.

## Known limitations

- The Figma file was not accessible in the implementation environment, so spacing and art direction are a considered approximation rather than a pixel-perfect match.
- Catalog photos use Unsplash image URLs and should be replaced with approved, owned product photography before production.
- Testimonial text is illustrative UI copy and must be replaced with verified, consented customer reviews before production.
- Stripe live payments require production secrets and webhook configuration; local/test mode is not a live payment deployment.
- Checkout and newsletter subscription capture are not implemented. Customer registration/login, database-backed carts, and saved addresses are implemented and covered by backend integration tests.
- No deployment credentials were provided. Public hosting URLs and production hosting/database provisioning remain to be configured.
- Production deployment should apply migrations through a release job (`prisma migrate deploy`) and add rate limiting, structured request logging, and API documentation generation.
