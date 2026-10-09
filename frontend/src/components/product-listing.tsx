"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState, useTransition } from "react";
import type { Product, ProductPage } from "@/lib/products";
import { useCart } from "./cart-provider";
import { useNotifications } from "./notification-provider";
import { Testimonials } from "./testimonials";

type Category = { id: string; name: string; slug: string; productCount: number };

const heroSlides = [
  {
    eyebrow: "A softer start",
    title: <>For the slow<br />mornings.</>,
    description: <>Light layers, first coffee.<br />Your day, with nowhere else to be.</>,
    occasion: "SLOW MORNINGS",
    image: "photo-1539109136881-3be0616acf4b",
    imageAlt: "A considered, easy look for a slow morning",
  },
  {
    eyebrow: "Out, in your own time",
    title: <>The city,<br />at your pace.</>,
    description: <>Comfortable pieces for the long way round.<br />And every little stop along the way.</>,
    occasion: "CITY DAYS",
    image: "photo-1515886657613-9f3515b0c78f",
    imageAlt: "A confident everyday look for exploring the city",
  },
  {
    eyebrow: "Take the scenic route",
    title: <>Room for<br />one more stop.</>,
    description: <>Easy things to pack, wear, and live in.<br />A little getaway starts wherever you are.</>,
    occasion: "WEEKEND AWAY",
    image: "photo-1483985988355-763728e1935b",
    imageAlt: "Friends finding their own style on a weekend out",
  },
  {
    eyebrow: "One more good thing",
    title: <>After hours,<br />without hurry.</>,
    description: <>A little more polished, never overthought.<br />For evenings that take their time.</>,
    occasion: "AFTER HOURS",
    image: "photo-1529139574466-a303027c1d8b",
    imageAlt: "Modern fashion styling for a relaxed evening out",
  },
];

function Icon({ name, size = 18 }: { name: "search" | "bag" | "menu" | "heart" | "chevron"; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true as const };
  if (name === "search") return <svg {...common}><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></svg>;
  if (name === "bag") return <svg {...common}><path d="M5 8h14l1 13H4L5 8Z" /><path d="M9 9V6a3 3 0 0 1 6 0v3" /></svg>;
  if (name === "heart") return <svg {...common}><path d="M20.4 8.7c0 4.1-8.4 10-8.4 10s-8.4-5.9-8.4-10A4.4 4.4 0 0 1 12 6.2a4.4 4.4 0 0 1 8.4 2.5Z" /></svg>;
  if (name === "menu") return <svg {...common}><path d="M4 7h16M4 12h16M4 17h16" /></svg>;
  return <svg {...common}><path d="m9 18 6-6-6-6" /></svg>;
}

function setUrlValue(params: URLSearchParams, key: string, value?: string) {
  if (value) params.set(key, value);
  else params.delete(key);
  if (key !== "page") params.delete("page");
  return params;
}

