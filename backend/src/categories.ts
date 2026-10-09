import { Router } from "express";
import { checkDatabaseAvailability, prisma } from "./db";
import { getFallbackCategories } from "./catalog-fallback";

export const categoriesRouter = Router();

categoriesRouter.get("/", async (_request, response, next) => {
  try {
    const dbOk = await checkDatabaseAvailability();
    if (!dbOk) {
      return response.json(getFallbackCategories());
    }

    const categories = await prisma.category.findMany({
      where: { products: { some: { fakeStoreId: { not: null } } } },
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { products: { where: { fakeStoreId: { not: null } } } },
        },
      },
    });

    if (categories.length === 0) {
      return response.json(getFallbackCategories());
    }

    response.json(
      categories.map(({ _count, ...category }) => ({
        ...category,
        productCount: _count.products,
      }))
    );
  } catch (error) {
    try {
      return response.json(getFallbackCategories());
    } catch {
      next(error);
    }
  }
});
