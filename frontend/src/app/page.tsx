import type { Metadata } from "next";
import Link from "next/link";
import { ProductListing } from "@/components/product-listing";
import { getCategories, getProducts } from "@/lib/products";

export const metadata: Metadata = {
  title: "Shop Women’s New Arrivals",
  description:
    "Explore the latest considered clothing from Studio & Co. Find your new everyday favourites, from relaxed shirts to easy layers.",
  alternates: { canonical: "/" },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function safeNumber(value: string | undefined, fallback: number) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

export default async function Home({ searchParams }: { searchParams: SearchParams }) {
  const query = await searchParams;
  const page = safeNumber(first(query.page), 1);
  const limit = 12;
  const category = first(query.category);
  const sort = first(query.sort) ?? "featured";
  const q = first(query.q);
  const minPrice = query.minPrice ? Number(first(query.minPrice)) : undefined;
  const maxPrice = query.maxPrice ? Number(first(query.maxPrice)) : undefined;

  try {
    const [products, categories] = await Promise.all([
      getProducts({ page, limit, category, sort, q, minPrice, maxPrice }),
      getCategories(),
    ]);
    const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001";
    const itemList = {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "Women’s new arrivals",
      numberOfItems: products.pagination.total,
      itemListElement: products.items.map((product, index) => ({
        "@type": "ListItem",
        position: (products.pagination.page - 1) * products.pagination.limit + index + 1,
        url: `${origin}/products/${product.slug}`,
        item: {
          "@type": "Product",
          name: product.name,
          image: product.images[0]?.url,
          description: product.description,
          offers: {
            "@type": "Offer",
            price: product.price.toFixed(2),
            priceCurrency: "USD",
            availability: "https://schema.org/InStock",
          },
        },
      })),
    };

    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList).replace(/</g, "\\u003c") }}
        />
        <ProductListing
          products={products.items}
          pagination={products.pagination}
          categories={categories}
          selectedCategory={category}
          sort={sort}
          search={q ?? ""}
          minPrice={minPrice}
          maxPrice={maxPrice}
        />
      </>
    );
  } catch {
    return (
      <main className="service-error">
        <p className="eyebrow">A little pause</p>
        <h1>We couldn’t load the collection.</h1>
        <p>Please try again in a moment. If you’re running locally, make sure the API and database are up.</p>
        <Link className="button button-dark" href="/">Try again</Link>
      </main>
    );
  }
}
