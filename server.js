const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const PORT = Number(process.env.PORT) || 3000;
const INDEX_FILE = path.join(__dirname, "public", "index.html");

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

const products = [
  {
    id: "pour-over-kit",
    name: "Pour-over Coffee Starter Kit",
    category: "Coffee",
    price: 34,
    rating: 4.8,
    reviewCount: 156,
    popularity: 91,
    description: "Brew better coffee at home with a ceramic dripper, reusable filter, and freshly roasted beans.",
    tags: ["coffee", "home", "sustainability"],
  },
  {
    id: "daily-yoga-mat",
    name: "Everyday Yoga Mat",
    category: "Fitness",
    price: 42,
    rating: 4.7,
    reviewCount: 203,
    popularity: 88,
    description: "A grippy, cushioned mat for yoga, stretching, strength workouts, and mindful movement.",
    tags: ["fitness", "home", "sustainability"],
  },
  {
    id: "wireless-earbuds",
    name: "SoundGo Wireless Earbuds",
    category: "Technology",
    price: 59,
    rating: 4.5,
    reviewCount: 318,
    popularity: 98,
    description: "Lightweight wireless audio with clear sound for your commute, workouts, and travel days.",
    tags: ["technology", "fitness", "travel"],
  },
  {
    id: "weekend-backpack",
    name: "Weekender Travel Backpack",
    category: "Travel",
    price: 68,
    rating: 4.6,
    reviewCount: 142,
    popularity: 81,
    description: "A durable carry-on backpack with smart pockets for weekend trips, hiking, and everyday adventures.",
    tags: ["travel", "sustainability"],
  },
  {
    id: "plant-care-set",
    name: "Indoor Plant Care Set",
    category: "Home",
    price: 27,
    rating: 4.4,
    reviewCount: 87,
    popularity: 64,
    description: "Simple tools and organic plant food to help your indoor garden and home decor thrive.",
    tags: ["home", "sustainability"],
  },
  {
    id: "skin-calm-kit",
    name: "Skin Calm Skincare Set",
    category: "Skincare",
    price: 38,
    rating: 4.9,
    reviewCount: 241,
    popularity: 86,
    description: "A gentle skincare routine with hydrating, fragrance-free essentials for everyday wellness.",
    tags: ["skincare"],
  },
  {
    id: "reading-light",
    name: "Clip-on Reading Light",
    category: "Reading",
    price: 19,
    rating: 4.3,
    reviewCount: 76,
    popularity: 59,
    description: "A rechargeable LED book light for reading, studying, and learning at home or on the go.",
    tags: ["reading", "technology", "travel"],
  },
  {
    id: "reusable-bottle",
    name: "Trail Reusable Water Bottle",
    category: "Outdoors",
    price: 25,
    rating: 4.6,
    reviewCount: 189,
    popularity: 90,
    description: "A reusable insulated bottle for workouts, hiking, travel, and lower-waste everyday hydration.",
    tags: ["fitness", "travel", "sustainability"],
  },
];

const stopWords = new Set([
  "a", "an", "and", "at", "for", "from", "in", "of", "on", "or", "the", "to", "with",
]);
const tokenize = (text) =>
  text.toLowerCase().match(/[a-z0-9]+/g)?.filter((word) => !stopWords.has(word)) ?? [];

const documents = products.map((product) => tokenize(`${product.name} ${product.category} ${product.description}`));
const documentFrequency = new Map();
for (const document of documents) {
  for (const word of new Set(document)) {
    documentFrequency.set(word, (documentFrequency.get(word) ?? 0) + 1);
  }
}

function vectorize(tokens) {
  const counts = new Map();
  for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);

  const vector = new Map();
  for (const [word, count] of counts) {
    const frequency = documentFrequency.get(word) ?? 0;
    const inverseDocumentFrequency = Math.log((products.length + 1) / (frequency + 1)) + 1;
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

function getRecommendations(selectedInterests) {
  const profileTokens = selectedInterests.flatMap((interest) => tokenize(interests[interest]));
  const profileVector = vectorize(profileTokens);

  return products
    .map((product, index) => ({
      ...product,
      score: 0.65 * cosineSimilarity(profileVector, vectorize(documents[index]))
        + 0.2 * (product.rating / 5)
        + 0.15 * (product.popularity / 100),
      matchedInterests: product.tags.filter((tag) => selectedInterests.includes(tag)),
    }))
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name))
    .slice(0, 3)
    .map(({ score, ...product }) => ({ ...product, score: Math.round(score * 100) }));
}

function getProducts({ query = "", category = "", sort = "popular" } = {}) {
  const normalizedQuery = query.trim().toLowerCase();
  const filteredProducts = products.filter((product) => {
    const matchesCategory = !category || product.category === category;
    const searchableText = `${product.name} ${product.category} ${product.description}`.toLowerCase();
    return matchesCategory && (!normalizedQuery || searchableText.includes(normalizedQuery));
  });

  const comparators = {
    popular: (left, right) => right.popularity - left.popularity,
    rating: (left, right) => right.rating - left.rating || right.reviewCount - left.reviewCount,
    "price-low": (left, right) => left.price - right.price,
    "price-high": (left, right) => right.price - left.price,
  };

  return filteredProducts.sort(
    (left, right) => comparators[sort](left, right) || left.name.localeCompare(right.name),
  );
}

function sendJson(response, statusCode, data) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(data));
}

function createServer() {
  return http.createServer((request, response) => {
    const url = new URL(request.url, `http://${request.headers.host ?? "localhost"}`);

    if (request.method === "GET" && url.pathname === "/health") {
      sendJson(response, 200, { status: "ok" });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/recommendations") {
      const selectedInterests = [...new Set((url.searchParams.get("interests") ?? "").split(","))]
        .filter((interest) => Object.hasOwn(interests, interest));

      if (selectedInterests.length === 0) {
        sendJson(response, 400, { error: "Select at least one valid interest." });
        return;
      }

      sendJson(response, 200, { recommendations: getRecommendations(selectedInterests) });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/products") {
      const category = url.searchParams.get("category") ?? "";
      const query = (url.searchParams.get("q") ?? "").slice(0, 100);
      const sort = url.searchParams.get("sort") ?? "popular";
      const categories = [...new Set(products.map((product) => product.category))].sort();
      const validSorts = ["popular", "rating", "price-low", "price-high"];

      if (category && !categories.includes(category)) {
        sendJson(response, 400, { error: "Select a valid product category." });
        return;
      }

      if (!validSorts.includes(sort)) {
        sendJson(response, 400, { error: "Select a valid sort order." });
        return;
      }

      sendJson(response, 200, { products: getProducts({ query, category, sort }), categories });
      return;
    }

    if (request.method === "GET" && url.pathname === "/") {
      response.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      });
      fs.createReadStream(INDEX_FILE).pipe(response);
      return;
    }

    sendJson(response, 404, { error: "Not found." });
  });
}

if (require.main === module) {
  createServer().listen(PORT, "0.0.0.0", () => {
    console.log(`SmartShelf AI listening on port ${PORT}`);
  });
}

module.exports = { createServer, getProducts, getRecommendations };
