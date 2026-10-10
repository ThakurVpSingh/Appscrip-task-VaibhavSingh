import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { NextFunction, Request, Response, Router } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { prisma } from "./db";

const scrypt = promisify(scryptCallback);
const sessionCookie = "studio_session";
const sessionLifetimeMs = 30 * 24 * 60 * 60 * 1000;

function cookieOptions() {
  const secure = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure,
    sameSite: secure ? "none" as const : "lax" as const,
    path: "/",
    maxAge: sessionLifetimeMs,
  };
}

function expiredCookieOptions() {
  const { maxAge: _maxAge, ...options } = cookieOptions();
  return options;
}

function readCookie(request: Request, name: string) {
  const prefix = `${name}=`;
  return request.headers.cookie
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length);
}

function extractSessionToken(request: Request): string | undefined {
  const authHeader = request.headers.authorization;
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    const raw = authHeader.slice(7).trim();
    if (raw) return raw;
  }
  return readCookie(request, sessionCookie);
}

async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64) as Buffer;
  return `${salt.toString("hex")}:${derived.toString("hex")}`;
}

async function verifyPassword(password: string, stored: string) {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex || !/^[\da-f]+$/i.test(saltHex) || !/^[\da-f]{128}$/i.test(hashHex)) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = await scrypt(password, Buffer.from(saltHex, "hex"), expected.length) as Buffer;
  return timingSafeEqual(actual, expected);
}

async function startSession(customerId: string, response: Response): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await prisma.customerSession.create({
    data: {
      customerId,
      tokenHash: createHash("sha256").update(token).digest("hex"),
      expiresAt: new Date(Date.now() + sessionLifetimeMs),
    },
  });
  response.cookie(sessionCookie, token, cookieOptions());
  return token;
}

export async function requireCustomer(request: Request, response: Response, next: NextFunction) {
  try {
    const token = extractSessionToken(request);
    if (!token) {
      response.status(401).json({ error: { code: "AUTH_REQUIRED", message: "Please sign in to continue" } });
      return;
    }
    const session = await prisma.customerSession.findUnique({
      where: { tokenHash: createHash("sha256").update(token).digest("hex") },
      select: { customerId: true, expiresAt: true },
    });
    if (!session || session.expiresAt <= new Date()) {
      if (session) {
        await prisma.customerSession.deleteMany({
          where: { tokenHash: createHash("sha256").update(token).digest("hex") },
        });
      }
      response.clearCookie(sessionCookie, expiredCookieOptions());
      response.status(401).json({ error: { code: "AUTH_REQUIRED", message: "Please sign in to continue" } });
      return;
    }
    response.locals.customerId = session.customerId;
    next();
  } catch (error) {
    next(error);
  }
}

export const authRouter = Router();
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 12,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: { code: "TOO_MANY_ATTEMPTS", message: "Too many account attempts. Please try again later." } },
});

const registrationSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(254),
  password: z.string().min(10).max(128),
});
const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128),
});

authRouter.post("/register", authRateLimit, async (request, response, next) => {
  try {
    const input = registrationSchema.parse(request.body);
    const customer = await prisma.customer.create({
      data: {
        name: input.name,
        email: input.email.toLowerCase(),
        passwordHash: await hashPassword(input.password),
      },
      select: { id: true, name: true, email: true, createdAt: true },
    });
    const token = await startSession(customer.id, response);
    response.status(201).json({ customer, token });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      response.status(409).json({ error: { code: "EMAIL_IN_USE", message: "An account already exists for this email address" } });
      return;
    }
    next(error);
  }
});

authRouter.post("/login", authRateLimit, async (request, response, next) => {
  try {
    const input = loginSchema.parse(request.body);
    const customer = await prisma.customer.findUnique({
      where: { email: input.email.toLowerCase() },
    });
    if (!customer || !await verifyPassword(input.password, customer.passwordHash)) {
      response.status(401).json({
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Email or password is incorrect.",
        },
      });
      return;
    }
    const token = await startSession(customer.id, response);
    response.json({
      customer: { id: customer.id, name: customer.name, email: customer.email, createdAt: customer.createdAt },
      token,
    });
  } catch (error) {
    next(error);
  }
});

authRouter.get("/me", requireCustomer, async (_request, response, next) => {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: response.locals.customerId as string },
      select: { id: true, name: true, email: true, createdAt: true },
    });
    if (!customer) {
      response.status(401).json({ error: { code: "AUTH_REQUIRED", message: "Please sign in to continue" } });
      return;
    }
    response.json({ customer });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/logout", async (request, response, next) => {
  try {
    const token = extractSessionToken(request);
    if (token) {
      await prisma.customerSession.deleteMany({
        where: { tokenHash: createHash("sha256").update(token).digest("hex") },
      });
    }
    response.clearCookie(sessionCookie, expiredCookieOptions());
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});
