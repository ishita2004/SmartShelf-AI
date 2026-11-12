const http = require("node:http");
const { fetchJson, sendJson } = require("../shared/http");

const PORT = Number(process.env.PORT) || 3002;
const CATALOG_URL = process.env.CATALOG_URL || "http://127.0.0.1:3001";
const REVIEWS_URL = process.env.REVIEWS_URL || "http://127.0.0.1:3004";
const sorters = {
  popular: (left, right) => right.popularity - left.popularity,
  rating: (left, right) => right.rating - left.rating || right.reviewCount - left.reviewCount,
  "price-low": (left, right) => left.price - right.price,
  "price-high": (left, right) => right.price - left.price,
};

async function searchProducts({ query, category, sort, catalogUrl = CATALOG_URL, reviewsUrl = REVIEWS_URL }) {
  const [catalog, reviewData] = await Promise.all([
    fetchJson(`${catalogUrl}/api/products`),
    fetchJson(`${reviewsUrl}/api/reviews`),
  ]);
  const reviewsByProduct = new Map(reviewData.reviews.map((review) => [review.productId, review]));
  const searchTerm = query.trim().toLowerCase();
  const products = catalog.products
    .map((product) => ({ ...product, ...reviewsByProduct.get(product.id) }))
    .filter((product) => {
      const matchesCategory = !category || product.category === category;
      const text = `${product.name} ${product.category} ${product.description}`.toLowerCase();
      return matchesCategory && (!searchTerm || text.includes(searchTerm));
    })
    .sort((left, right) => sorters[sort](left, right) || left.name.localeCompare(right.name));

  return { products, categories: catalog.categories };
}

function createServer({ catalogUrl = CATALOG_URL, reviewsUrl = REVIEWS_URL } = {}) {
  return http.createServer(async (request, response) => {
    const url = new URL(request.url, `http://${request.headers.host ?? "localhost"}`);

    if (request.method === "GET" && url.pathname === "/health") {
      sendJson(response, 200, { status: "ok", service: "search" });
      return;
    }
    if (request.method !== "GET" || url.pathname !== "/api/search") {
      sendJson(response, 404, { error: "Not found." });
      return;
    }

    const category = url.searchParams.get("category") ?? "";
    const query = (url.searchParams.get("q") ?? "").slice(0, 100);
    const sort = url.searchParams.get("sort") ?? "popular";
    if (!Object.hasOwn(sorters, sort)) {
      sendJson(response, 400, { error: "Select a valid sort order." });
      return;
    }

    try {
      const data = await searchProducts({ query, category, sort, catalogUrl, reviewsUrl });
      if (category && !data.categories.includes(category)) {
        sendJson(response, 400, { error: "Select a valid product category." });
        return;
      }
      sendJson(response, 200, data);
    } catch (error) {
      console.error(`Search dependency failed: ${error.message}`);
      sendJson(response, 502, { error: "Product search is temporarily unavailable." });
    }
  });
}

if (require.main === module) {
  createServer().listen(PORT, "0.0.0.0", () => console.log(`Search service listening on port ${PORT}`));
}

module.exports = { createServer, searchProducts };