export function ProductListing({
  products,
  pagination,
  categories,
  selectedCategory,
  sort,
  search,
  minPrice,
  maxPrice,
}: {
  products: Product[];
  pagination: ProductPage["pagination"];
  categories: Category[];
  selectedCategory?: string;
  sort: string;
  search: string;
  minPrice?: number;
  maxPrice?: number;
}) {
  const router = useRouter();
  const cart = useCart();
  const notifications = useNotifications();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [searchValue, setSearchValue] = useState(search);
  const [menuOpen, setMenuOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const [carouselPaused, setCarouselPaused] = useState(false);
  const [carouselHovered, setCarouselHovered] = useState(false);
  useEffect(() => setSearchValue(search), [search]);
  useEffect(() => {
    if (carouselPaused || carouselHovered || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const interval = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % heroSlides.length);
    }, 4500);
    return () => window.clearInterval(interval);
  }, [carouselPaused, carouselHovered]);

  function moveSlide(direction: -1 | 1) {
    setActiveSlide((current) => (current + direction + heroSlides.length) % heroSlides.length);
  }

  function update(key: string, value?: string) {
    const params = setUrlValue(new URLSearchParams(searchParams.toString()), key, value);
    const query = params.toString();
    startTransition(() => router.push(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  }

  function updatePriceRange(key: "minPrice" | "maxPrice", value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");
    if (value) params.set(key, value);
    else params.delete(key);
    const opposite = key === "minPrice" ? "maxPrice" : "minPrice";
    const oppositeValue = Number(params.get(opposite));
    if (value && params.has(opposite) && (key === "minPrice" ? Number(value) > oppositeValue : Number(value) < oppositeValue)) {
      params.delete(opposite);
    }
    const query = params.toString();
    startTransition(() => router.push(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    update("q", searchValue.trim() || undefined);
  }

  return (
    <div className={pending ? "storefront is-pending" : "storefront"}>
      <div className="announcement">A little more considered. A lot more you. <a href="#collection">Discover the edit <span aria-hidden="true">↗</span></a></div>
      <header className="site-header">
        <button className="icon-button mobile-menu" aria-label="Toggle navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}><Icon name="menu" /></button>
        <Link className="wordmark" href="/" aria-label="Studio and Co. home">studio<span>&</span>co.</Link>
        <nav className={menuOpen ? "main-nav nav-open" : "main-nav"} aria-label="Main navigation">
          <a href="#collection" className="active">New in</a><a href="#collection">Clothing</a><a href="#collection">Collections</a><a href="#journal">Our journal</a>
        </nav>
        <div className="header-actions">
          <form className={searchOpen ? "header-search search-open" : "header-search"} onSubmit={submitSearch} role="search">
            <button type="button" className="search-trigger" aria-label="Open search" aria-expanded={searchOpen} onClick={() => setSearchOpen(!searchOpen)}><Icon name="search" size={17} /></button>
            <label className="sr-only" htmlFor="site-search">Search products</label>
            <input id="site-search" placeholder="Search" value={searchValue} onChange={(event) => setSearchValue(event.target.value)} />
          </form>
          <Link className="icon-button account-button" href={cart.customer ? "/account" : "/account/login"} aria-label="Your account"><span>{cart.customer ? "My account" : "Account"}</span></Link>
          <Link className="icon-button bag-button" href="/cart" aria-label={`Shopping bag, ${cart.itemCount} items`}><Icon name="bag" /><span>{cart.itemCount}</span></Link>
        </div>
      </header>

      <main>
        <nav className="breadcrumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span>/</span><span aria-current="page">New in</span></nav>
        <section
          className="collection-hero"
          aria-roledescription="carousel"
          aria-label="Occasion edits"
          onMouseEnter={() => setCarouselHovered(true)}
          onMouseLeave={() => setCarouselHovered(false)}
          aria-labelledby="page-title"
        >
          <div className="hero-copy" key={activeSlide}>
            <p className="eyebrow">{heroSlides[activeSlide].eyebrow}</p>
            <h1 id="page-title">{heroSlides[activeSlide].title}</h1>
            <p>{heroSlides[activeSlide].description}</p>
            <a href="#collection" className="text-link">Explore new arrivals <span aria-hidden="true">↓</span></a>
          </div>
          <div className="hero-image">
            <div className="hero-image-stack" aria-live="off">
              {heroSlides.map((slide, index) => (
                <Image
                  key={slide.image}
                  src={`https://images.unsplash.com/${slide.image}?auto=format&fit=crop&w=1400&q=85`}
                  alt={index === activeSlide ? slide.imageAlt : ""}
                  fill
                  sizes="(max-width: 650px) 100vw, 50vw"
                  priority={index === 0}
                  className={index === activeSlide ? "hero-slide-image is-active" : "hero-slide-image"}
                />
              ))}
            </div>
            <div className="hero-caption">{heroSlides[activeSlide].occasion} <span>—</span> STUDIO &amp; CO.</div>
            <div className="hero-controls" aria-label="Occasion slideshow controls">
              <button type="button" onClick={() => moveSlide(-1)} aria-label="Previous occasion">←</button>
              <button
                type="button"
                className="hero-play"
                onClick={() => setCarouselPaused(!carouselPaused)}
                aria-label={carouselPaused ? "Play occasion slideshow" : "Pause occasion slideshow"}
                aria-pressed={carouselPaused}
              >
                {carouselPaused ? "▶" : "Ⅱ"}
              </button>
              <button type="button" onClick={() => moveSlide(1)} aria-label="Next occasion">→</button>
            </div>
          </div>
          <div className="hero-index">
            <span>{String(activeSlide + 1).padStart(2, "0")}</span><span className="hero-index-divider">/</span>{String(heroSlides.length).padStart(2, "0")}
            <div className="hero-dots" aria-label="Choose an occasion">
              {heroSlides.map((slide, index) => (
                <button
                  key={slide.occasion}
                  type="button"
                  className={index === activeSlide ? "hero-dot is-active" : "hero-dot"}
                  onClick={() => setActiveSlide(index)}
                  aria-label={`Show ${slide.occasion.toLowerCase()} slide`}
                  aria-current={index === activeSlide ? "true" : undefined}
                />
              ))}
            </div>
          </div>
        </section>

        <section id="collection" className="collection-section" aria-labelledby="collection-title">
          <div className="collection-heading"><div><p className="eyebrow">Made for the in-between</p><h2 id="collection-title">New arrivals <span>({pagination.total})</span></h2></div><p>Easy layers. Better basics.<br />Good things, just in.</p></div>
          <div className="collection-toolbar">
            <button className="filter-toggle" type="button" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)} aria-label="Toggle filters"><span className="filter-glyph">☷</span> Filter & sort <span className="filter-count">{[selectedCategory, minPrice !== undefined || maxPrice !== undefined ? "price" : undefined].filter(Boolean).length || ""}</span></button>
            <div className={filtersOpen ? "active-filters filters-open" : "active-filters"}>
              <label className="sr-only" htmlFor="category-filter">Filter by category</label>
              <select id="category-filter" value={selectedCategory ?? ""} onChange={(event) => update("category", event.target.value || undefined)} aria-label="Filter by category">
                <option value="">All categories</option>{categories.map((category) => <option key={category.id} value={category.slug}>{category.name}</option>)}
              </select>
              <label className="sr-only" htmlFor="min-price">Minimum price</label>
              <select id="min-price" value={minPrice ?? ""} onChange={(event) => updatePriceRange("minPrice", event.target.value)} aria-label="Minimum price">
                <option value="">Any price</option><option value="25">$25+</option><option value="50">$50+</option><option value="100">$100+</option>
              </select>
              <label className="sr-only" htmlFor="max-price">Maximum price</label>
              <select id="max-price" value={maxPrice ?? ""} onChange={(event) => updatePriceRange("maxPrice", event.target.value)} aria-label="Maximum price">
                <option value="">No max</option><option value="50">Up to $50</option><option value="100">Up to $100</option><option value="150">Up to $150</option>
              </select>
            </div>
            <div className="sort-control"><span>{pagination.total} pieces</span><label htmlFor="sort">Sort by</label><select id="sort" value={sort} onChange={(event) => update("sort", event.target.value)}><option value="featured">Featured</option><option value="newest">Newest</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option></select></div>
          </div>
          <p className="loading-status" role="status" aria-live="polite">{pending ? "Updating collection…" : ""}</p>

          {products.length === 0 ? <div className="empty-state"><p className="eyebrow">Nothing here just yet</p><h3>No pieces found.</h3><p>Try a different search or clear your filters to see everything.</p><button className="button button-dark" onClick={() => router.push("/#collection")}>Clear filters</button></div> :
            <div className="product-grid" aria-live="polite" aria-busy={pending}>
              {products.map((product, index) => <ProductCard key={product.id} product={product} priority={index < 4} onAdd={async () => {
                await cart.addItem(product);
                notifications.toast("cart-added", product);
              }} />)}
            </div>}

          {pagination.totalPages > 1 && <nav className="pagination" aria-label="Product pages">
            <button disabled={pagination.page <= 1} onClick={() => update("page", String(pagination.page - 1))} aria-label="Previous page">←</button>
            <span>Page <strong>{pagination.page}</strong> of {pagination.totalPages}</span>
            <button disabled={pagination.page >= pagination.totalPages} onClick={() => update("page", String(pagination.page + 1))} aria-label="Next page">→</button>
          </nav>}
        </section>

        <Testimonials />
        <section id="journal" className="newsletter"><p className="eyebrow">A note from us</p><h2>Good things, in your inbox.</h2><p>First looks, thoughtful reads, and a little something for your next order.</p><form action="#" onSubmit={(event) => event.preventDefault()}><label className="sr-only" htmlFor="newsletter-email">Email address</label><input id="newsletter-email" type="email" placeholder="Your email address" required /><button type="submit" aria-label="Subscribe">Join us <span aria-hidden="true">↗</span></button></form></section>
      </main>
      <footer className="site-footer"><Link className="wordmark footer-mark" href="/">studio<span>&</span>co.</Link><p>Thoughtful clothes for wherever the day takes you.</p><div className="footer-links"><a href="#collection">Instagram</a><a href="#collection">Contact</a><a href="#collection">Shipping & returns</a></div><small>© 2024 Studio & Co. Made with intention.</small></footer>
    </div>
  );
}

function ProductCard({ product, priority, onAdd }: { product: Product; priority: boolean; onAdd: () => Promise<void> }) {
  const [saved, setSaved] = useState(false);
  const [addMessage, setAddMessage] = useState("");
  const image = product.images[0];
  const imageName = product.slug.replace(/-/g, " ");
  async function handleAdd() {
    setAddMessage("");
    try {
      await onAdd();
      setAddMessage("Added to your bag.");
    } catch (error) {
      setAddMessage(error instanceof Error ? error.message : "Could not add this item.");
    }
  }
  return <article className="product-card">
    <Link className="product-image-wrap" href={`/products/${product.slug}`} aria-label={`View ${product.name}`}>
      {image && <Image src={image.url} alt={image.alt || imageName} fill sizes="(max-width: 600px) 50vw, (max-width: 1000px) 33vw, 25vw" priority={priority} />}
      {product.isNew && <span className="product-badge">Just landed</span>}
    </Link>
    <button className={saved ? "save-button saved" : "save-button"} onClick={() => setSaved(!saved)} aria-label={saved ? `Remove ${product.name} from saved items` : `Save ${product.name}`} aria-pressed={saved}><Icon name="heart" size={17} /></button>
    <div className="product-info"><div><Link className="product-name" href={`/products/${product.slug}`}>{product.name}</Link><p className="product-category">{product.category.name}</p></div><p className="product-price">{product.compareAtPrice && <del>${product.compareAtPrice.toFixed(2)}</del>} ${product.price.toFixed(2)}</p></div>
    <button className="quick-add" type="button" onClick={() => void handleAdd()} aria-label={`Add ${product.name} to bag`}>Add to bag <span>+</span></button>
    {addMessage && <span className="quick-add-message" role="status">{addMessage}</span>}
  </article>;
}
