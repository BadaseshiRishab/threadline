const Product = require('./models/Product');

const dummyJsonCategories = {
  'mens-shirts': 'men',
  'mens-shoes': 'men',
  'mens-watches': 'men',
  tops: 'women',
  'womens-bags': 'women',
  'womens-dresses': 'women',
  'womens-jewellery': 'women',
  'womens-shoes': 'women',
  'womens-watches': 'women',
  beauty: 'beauty',
  fragrances: 'beauty',
  'skin-care': 'beauty',
  furniture: 'living',
  'home-decoration': 'living',
  'kitchen-accessories': 'living',
};

const fakeStoreCategories = {
  "men's clothing": 'men',
  "women's clothing": 'women',
  jewelery: 'women',
};

const matchableKitchenItem = /blender|coffee maker|espresso machine|air fryer|toaster|food processor|stand mixer|hand mixer|electric kettle|juicer|rice cooker|pressure cooker|cookware|waffle maker|slow cooker/i;
const fakeStoreSourceIdOffset = 1000000;

let dummyJsonLastSyncAt = 0;
let dummyJsonSyncPromise;
let bestBuyLastSyncAt = 0;
let bestBuySyncPromise;
let fakeStoreLastSyncAt = 0;
let fakeStoreSyncPromise;

const getDummyJsonSubcategory = (product) => {
  const title = String(product.title || '').toLowerCase();

  switch (product.category) {
    case 'mens-shirts':
      return /t-?shirts?|\btee\b/.test(title) ? 'T-Shirts' : 'Shirts';
    case 'mens-shoes':
      if (/cleat|baseball/.test(title)) return 'Sports Shoes';
      return /sneaker|trainer|air jordan/.test(title) ? 'Sneakers' : 'Shoes';
    case 'mens-watches':
    case 'womens-watches':
      return 'Watches';
    case 'tops':
    case 'womens-dresses':
      return /dress|frock|gown|skirt|suit/.test(title) ? 'Dresses' : 'Tops';
    case 'womens-bags':
      return /backpack/.test(title) ? 'Backpacks' : 'Handbags';
    case 'womens-jewellery':
      return 'Jewellery';
    case 'womens-shoes':
      if (/heel/.test(title)) return 'Heels';
      if (/slipper/.test(title)) return 'Slippers';
      return 'Shoes';
    case 'beauty':
      return 'Makeup';
    case 'fragrances':
      return 'Fragrance';
    case 'skin-care':
      return /soap|body wash|lotion/.test(title) ? 'Body Care' : 'Skin Care';
    case 'furniture':
      return 'Furniture';
    case 'home-decoration':
      return 'Home Decor';
    case 'kitchen-accessories':
      return 'Kitchen';
    default:
      return '';
  }
};

const mapDummyJsonProduct = (product) => {
  const category = dummyJsonCategories[product.category];
  if (!category) return null;

  const priceMultiplier = Number(process.env.DUMMYJSON_PRICE_MULTIPLIER || 83.5);
  const images = Array.isArray(product.images) ? product.images.filter(Boolean) : [];
  const sourceDiscount = Number(product.discountPercentage || 0);
  const selectedDiscount = Number(product.id) % 7 === 0 && sourceDiscount >= 10 && sourceDiscount <= 90
    ? sourceDiscount
    : 0;
  const originalPrice = Number((Number(product.price) * priceMultiplier).toFixed(2));

  return {
    sourceId: Number(product.id),
    sourceProvider: 'dummyjson',
    name: product.title,
    category,
    subcategory: getDummyJsonSubcategory(product),
    sourceCategory: product.category,
    description: product.description || '',
    price: Number((originalPrice * (1 - selectedDiscount / 100)).toFixed(2)),
    originalPrice,
    image: product.thumbnail || images[0] || '',
    images,
    brand: product.brand || '',
    discountPercentage: selectedDiscount,
    rating: Number(product.rating || 0),
    stock: Math.max(0, Number(product.stock || 0)),
    featured: category === 'men' || category === 'women',
    tags: Array.isArray(product.tags) ? product.tags : [],
  };
};

