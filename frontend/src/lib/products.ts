import { catalogData } from "./catalog-data";

export type ProductImage = {
  url: string;
  alt: string;
};

export type Product = {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  compareAtPrice: number | null;
  ratingRate: number | null;
  ratingCount: number | null;
  category: { id: string; name: string; slug: string };
  images: ProductImage[];
  isNew: boolean;
};

export type ProductPage = {
  items: Product[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type ProductFilters = {
  page: number;
  limit: number;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: string;
  q?: string;
};

export class ProductNotFoundError extends Error {
  constructor(slug: string) {
    super(`Product "${slug}" was not found`);
    this.name = "ProductNotFoundError";
  }
}

const apiUrl = process.env.PRODUCTS_API_URL ?? "http://127.0.0.1:4000";

function queryLocalCatalog(filters: ProductFilters): ProductPage {
  let filtered = [...catalogData] as unknown as (Product & { createdAt: string })[];

  if (filters.category) {
    filtered = filtered.filter(
      (p) => p.category.slug.toLowerCase() === filters.category!.toLowerCase()
    );
  }

  if (filters.q) {
    const qLower = filters.q.toLowerCase();
    filtered = filtered.filter(
      (p) =>
        p.name.toLowerCase().includes(qLower) ||
        p.description.toLowerCase().includes(qLower)
    );
  }

  if (filters.minPrice !== undefined) {
    filtered = filtered.filter((p) => p.price >= filters.minPrice!);
  }

  if (filters.maxPrice !== undefined) {
    filtered = filtered.filter((p) => p.price <= filters.maxPrice!);
  }

  const sort = filters.sort ?? "featured";
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
  const skip = (filters.page - 1) * filters.limit;
  const pageItems = filtered.slice(skip, skip + filters.limit);

  return {
    items: pageItems.map(({ ...p }) => ({
      ...p,
      price: Number(p.price),
      compareAtPrice: p.compareAtPrice === null ? null : Number(p.compareAtPrice),
    })),
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total,
      totalPages: Math.ceil(total / filters.limit) || 1,
    },
  };
}

function getLocalCategories() {
  const map = new Map<string, { id: string; name: string; slug: string; productCount: number }>();
  for (const item of catalogData) {
    const existing = map.get(item.category.slug);
    if (existing) {
      existing.productCount += 1;
    } else {
      map.set(item.category.slug, {
        id: item.category.id,
        name: item.category.name,
        slug: item.category.slug,
        productCount: 1,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function getLocalProduct(id: string): Product | null {
  const match = catalogData.find((p) => p.id === id || p.slug === id);
  if (!match) return null;
  return {
    ...match,
    price: Number(match.price),
    compareAtPrice: match.compareAtPrice === null ? null : Number(match.compareAtPrice),
  } as unknown as Product;
}

export async function getProducts(filters: ProductFilters): Promise<ProductPage> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }

  try {
    const response = await fetch(`${apiUrl}/products?${params.toString()}`, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(3500),
    });
    if (!response.ok) {
      return queryLocalCatalog(filters);
    }
    return (await response.json()) as ProductPage;
  } catch {
    return queryLocalCatalog(filters);
  }
}

export async function getCategories(): Promise<
  { id: string; name: string; slug: string; productCount: number }[]
> {
  try {
    const response = await fetch(`${apiUrl}/categories`, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(3500),
    });
    if (!response.ok) {
      return getLocalCategories();
    }
    return await response.json();
  } catch {
    return getLocalCategories();
  }
}

export async function getProduct(id: string): Promise<Product> {
  try {
    const response = await fetch(`${apiUrl}/products/${encodeURIComponent(id)}`, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(3500),
    });
    if (response.status === 404) {
      const local = getLocalProduct(id);
      if (local) return local;
      throw new ProductNotFoundError(id);
    }
    if (!response.ok) {
      const local = getLocalProduct(id);
      if (local) return local;
      throw new Error(`Product service returned ${response.status}`);
    }
    const product = await response.json();
    return {
      ...product,
      price: Number(product.price),
      compareAtPrice: product.compareAtPrice === null ? null : Number(product.compareAtPrice),
    } as Product;
  } catch (error) {
    if (error instanceof ProductNotFoundError) throw error;
    const local = getLocalProduct(id);
    if (local) return local;
    throw error;
  }
}
