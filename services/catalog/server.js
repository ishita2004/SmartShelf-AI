const http = require("node:http");
const { Pool } = require("pg");
const { sendJson } = require("../shared/http");

const PORT = Number(process.env.PORT) || 3001;
const seedProducts = [
  {
    id: "pour-over-kit",
    name: "Pour-over Coffee Starter Kit",
    category: "Coffee",
    price: 34,
    description: "Brew better coffee at home with a ceramic dripper, reusable filter, and freshly roasted beans.",
    tags: ["coffee", "home", "sustainability"],
  },
  {
    id: "daily-yoga-mat",
    name: "Everyday Yoga Mat",
    category: "Fitness",
    price: 42,
    description: "A grippy, cushioned mat for yoga, stretching, strength workouts, and mindful movement.",
    tags: ["fitness", "home", "sustainability"],
  },
  {
    id: "wireless-earbuds",
    name: "SoundGo Wireless Earbuds",
    category: "Technology",
    price: 59,
    description: "Lightweight wireless audio with clear sound for your commute, workouts, and travel days.",
    tags: ["technology", "fitness", "travel"],
  },
  {
    id: "weekend-backpack",
    name: "Weekender Travel Backpack",
    category: "Travel",
    price: 68,
    description: "A durable carry-on backpack with smart pockets for weekend trips, hiking, and everyday adventures.",
    tags: ["travel", "sustainability"],
  },
  {
    id: "plant-care-set",
    name: "Indoor Plant Care Set",
    category: "Home",
    price: 27,
    description: "Simple tools and organic plant food to help your indoor garden and home decor thrive.",
    tags: ["home", "sustainability"],
  },
  {
    id: "skin-calm-kit",
    name: "Skin Calm Skincare Set",
    category: "Skincare",
    price: 38,
    description: "A gentle skincare routine with hydrating, fragrance-free essentials for everyday wellness.",
    tags: ["skincare"],
  },
  {
    id: "reading-light",
    name: "Clip-on Reading Light",
    category: "Reading",
    price: 19,
    description: "A rechargeable LED book light for reading, studying, and learning at home or on the go.",
    tags: ["reading", "technology", "travel"],
  },
  {
    id: "reusable-bottle",
    name: "Trail Reusable Water Bottle",
    category: "Outdoors",
    price: 25,
    description: "A reusable insulated bottle for workouts, hiking, travel, and lower-waste everyday hydration.",
    tags: ["fitness", "travel", "sustainability"],
  },
];

const pool = new Pool({
  host: process.env.PGHOST || "127.0.0.1",
  port: Number(process.env.PGPORT) || 5432,
  database: process.env.PGDATABASE || "smartshelf",
  user: process.env.PGUSER || "smartshelf",
  password: process.env.PGPASSWORD || "smartshelf-dev-password",
  connectionTimeoutMillis: 5000,
});

async function initializeDatabase(database = pool) {
  await database.query(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
      description TEXT NOT NULL,
      tags JSONB NOT NULL DEFAULT '[]'::jsonb
    )
  `);

  for (const product of seedProducts) {
    await database.query(
      `INSERT INTO products (id, name, category, price, description, tags)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO NOTHING`,
      [product.id, product.name, product.category, product.price, product.description, JSON.stringify(product.tags)],
    );
  }
}

async function listProducts(database = pool) {
  const { rows } = await database.query(
    "SELECT id, name, category, price, description, tags FROM products ORDER BY name",
  );
  return rows.map((row) => ({ ...row, price: Number(row.price) }));
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
        console.error(`PostgreSQL unavailable (attempt ${attempt}/${attempts}): ${error.message}`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
  }
  throw new Error(`Could not connect to PostgreSQL after ${attempts} attempts: ${lastError.message}`);
}

function createServer({ loadProducts = listProducts } = {}) {
  return http.createServer(async (request, response) => {
    const url = new URL(request.url, `http://${request.headers.host ?? "localhost"}`);

    if (request.method === "GET" && url.pathname === "/health") {
      sendJson(response, 200, { status: "ok", service: "catalog" });
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/products") {
      try {
        const products = await loadProducts();
        sendJson(response, 200, {
          products,
          categories: [...new Set(products.map((product) => product.category))].sort(),
        });
      } catch (error) {
        console.error(`Catalog database query failed: ${error.message}`);
        sendJson(response, 503, { error: "Product catalog is temporarily unavailable." });
      }
      return;
    }
    sendJson(response, 404, { error: "Not found." });
  });
}

if (require.main === module) {
  connectWithRetry(() => pool.connect().then((client) => client.release()))
    .then(() => initializeDatabase())
    .then(() => {
      createServer().listen(PORT, "0.0.0.0", () => console.log(`Catalog service listening on port ${PORT}`));
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}

module.exports = { connectWithRetry, createServer, initializeDatabase, listProducts, seedProducts };
