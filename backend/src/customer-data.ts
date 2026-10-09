import { Router } from "express";
import { z } from "zod";
import { requireCustomer } from "./auth";
import { prisma } from "./db";

export const addressesRouter = Router();
export const cartRouter = Router();

const addressSchema = z.object({
  fullName: z.string().trim().min(2).max(100), 
  line1: z.string().trim().min(2).max(160),
  line2: z.string().trim().max(160).optional(),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().min(1).max(100),
  postalCode: z.string().trim().min(2).max(20),
  country: z.string().trim().min(2).max(100),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

addressesRouter.use(requireCustomer);
addressesRouter.get("/", async (_request, response, next) => {
  try {
    const addresses = await prisma.customerAddress.findMany({
      where: { customerId: response.locals.customerId as string },
      orderBy: { createdAt: "desc" },
    });
    response.json({ addresses });
  } catch (error) {
    next(error);
  }
});
addressesRouter.post("/", async (request, response, next) => {
  try {
    const input = addressSchema.parse(request.body);
    const address = await prisma.customerAddress.create({
      data: { ...input, customerId: response.locals.customerId as string },
    });
    response.status(201).json({ address });
  } catch (error) {
    next(error);
  }
});
addressesRouter.delete("/:id", async (request, response, next) => {
  try {
    const id = z.string().min(1).max(100).parse(request.params.id);
    const result = await prisma.customerAddress.deleteMany({
      where: { id, customerId: response.locals.customerId as string },
    });
    if (result.count === 0) {
      response.status(404).json({ error: { code: "ADDRESS_NOT_FOUND", message: "Address not found" } });
      return;
    }
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

cartRouter.use(requireCustomer);
cartRouter.get("/", async (_request, response, next) => {
  try {
    const items = await prisma.cartItem.findMany({
      where: { customerId: response.locals.customerId as string },
      include: { product: { include: { category: true, images: { orderBy: { position: "asc" } } } } },
      orderBy: { createdAt: "asc" },
    });
    response.json({
      items: items.map(({ product, ...item }) => ({
        ...item,
        product: {
          ...product,
          price: Number(product.price),
          compareAtPrice: product.compareAtPrice === null ? null : Number(product.compareAtPrice),
        },
      })),
    });
  } catch (error) {
    next(error);
  }
});
cartRouter.post("/items", async (request, response, next) => {
  try {
    const input = z.object({
      productId: z.string().min(1).max(100),
      quantity: z.coerce.number().int().min(1).max(10).default(1),
    }).parse(request.body);
    const product = await prisma.product.findFirst({
      where: { OR: [{ id: input.productId }, { slug: input.productId }] },
      select: { id: true },
    });
    if (!product) {
      response.status(404).json({ error: { code: "PRODUCT_NOT_FOUND", message: "Product not found" } });
      return;
    }
    const item = await prisma.cartItem.upsert({
      where: { customerId_productId: { customerId: response.locals.customerId as string, productId: product.id } },
      create: { customerId: response.locals.customerId as string, productId: product.id, quantity: input.quantity },
      update: { quantity: { increment: input.quantity } },
    });
    if (item.quantity > 10) {
      await prisma.cartItem.update({ where: { id: item.id }, data: { quantity: 10 } });
    }
    response.status(201).json({ item: { ...item, quantity: Math.min(item.quantity, 10) } });
  } catch (error) {
    next(error);
  }
});
cartRouter.put("/items/:productId", async (request, response, next) => {
  try {
    const productId = z.string().min(1).max(100).parse(request.params.productId);
    const { quantity } = z.object({ quantity: z.coerce.number().int().min(1).max(10) }).parse(request.body);
    const product = await prisma.product.findFirst({ where: { OR: [{ id: productId }, { slug: productId }] }, select: { id: true } });
    if (!product) {
      response.status(404).json({ error: { code: "PRODUCT_NOT_FOUND", message: "Product not found" } });
      return;
    }
    const item = await prisma.cartItem.upsert({
      where: { customerId_productId: { customerId: response.locals.customerId as string, productId: product.id } },
      create: { customerId: response.locals.customerId as string, productId: product.id, quantity },
      update: { quantity },
    });
    response.json({ item });
  } catch (error) {
    next(error);
  }
});
cartRouter.delete("/items/:productId", async (request, response, next) => {
  try {
    const productId = z.string().min(1).max(100).parse(request.params.productId);
    await prisma.cartItem.deleteMany({
      where: {
        customerId: response.locals.customerId as string,
        product: { OR: [{ id: productId }, { slug: productId }] },
      },
    });
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});
