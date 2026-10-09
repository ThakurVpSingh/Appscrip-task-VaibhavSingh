import catalogData from "./catalog-data.json";

export type FallbackProduct = {
  id: string;
  fakeStoreId: number;
  name: string;
  slug: string;
  description: string;
  price: number;
  compareAtPrice: number | null;
  ratingRate: number;
  ratingCount: number;
  isNew: boolean;
  categoryId: string;
  category: {
    id: string;
    name: string;
    slug: string;
  };
  images: {
    id: string;
    url: string;
    alt: string;
    position: number;
    productId: string;
  }[];
  createdAt: string;
};

const items: FallbackProduct[] = catalogData as FallbackProduct[];

export type CatalogQueryParams = {
  page: number;
  limit: number;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: "featured" | "newest" | "price-asc" | "price-desc";
  q?: string;
};

export function queryFallbackProducts(params: CatalogQueryParams) {
  let filtered = [...items];

  if (params.category) {
    filtered = filtered.filter(
      (p) => p.category.slug.toLowerCase() === params.category!.toLowerCase()
    );
  }

  if (params.q) {
    const qLower = params.q.toLowerCase();
    filtered = filtered.filter(
      (p) =>
        p.name.toLowerCase().includes(qLower) ||
        p.description.toLowerCase().includes(qLower)
    );
  }

  if (params.minPrice !== undefined) {
    filtered = filtered.filter((p) => p.price >= params.minPrice!);
  }

  if (params.maxPrice !== undefined) {
    filtered = filtered.filter((p) => p.price <= params.maxPrice!);
  }

  const sort = params.sort ?? "featured";
  filtered.sort((a, b) => {
    if (sort === "newest") {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    if (sort === "price-asc") {
      return a.price - b.price;
    }
    if (sort === "price-desc") {
      return b.price - a.price;
    }
    // featured
    if (a.isNew !== b.isNew) {
      return a.isNew ? -1 : 1;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const total = filtered.length;
  const skip = (params.page - 1) * params.limit;
  const pageItems = filtered.slice(skip, skip + params.limit);

  return {
    items: pageItems,
    pagination: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages: Math.ceil(total / params.limit) || 1,
    },
  };
}

export function getFallbackProductById(idOrSlug: string) {
  return items.find((p) => p.id === idOrSlug || p.slug === idOrSlug) || null;
}

export function getFallbackCategories() {
  const categoryMap = new Map<string, { id: string; name: string; slug: string; productCount: number }>();

  for (const item of items) {
    const existing = categoryMap.get(item.category.slug);
    if (existing) {
      existing.productCount += 1;
    } else {
      categoryMap.set(item.category.slug, {
        id: item.category.id,
        name: item.category.name,
        slug: item.category.slug,
        productCount: 1,
      });
    }
  }

  return Array.from(categoryMap.values()).sort((a, b) => a.name.localeCompare(b.name));
}
