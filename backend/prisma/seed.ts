import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const prisma = new PrismaClient();
const fakeStoreApi = "https://fakestoreapi.com";

const clothingCategoryKeywords = [
  "clothing",
  "shirt",
  "dress",
  "blouse",
  "jeans",
  "jacket",
  "hoodie",
  "sweater",
  "coat",
  "skirt",
  "trouser",
  "pants",
  "top",
  "cardigan",
  "tee",
  "tshirt",
  "suit",
  "blazer",
  "sandal",
  "shoe",
  "boot",
  "sock",
  "bag",
  "belt",
  "accessory",
];

const fakeStoreProductSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1),
  price: z.number().nonnegative(),
  description: z.string(),
  category: z.string().min(1),
  image: z.string().url(),
  rating: z.object({
    rate: z.number().min(0).max(5),
    count: z.number().int().nonnegative(),
  }),
});

function isClothingCategory(name: string) {
  const normalized = name.toLowerCase();
  return clothingCategoryKeywords.some((keyword) => normalized.includes(keyword));
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function main() {
  const response = await fetch(`${fakeStoreApi}/products`, {
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new Error(`Fake Store API returned ${response.status}`);
  }

  const products = z.array(fakeStoreProductSchema).min(1).parse(await response.json());
  const clothingProducts = products.filter((product) => isClothingCategory(product.category));
  if (clothingProducts.length === 0) {
    throw new Error("No clothing products were found in the Fake Store catalog.");
  }

  await prisma.productImage.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();

  const categoryNames = [...new Set(clothingProducts.map((product) => product.category))];
  const categories = new Map<string, string>();

  for (const name of categoryNames) {
    const slug = slugify(name);
    const category = await prisma.category.upsert({
      where: { slug },
      update: { name },
      create: { name, slug },
    });
    categories.set(name, category.id);
  }

  for (const product of clothingProducts) {
    const categoryId = categories.get(product.category);
    if (!categoryId) {
      throw new Error(`No database category was created for "${product.category}"`);
    }

    const slug = `${slugify(product.title)}-${product.id}`;
    const savedProduct = await prisma.product.upsert({
      where: { fakeStoreId: product.id },
      update: {
        name: product.title,
        slug,
        description: product.description,
        price: product.price,
        ratingRate: product.rating.rate,
        ratingCount: product.rating.count,
        categoryId,
      },
      create: {
        fakeStoreId: product.id,
        name: product.title,
        slug,
        description: product.description,
        price: product.price,
        ratingRate: product.rating.rate,
        ratingCount: product.rating.count,
        categoryId,
      },
    });

    await prisma.productImage.deleteMany({ where: { productId: savedProduct.id } });
    await prisma.productImage.create({
      data: {
        productId: savedProduct.id,
        url: product.image,
        alt: `${product.title} product image`,
        position: 0,
      },
    });
  }

  console.info(`Imported ${products.length} Fake Store products across ${categories.size} categories.`);
}

main()
  .catch((error: unknown) => {
    console.error("Fake Store catalog seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
