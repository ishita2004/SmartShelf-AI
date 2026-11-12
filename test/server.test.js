const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const { createServer } = require("../server");

const server = createServer();
let baseUrl;

before(async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

test("health endpoint reports the app is ready", async () => {
  const response = await fetch(`${baseUrl}/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok" });
});

test("home page contains the catalog and recommendation controls", async () => {
  const response = await fetch(baseUrl);
  const page = await response.text();

  assert.equal(response.status, 200);
  assert.match(page, /Explore the catalog/);
  assert.match(page, /recommendation-form/);
});

test("recommendations combine interests with product ratings and popularity", async () => {
  const response = await fetch(`${baseUrl}/api/recommendations?interests=coffee`);
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.recommendations.length, 3);
  assert.equal(data.recommendations[0].id, "pour-over-kit");
  assert.ok(data.recommendations.every((product) => product.rating && product.reviewCount && product.score));
});

test("recommendations require a valid interest", async () => {
  const response = await fetch(`${baseUrl}/api/recommendations?interests=unknown`);
  assert.equal(response.status, 400);
});

test("catalog supports search, category filtering, and sorting", async () => {
  const response = await fetch(`${baseUrl}/api/products?q=plant&category=Home&sort=price-low`);
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.products.length, 1);
  assert.equal(data.products[0].id, "plant-care-set");
  assert.ok(data.categories.includes("Home"));
});

test("catalog rejects invalid filters", async () => {
  const badCategory = await fetch(`${baseUrl}/api/products?category=Unknown`);
  const badSort = await fetch(`${baseUrl}/api/products?sort=random`);

  assert.equal(badCategory.status, 400);
  assert.equal(badSort.status, 400);
});
