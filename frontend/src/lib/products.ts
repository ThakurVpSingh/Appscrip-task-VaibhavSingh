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

export async function getProducts(filters: ProductFilters): Promise<ProductPage> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }

  const response = await fetch(`${apiUrl}/products?${params.toString()}`, {
    next: { revalidate: 60 },
  });
  if (!response.ok) {
    throw new Error(`Product service returned ${response.status}`);
  }
  return response.json() as Promise<ProductPage>;
}

export async function getCategories(): Promise<
  { id: string; name: string; slug: string; productCount: number }[]
> {
  const response = await fetch(`${apiUrl}/categories`, {
    next: { revalidate: 3600 },
  });
  if (!response.ok) throw new Error(`Category service returned ${response.status}`);
  return response.json();
}

export async function getProduct(id: string): Promise<Product> {
  const response = await fetch(`${apiUrl}/products/${encodeURIComponent(id)}`, {
    next: { revalidate: 60 },
  });
  if (response.status === 404) throw new ProductNotFoundError(id);
  if (!response.ok) throw new Error(`Product service returned ${response.status}`);
  const product = await response.json();
  return {
    ...product,
    price: Number(product.price),
    compareAtPrice: product.compareAtPrice === null ? null : Number(product.compareAtPrice),
  } as Product;
}
