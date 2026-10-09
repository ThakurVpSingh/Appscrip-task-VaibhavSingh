import Image from "next/image";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProduct, ProductNotFoundError, type Product } from "@/lib/products";
import { AddToBagButton } from "@/components/add-to-bag-button";
import { CustomerQuickLinks } from "@/components/customer-quick-links";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  try {
    const product = await getProduct(slug);
    return {
      title: product.name,
      description: product.description,
      alternates: { canonical: `/products/${product.slug}` },
      openGraph: { title: product.name, description: product.description, images: [product.images[0]?.url ?? ""] },
    };
  } catch (error) {
    return {
      title: error instanceof ProductNotFoundError
        ? "Product not found"
        : "Product details temporarily unavailable",
    };
  }
}

export default async function ProductPage({ params }: { params: Params }) {
  const { slug } = await params;
  let product: Product;
  try {
    product = await getProduct(slug);
  } catch (error) {
    if (error instanceof ProductNotFoundError) notFound();
    return (
      <main className="service-error">
        <p className="eyebrow">A little pause</p>
        <h1>We couldn’t load this product.</h1>
        <p>Please try again in a moment. If you’re running locally, make sure the API and database are up.</p>
        <Link className="button button-dark" href={`/products/${encodeURIComponent(slug)}`}>Try again</Link>
        <Link className="text-link" href="/">Back to new arrivals</Link>
      </main>
    );
  }

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    image: product.images.map((image) => image.url),
    description: product.description,
    category: product.category.name,
    offers: {
      "@type": "Offer",
      price: product.price.toFixed(2),
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
    },
  };

  return (
    <main className="detail-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <header className="account-topbar"><Link className="wordmark" href="/">studio<span>&</span>co.</Link><CustomerQuickLinks /></header>
      <nav className="breadcrumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span>/</span><Link href="/#collection">New in</Link><span>/</span><span aria-current="page">{product.name}</span></nav>
      <div className="detail-layout">
        <div className="detail-image">
          {product.images[0] && <Image src={product.images[0].url} alt={product.images[0].alt} fill priority sizes="(max-width: 700px) 100vw, 55vw" />}
        </div>
        <section className="detail-copy">
          <p className="eyebrow">{product.category.name}</p>
          <h1>{product.name}</h1>
          <p className="detail-price">{product.compareAtPrice && <del>${product.compareAtPrice.toFixed(2)}</del>} ${product.price.toFixed(2)}</p>
          <p className="detail-description">{product.description}</p>
          <AddToBagButton product={product} />
          <p className="detail-note">Thoughtfully made. Easy to wear, season after season.</p>
          <Link className="text-link" href="/#collection">← Back to new arrivals</Link>
        </section>
      </div>
    </main>
  );
}