const syncDummyJsonCatalog = async () => {
  const ttl = Math.max(0, Number(process.env.DUMMYJSON_CATALOG_TTL_MS || 300000));
  if (dummyJsonLastSyncAt && Date.now() - dummyJsonLastSyncAt < ttl) return;
  if (dummyJsonSyncPromise) return dummyJsonSyncPromise;

  dummyJsonSyncPromise = (async () => {
    try {
      const baseUrl = (process.env.DUMMYJSON_API_URL || 'https://dummyjson.com').replace(/\/$/, '');
      const response = await fetch(`${baseUrl}/products?limit=0`, {
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) throw new Error(`DummyJSON returned HTTP ${response.status}`);

      const payload = await response.json();
      if (!Array.isArray(payload.products)) throw new Error('DummyJSON returned an invalid product list');

      const operations = payload.products
        .map(mapDummyJsonProduct)
        .filter(Boolean)
        .map((product) => ({
          updateOne: {
            filter: { sourceProvider: product.sourceProvider, sourceId: product.sourceId },
            update: {
              $set: {
                sourceProvider: product.sourceProvider,
                name: product.name,
                category: product.category,
                subcategory: product.subcategory,
                sourceCategory: product.sourceCategory,
                description: product.description,
                price: product.price,
                originalPrice: product.originalPrice,
                image: product.image,
                images: product.images,
                brand: product.brand,
                discountPercentage: product.discountPercentage,
                rating: product.rating,
                featured: product.featured,
                tags: product.tags,
              },
              $setOnInsert: { stock: product.stock },
            },
            upsert: true,
          },
        }));

      if (operations.length) await Product.bulkWrite(operations, { ordered: false });
      dummyJsonLastSyncAt = Date.now();
      console.log(`Synced ${operations.length} DummyJSON products`);
    } catch (error) {
      const cachedProduct = await Product.exists({ sourceId: { $exists: true } });
      if (!cachedProduct) throw error;

      dummyJsonLastSyncAt = Date.now();
      console.warn(`DummyJSON sync failed; serving cached catalog: ${error.message}`);
    }
  })();

  try {
    await dummyJsonSyncPromise;
  } finally {
    dummyJsonSyncPromise = null;
  }
};

const mapBestBuyProduct = (product) => {
  const sku = Number(product.sku);
  const salePrice = Number(product.salePrice);
  const searchableText = [
    product.name,
    product.shortDescription,
    product.description,
    product.department,
    product.class,
    product.subclass,
  ].filter(Boolean).join(' ');

  if (!Number.isSafeInteger(sku) || !Number.isFinite(salePrice) || salePrice <= 0) return null;
  if (!matchableKitchenItem.test(searchableText)) return null;

  const images = [...new Set([
    product.largeImage,
    product.image,
    product.thumbnailImage,
  ].filter(Boolean).map((image) => image.replace(/^http:/, 'https:')))];
  const priceMultiplier = Number(process.env.BESTBUY_PRICE_MULTIPLIER || 83.5);
  const sourceDiscount = Number(product.percentSavings || 0);
  const selectedDiscount = sku % 7 === 0 && sourceDiscount >= 10 && sourceDiscount <= 90
    ? sourceDiscount
    : 0;
  const price = Number((salePrice * priceMultiplier).toFixed(2));
  const originalPrice = selectedDiscount
    ? Number((price / (1 - selectedDiscount / 100)).toFixed(2))
    : price;

  return {
    sourceId: sku,
    sourceProvider: 'bestbuy',
    name: product.name,
    category: 'living',
    subcategory: 'Kitchen Appliances',
    sourceCategory: product.class || product.department || 'Kitchen Appliances',
    description: product.shortDescription || product.description || 'Kitchen appliance from Best Buy.',
    price,
    originalPrice,
    image: images[0] || '',
    images,
    brand: product.manufacturer || '',
    discountPercentage: selectedDiscount,
    rating: Number(product.customerReviewAverage || 0),
    stock: product.onlineAvailability ? 1 : 0,
    featured: false,
    tags: ['bestbuy', 'kitchen appliances'],
  };
};

const buildBestBuyProductsUrl = (apiKey) => {
  const searchTerms = [
    'blender',
    'coffee maker',
    'espresso machine',
    'air fryer',
    'toaster',
    'food processor',
    'stand mixer',
    'electric kettle',
    'juicer',
    'rice cooker',
    'pressure cooker',
    'cookware',
  ];
  const searches = searchTerms
    .map((term) => `search=${encodeURIComponent(term)}`)
    .join('|');
  const criteria = `((${searches})&active=true&type=HardGood&onlineAvailability=true)`;
  const attributes = [
    'sku', 'name', 'salePrice', 'shortDescription', 'description', 'manufacturer',
    'largeImage', 'image', 'thumbnailImage', 'department', 'class', 'subclass',
    'customerReviewAverage', 'percentSavings', 'onlineAvailability',
  ].join(',');

  return `https://api.bestbuy.com/v1/products${criteria}?format=json&pageSize=100&show=${attributes}&apiKey=${encodeURIComponent(apiKey)}`;
};

const syncBestBuyCatalog = async () => {
  const apiKey = process.env.BESTBUY_API_KEY;
  if (!apiKey) return;

  const ttl = Math.max(0, Number(process.env.BESTBUY_CATALOG_TTL_MS || 900000));
  if (bestBuyLastSyncAt && Date.now() - bestBuyLastSyncAt < ttl) return;
  if (bestBuySyncPromise) return bestBuySyncPromise;

  bestBuySyncPromise = (async () => {
    try {
      const response = await fetch(buildBestBuyProductsUrl(apiKey), {
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) throw new Error(`Best Buy returned HTTP ${response.status}`);

      const payload = await response.json();
      if (!Array.isArray(payload.products)) throw new Error('Best Buy returned an invalid product list');

      const expiresAt = new Date(Date.now() + Math.max(60000, Number(process.env.BESTBUY_PRODUCT_CACHE_MS || 1800000)));
      const operations = payload.products
        .map(mapBestBuyProduct)
        .filter(Boolean)
        .map((product) => ({
          updateOne: {
            filter: { sourceProvider: 'bestbuy', sourceId: product.sourceId },
            update: { $set: { ...product, expiresAt } },
            upsert: true,
          },
        }));

      if (operations.length) await Product.bulkWrite(operations, { ordered: false });
      bestBuyLastSyncAt = Date.now();
      console.log(`Synced ${operations.length} matching Best Buy kitchen products`);
    } catch (error) {
      bestBuyLastSyncAt = Date.now();
      console.warn(`Best Buy catalog sync skipped: ${error.message}`);
    }
  })();

  try {
    await bestBuySyncPromise;
  } finally {
    bestBuySyncPromise = null;
  }
};

const getFakeStoreSubcategory = (product) => {
  const title = String(product.title || '').toLowerCase();

  if (product.category === 'jewelery') return 'Jewellery';
  if (/backpack|bag/.test(title)) return 'Bags';
  if (/jacket|coat/.test(title)) return 'Jackets';
  if (/t-shirt|tee|shirt/.test(title)) return 'Tops';
  return 'Clothing';
};

const mapFakeStoreProduct = (product) => {
  const category = fakeStoreCategories[String(product.category || '').toLowerCase()];
  const sourceId = Number(product.id);

  if (!category || !Number.isSafeInteger(sourceId) || sourceId < 1) return null;

  const rating = Number(product.rating?.rate || 0);
  const image = String(product.image || '').replace(/^http:/, 'https:');
  const priceMultiplier = Number(process.env.FAKESTORE_PRICE_MULTIPLIER || 83.5);

  return {
    sourceId: fakeStoreSourceIdOffset + sourceId,
    sourceProvider: 'fakestore',
    name: String(product.title || 'Untitled product'),
    category,
    subcategory: getFakeStoreSubcategory(product),
    sourceCategory: product.category,
    description: String(product.description || ''),
    price: Number((Number(product.price) * priceMultiplier).toFixed(2)),
    originalPrice: Number((Number(product.price) * priceMultiplier).toFixed(2)),
    image,
    images: image ? [image] : [],
    brand: '',
    discountPercentage: 0,
    rating,
    stock: 10,
    featured: rating >= 4.5,
    tags: ['fakestore', String(product.category)],
  };
};

const syncFakeStoreCatalog = async () => {
  const ttl = Math.max(0, Number(process.env.FAKESTORE_CATALOG_TTL_MS || 300000));
  if (fakeStoreLastSyncAt && Date.now() - fakeStoreLastSyncAt < ttl) return;
  if (fakeStoreSyncPromise) return fakeStoreSyncPromise;

  fakeStoreSyncPromise = (async () => {
    try {
      const baseUrl = (process.env.FAKESTORE_API_URL || 'https://fakestoreapi.com').replace(/\/$/, '');
      const response = await fetch(`${baseUrl}/products`, {
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) throw new Error(`Fake Store API returned HTTP ${response.status}`);

      const products = await response.json();
      if (!Array.isArray(products)) throw new Error('Fake Store API returned an invalid product list');

      const operations = products
        .map(mapFakeStoreProduct)
        .filter(Boolean)
        .map((product) => ({
          updateOne: {
            filter: { sourceProvider: 'fakestore', sourceId: product.sourceId },
            update: {
              $set: {
                sourceProvider: product.sourceProvider,
                name: product.name,
                category: product.category,
                subcategory: product.subcategory,
                sourceCategory: product.sourceCategory,
                description: product.description,
                price: product.price,
                originalPrice: product.originalPrice,
                image: product.image,
                images: product.images,
                brand: product.brand,
                discountPercentage: product.discountPercentage,
                rating: product.rating,
                featured: product.featured,
                tags: product.tags,
              },
              $setOnInsert: { stock: product.stock },
            },
            upsert: true,
          },
        }));

      if (operations.length) await Product.bulkWrite(operations, { ordered: false });
      fakeStoreLastSyncAt = Date.now();
      console.log(`Synced ${operations.length} Fake Store apparel and jewelry products`);
    } catch (error) {
      fakeStoreLastSyncAt = Date.now();
      console.warn(`Fake Store catalog sync skipped: ${error.message}`);
    }
  })();

  try {
    await fakeStoreSyncPromise;
  } finally {
    fakeStoreSyncPromise = null;
  }
};

const syncCatalogSources = async () => {
  const results = await Promise.allSettled([
    syncDummyJsonCatalog(),
    syncBestBuyCatalog(),
    syncFakeStoreCatalog(),
  ]);

  results.forEach((result) => {
    if (result.status === 'rejected') {
      console.warn(`Catalog source sync failed: ${result.reason.message}`);
    }
  });
};

module.exports = {
  buildBestBuyProductsUrl,
  getDummyJsonSubcategory,
  getFakeStoreSubcategory,
  mapBestBuyProduct,
  mapDummyJsonProduct,
  mapFakeStoreProduct,
  syncBestBuyCatalog,
  syncCatalogSources,
  syncDummyJsonCatalog,
  syncFakeStoreCatalog,
};