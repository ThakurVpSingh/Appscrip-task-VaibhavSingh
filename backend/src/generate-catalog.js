const fs = require('fs');
const path = require('path');

async function run() {
  const res = await fetch('https://fakestoreapi.com/products');
  const products = await res.json();

  function slugify(v) {
    return v.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  const categoriesMap = {
    "men's clothing": { id: 'cat-mens-clothing', name: "Men's Clothing", slug: 'mens-clothing' },
    "women's clothing": { id: 'cat-womens-clothing', name: "Women's Clothing", slug: 'womens-clothing' },
    "jewelery": { id: 'cat-jewelery', name: "Jewelery and Accessories", slug: 'jewelery' }
  };

  const catalog = products
    .filter(p => p.category !== 'electronics')
    .map(p => {
      const catInfo = categoriesMap[p.category] || { id: 'cat-' + slugify(p.category), name: p.category, slug: slugify(p.category) };
      return {
        id: 'prod-' + p.id,
        fakeStoreId: p.id,
        name: p.title,
        slug: slugify(p.title) + '-' + p.id,
        description: p.description,
        price: p.price,
        compareAtPrice: p.price > 40 ? Math.round(p.price * 1.25 * 100) / 100 : null,
        ratingRate: p.rating ? p.rating.rate : 4.5,
        ratingCount: p.rating ? p.rating.count : 120,
        isNew: p.id <= 4 || p.id === 15 || p.id === 16,
        categoryId: catInfo.id,
        category: catInfo,
        images: [
          {
            id: 'img-' + p.id + '-1',
            url: p.image,
            alt: p.title + ' product image',
            position: 0,
            productId: 'prod-' + p.id
          }
        ],
        createdAt: new Date(Date.now() - (20 - p.id) * 86400000).toISOString()
      };
    });

  const targetPath = path.join(__dirname, 'catalog-data.json');
  fs.writeFileSync(targetPath, JSON.stringify(catalog, null, 2));
  console.log('Saved ' + catalog.length + ' catalog products to ' + targetPath);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
