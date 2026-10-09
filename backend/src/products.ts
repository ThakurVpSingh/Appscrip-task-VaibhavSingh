import { Router } from "express";
import { z } from "zod";
import { checkDatabaseAvailability, prisma } from "./db";
import {
  getFallbackProductById,
  queryFallbackProducts,
} from "./catalog-fallback";

export const productsRouter = Router();

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(48).default(12),
  category: z.string().trim().min(1).optional(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
  sort: z.enum(["featured", "newest", "price-asc", "price-desc"]).default("featured"),
  q: z.string().trim().max(100).optional(),
}).refine((query) => query.minPrice === undefined || query.maxPrice === undefined || query.minPrice <= query.maxPrice, {
  message: "minPrice must be less than or equal to maxPrice",
  path: ["minPrice"],
});

productsRouter.get("/", async (request, response, next) => {
  try {
    const query = querySchema.parse(request.query);
    const dbOk = await checkDatabaseAvailability();

    if (!dbOk) {
      return response.json(queryFallbackProducts(query));
    }

    const where = {
      fakeStoreId: { not: null },
      ...(query.category ? { category: { slug: query.category } } : {}),
      ...(query.q ? { OR: [
        { name: { contains: query.q, mode: "insensitive" as const } },
        { description: { contains: query.q, mode: "insensitive" as const } },
      ] } : {}),
      ...(query.minPrice !== undefined || query.maxPrice !== undefined ? {
        price: {
          ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}),
          ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}),
        },
      } : {}),
    };
    const orderBy = query.sort === "newest"
      ? [{ createdAt: "desc" as const }]
      : query.sort === "price-asc"
        ? [{ price: "asc" as const }]
        : query.sort === "price-desc"
          ? [{ price: "desc" as const }]
          : [{ isNew: "desc" as const }, { createdAt: "desc" as const }];
    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: { category: true, images: { orderBy: { position: "asc" } } },
        orderBy,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.product.count({ where }),
    ]);

    if (items.length === 0 && total === 0 && !query.category && !query.q && query.minPrice === undefined && query.maxPrice === undefined) {
      // Database is empty (unseeded), return fallback
      return response.json(queryFallbackProducts(query));
    }

    response.json({
      items: items.map((item) => ({
        ...item,
        price: Number(item.price),
        compareAtPrice: item.compareAtPrice === null ? null : Number(item.compareAtPrice),
      })),
      pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) || 1 },
    });
  } catch (error) {
    try {
      const query = querySchema.parse(request.query);
      return response.json(queryFallbackProducts(query));
    } catch {
      next(error);
    }
  }
});

productsRouter.get("/:id", async (request, response, next) => {
  try {
    const id = z.string().min(1).max(100).parse(request.params.id);
    const dbOk = await checkDatabaseAvailability();

    if (!dbOk) {
      const fallback = getFallbackProductById(id);
      if (!fallback) {
        return response.status(404).json({ error: { code: "PRODUCT_NOT_FOUND", message: "Product not found" } });
      }
      return response.json(fallback);
    }

    const product = await prisma.product.findFirst({
      where: { OR: [{ id }, { slug: id }] },
      include: { category: true, images: { orderBy: { position: "asc" } } },
    });
    if (!product) {
      const fallback = getFallbackProductById(id);
      if (fallback) return response.json(fallback);
      return response.status(404).json({ error: { code: "PRODUCT_NOT_FOUND", message: "Product not found" } });
    }
    response.json({
      ...product,
      price: Number(product.price),
      compareAtPrice: product.compareAtPrice === null ? null : Number(product.compareAtPrice),
    });
  } catch (error) {
    try {
      const id = String(request.params.id);
      const fallback = getFallbackProductById(id);
      if (fallback) return response.json(fallback);
    } catch {
      // continue
    }
    next(error);
  }
});
