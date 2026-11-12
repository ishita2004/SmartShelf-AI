const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const { createServer: createCatalogServer } = require("../services/catalog/server");
const { createServer: createRecommendationsServer } = require("../services/recommendations/server");
const { createServer: createReviewsServer } = require("../services/reviews/server");
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
  await startServer("catalog", createCatalogServer());
  await startServer("reviews", createReviewsServer());
  await startServer("search", createSearchServer({
    catalogUrl: addresses.catalog,
    reviewsUrl: addresses.reviews,
  }));
  await startServer("recommendations", createRecommendationsServer({
    catalogUrl: addresses.catalog,
    reviewsUrl: addresses.reviews,
  }));
  await startServer("storefront", createStorefrontServer({
    searchUrl: addresses.search,
    recommendationsUrl: addresses.recommendations,
  }));
});

after(async () => {
  await Promise.all(servers.map((server) => new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  })));
});

test("all five services expose health endpoints", async () => {
  for (const service of ["catalog", "reviews", "search", "recommendations", "storefront"]) {
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
  assert.match(page, /Explore the catalog/);
  assert.match(page, /recommendation-form/);
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

test("invalid interests and catalog filters are rejected", async () => {
  const badInterest = await fetch(`${addresses.storefront}/api/recommendations?interests=unknown`);
  const badSort = await fetch(`${addresses.storefront}/api/products?sort=random`);

  assert.equal(badInterest.status, 400);
  assert.equal(badSort.status, 400);
});
