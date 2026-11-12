const http = require("node:http");
const { fetchJson, sendJson } = require("../shared/http");

const PORT = Number(process.env.PORT) || 3003;
const CATALOG_URL = process.env.CATALOG_URL || "http://127.0.0.1:3001";
const REVIEWS_URL = process.env.REVIEWS_URL || "http://127.0.0.1:3004";
const interests = {
  coffee: "coffee espresso brewing beans",
  fitness: "fitness workout strength yoga running",
  technology: "technology gadgets smart electronics audio",
  home: "home kitchen decor organization plants",
  travel: "travel luggage packing camping outdoors",
  skincare: "skincare beauty skin wellness",
  reading: "books reading literature learning",
  sustainability: "sustainable eco reusable organic",
};
const stopWords = new Set([
  "a", "an", "and", "at", "for", "from", "in", "of", "on", "or", "the", "to", "with",
]);
const tokenize = (text) =>
  text.toLowerCase().match(/[a-z0-9]+/g)?.filter((word) => !stopWords.has(word)) ?? [];

function vectorize(tokens, documentFrequency, documentCount) {
  const counts = new Map();
  for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);
  const vector = new Map();
  for (const [word, count] of counts) {
    const frequency = documentFrequency.get(word) ?? 0;
    const inverseDocumentFrequency = Math.log((documentCount + 1) / (frequency + 1)) + 1;
    vector.set(word, (count / tokens.length) * inverseDocumentFrequency);
  }
  return vector;
}

function cosineSimilarity(left, right) {
  let dotProduct = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (const value of left.values()) leftMagnitude += value ** 2;
  for (const value of right.values()) rightMagnitude += value ** 2;
  for (const [word, value] of left) dotProduct += value * (right.get(word) ?? 0);
  if (!leftMagnitude || !rightMagnitude) return 0;
  return dotProduct / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

function rankProducts(selectedInterests, catalogProducts, reviews) {
  const documents = catalogProducts.map((product) =>
    tokenize(`${product.name} ${product.category} ${product.description}`),
  );
  const documentFrequency = new Map();
  for (const document of documents) {
    for (const word of new Set(document)) {
      documentFrequency.set(word, (documentFrequency.get(word) ?? 0) + 1);
    }
  }

  const profileTokens = selectedInterests.flatMap((interest) => tokenize(interests[interest]));
  const profileVector = vectorize(profileTokens, documentFrequency, documents.length);
  const reviewsByProduct = new Map(reviews.map((review) => [review.productId, review]));

  return catalogProducts
    .map((product, index) => {
      const review = reviewsByProduct.get(product.id) ?? { rating: 0, reviewCount: 0, popularity: 0 };
      const similarity = cosineSimilarity(
        profileVector,
        vectorize(documents[index], documentFrequency, documents.length),
      );
      const score = 0.65 * similarity + 0.2 * (review.rating / 5) + 0.15 * (review.popularity / 100);
      return {
        ...product,
        ...review,
        score: Math.round(score * 100),
        matchedInterests: (product.tags ?? []).filter((tag) => selectedInterests.includes(tag)),
      };
    })
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name))
    .slice(0, 3);
}

async function getRecommendations(selectedInterests, { catalogUrl = CATALOG_URL, reviewsUrl = REVIEWS_URL } = {}) {
  const [catalog, reviewData] = await Promise.all([
    fetchJson(`${catalogUrl}/api/products`),
    fetchJson(`${reviewsUrl}/api/reviews`),
  ]);
  return rankProducts(selectedInterests, catalog.products, reviewData.reviews);
}

function createServer({ catalogUrl = CATALOG_URL, reviewsUrl = REVIEWS_URL } = {}) {
  return http.createServer(async (request, response) => {
    const url = new URL(request.url, `http://${request.headers.host ?? "localhost"}`);

    if (request.method === "GET" && url.pathname === "/health") {
      sendJson(response, 200, { status: "ok", service: "recommendations" });
      return;
    }
    if (request.method !== "GET" || url.pathname !== "/api/recommendations") {
      sendJson(response, 404, { error: "Not found." });
      return;
    }

    const selectedInterests = [...new Set((url.searchParams.get("interests") ?? "").split(","))]
      .filter((interest) => Object.hasOwn(interests, interest));
    if (selectedInterests.length === 0) {
      sendJson(response, 400, { error: "Select at least one valid interest." });
      return;
    }

    try {
      sendJson(response, 200, {
        recommendations: await getRecommendations(selectedInterests, { catalogUrl, reviewsUrl }),
      });
    } catch (error) {
      console.error(`Recommendation dependency failed: ${error.message}`);
      sendJson(response, 502, { error: "Recommendations are temporarily unavailable." });
    }
  });
}

if (require.main === module) {
  createServer().listen(PORT, "0.0.0.0", () => console.log(`Recommendations service listening on port ${PORT}`));
}

module.exports = { createServer, getRecommendations, rankProducts };
