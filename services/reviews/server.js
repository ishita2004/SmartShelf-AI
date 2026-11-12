const http = require("node:http");
const { MongoClient } = require("mongodb");
const { sendJson } = require("../shared/http");

const PORT = Number(process.env.PORT) || 3004;
const seedReviews = [
  { productId: "pour-over-kit", rating: 4.8, reviewCount: 156, popularity: 91 },
  { productId: "daily-yoga-mat", rating: 4.7, reviewCount: 203, popularity: 88 },
  { productId: "wireless-earbuds", rating: 4.5, reviewCount: 318, popularity: 98 },
  { productId: "weekend-backpack", rating: 4.6, reviewCount: 142, popularity: 81 },
  { productId: "plant-care-set", rating: 4.4, reviewCount: 87, popularity: 64 },
  { productId: "skin-calm-kit", rating: 4.9, reviewCount: 241, popularity: 86 },
  { productId: "reading-light", rating: 4.3, reviewCount: 76, popularity: 59 },
  { productId: "reusable-bottle", rating: 4.6, reviewCount: 189, popularity: 90 },
];

const mongoClient = new MongoClient(
  process.env.MONGO_URI || `mongodb://${process.env.MONGO_HOST || "127.0.0.1"}:${Number(process.env.MONGO_PORT) || 27017}`,
  {
  auth: {
    username: process.env.MONGO_USER || "smartshelf",
    password: process.env.MONGO_PASSWORD || "smartshelf-dev-password",
  },
  authSource: process.env.MONGO_AUTH_SOURCE || "admin",
  serverSelectionTimeoutMS: 5000,
  },
);
const reviewsCollection = mongoClient.db("smartshelf").collection("reviews");

async function initializeDatabase(collection = reviewsCollection) {
  await collection.createIndex({ productId: 1 }, { unique: true });
  if (await collection.countDocuments() === 0) {
    await collection.insertMany(seedReviews);
  }
}

async function listReviews(productId, collection = reviewsCollection) {
  const filter = productId ? { productId } : {};
  return collection.find(filter, { projection: { _id: 0 } }).toArray();
}

async function connectWithRetry(connect, attempts = 30) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await connect();
      return;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        console.error(`MongoDB unavailable (attempt ${attempt}/${attempts}): ${error.message}`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
  }
  throw new Error(`Could not connect to MongoDB after ${attempts} attempts: ${lastError.message}`);
}

function createServer({ loadReviews = listReviews } = {}) {
  return http.createServer(async (request, response) => {
    const url = new URL(request.url, `http://${request.headers.host ?? "localhost"}`);

    if (request.method === "GET" && url.pathname === "/health") {
      sendJson(response, 200, { status: "ok", service: "reviews" });
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/reviews") {
      const productId = url.searchParams.get("productId");
      try {
        sendJson(response, 200, { reviews: await loadReviews(productId) });
      } catch (error) {
        console.error(`Reviews database query failed: ${error.message}`);
        sendJson(response, 503, { error: "Product reviews are temporarily unavailable." });
      }
      return;
    }
    sendJson(response, 404, { error: "Not found." });
  });
}

if (require.main === module) {
  connectWithRetry(() => mongoClient.connect())
    .then(() => initializeDatabase())
    .then(() => {
      createServer().listen(PORT, "0.0.0.0", () => console.log(`Reviews service listening on port ${PORT}`));
    })
    .catch(async (error) => {
      console.error(error.message);
      await mongoClient.close();
      process.exitCode = 1;
    });
}

module.exports = { connectWithRetry, createServer, initializeDatabase, listReviews, seedReviews };
