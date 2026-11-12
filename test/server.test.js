const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const {
  createServer: createCatalogServer,
  initializeDatabase: initializeCatalogDatabase,
  listProducts,
  seedProducts,
} = require("../services/catalog/server");
const { createServer: createRecommendationsServer } = require("../services/recommendations/server");
const { createServer: createChatbotServer } = require("../services/chatbot/server");
const {
  createServer: createReviewsServer,
  initializeDatabase: initializeReviewsDatabase,
  listReviews,
  seedReviews,
} = require("../services/reviews/server");
const { createServer: createSearchServer } = require("../services/search/server");
const { createServer: createStorefrontServer } = require("../services/storefront/server");

const servers = [];
const addresses = {};

async function startServer(name, server) {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  servers.push(server);
  addresses[name] = `http://127.0.0.1:${server.address().port}`;
}

before(async () => {
  await startServer("catalog", createCatalogServer({ loadProducts: async () => seedProducts }));
  await startServer("reviews", createReviewsServer({ loadReviews: async (productId) =>
    productId ? seedReviews.filter((review) => review.productId === productId) : seedReviews }));
  await startServer("search", createSearchServer({
    catalogUrl: addresses.catalog,
    reviewsUrl: addresses.reviews,
  }));
  await startServer("recommendations", createRecommendationsServer({
    catalogUrl: addresses.catalog,
    reviewsUrl: addresses.reviews,
  }));
  await startServer("chatbot", createChatbotServer({
    recommendationsUrl: addresses.recommendations,
  }));
  await startServer("storefront", createStorefrontServer({
    searchUrl: addresses.search,
    recommendationsUrl: addresses.recommendations,
    chatbotUrl: addresses.chatbot,
  }));
});

after(async () => {
  await Promise.all(servers.map((server) => new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  })));
});

test("all six services expose health endpoints", async () => {
  for (const service of ["catalog", "reviews", "search", "recommendations", "chatbot", "storefront"]) {
    const response = await fetch(`${addresses[service]}/health`);
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.status, "ok");
  }
});

test("storefront serves the shopping page", async () => {
  const response = await fetch(addresses.storefront);
  const page = await response.text();

  assert.equal(response.status, 200);
  assert.match(page, /Explore the shelf/);
  assert.match(page, /recommendation-form/);
  assert.match(page, /shopping sidekick/);
});

test("catalog returns products and categories", async () => {
  const response = await fetch(`${addresses.catalog}/api/products`);
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.products.length, 8);
  assert.ok(data.categories.includes("Home"));
});

test("reviews service returns sample product ratings", async () => {
  const response = await fetch(`${addresses.reviews}/api/reviews?productId=skin-calm-kit`);
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.reviews.length, 1);
  assert.equal(data.reviews[0].rating, 4.9);
});

test("storefront search combines catalog and reviews data", async () => {
  const response = await fetch(`${addresses.storefront}/api/products?q=plant&category=Home&sort=rating`);
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.products.length, 1);
  assert.equal(data.products[0].id, "plant-care-set");
  assert.equal(data.products[0].rating, 4.4);
});

test("storefront recommendations return hybrid-scored products", async () => {
  const response = await fetch(`${addresses.storefront}/api/recommendations?interests=coffee`);
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.recommendations.length, 3);
  assert.equal(data.recommendations[0].id, "pour-over-kit");
  assert.ok(data.recommendations.every((product) => product.rating && product.reviewCount && product.score));
});

test("shopping assistant returns relevant products within the requested budget", async () => {
  const response = await fetch(`${addresses.storefront}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "Recommend coffee gear under $40" }),
  });
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.match(data.reply, /coffee/);
  assert.equal(data.products.length, 1);
  assert.equal(data.products[0].id, "pour-over-kit");
  assert.ok(data.products[0].price <= 40);
});

test("shopping assistant handles greetings and rejects invalid requests", async () => {
  const greeting = await fetch(`${addresses.storefront}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "hello" }),
  });
  const invalid = await fetch(`${addresses.storefront}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "" }),
  });
  const data = await greeting.json();

  assert.equal(greeting.status, 200);
  assert.match(data.reply, /Tell me what you’re shopping for/);
  assert.deepEqual(data.products, []);
  assert.equal(invalid.status, 400);
});

test("invalid interests and catalog filters are rejected", async () => {
  const badInterest = await fetch(`${addresses.storefront}/api/recommendations?interests=unknown`);
  const badSort = await fetch(`${addresses.storefront}/api/products?sort=random`);

  assert.equal(badInterest.status, 400);
  assert.equal(badSort.status, 400);
});

test("catalog initializes PostgreSQL schema and inserts sample rows without overwriting existing products", async () => {
  const statements = [];
  await initializeCatalogDatabase({
    query: async (sql, values) => statements.push({ sql, values }),
  });

  assert.match(statements[0].sql, /CREATE TABLE IF NOT EXISTS products/);
  assert.equal(statements.length, seedProducts.length + 1);
  assert.ok(statements.slice(1).every(({ sql }) => /ON CONFLICT \(id\) DO NOTHING/.test(sql)));
  assert.equal(JSON.parse(statements[1].values[5])[0], seedProducts[0].tags[0]);
});

test("catalog converts PostgreSQL numeric prices to JSON-friendly numbers", async () => {
  const products = await listProducts({
    query: async () => ({ rows: [{ id: "reading-light", price: "19.00" }] }),
  });

  assert.equal(products[0].price, 19);
});

test("reviews initializes its MongoDB index and seeds only an empty collection", async () => {
  let inserted;
  const collection = {
    createIndex: async (keys, options) => {
      assert.deepEqual(keys, { productId: 1 });
      assert.equal(options.unique, true);
    },
    countDocuments: async () => 0,
    insertMany: async (documents) => { inserted = documents; },
  };
  await initializeReviewsDatabase(collection);

  assert.equal(inserted.length, seedReviews.length);
});

test("reviews queries MongoDB by product and excludes its internal ID", async () => {
  let query;
  let options;
  const expected = [{ productId: "skin-calm-kit", rating: 4.9 }];
  const collection = {
    find: (filter, projection) => {
      query = filter;
      options = projection;
      return { toArray: async () => expected };
    },
  };

  assert.equal(await listReviews("skin-calm-kit", collection), expected);
  assert.deepEqual(query, { productId: "skin-calm-kit" });
  assert.deepEqual(options, { projection: { _id: 0 } });
});
