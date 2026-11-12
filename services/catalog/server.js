const http = require("node:http");
const { sendJson } = require("../shared/http");

const PORT = Number(process.env.PORT) || 3001;
const products = [
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

function createServer() {
  return http.createServer((request, response) => {
    const url = new URL(request.url, `http://${request.headers.host ?? "localhost"}`);

    if (request.method === "GET" && url.pathname === "/health") {
      sendJson(response, 200, { status: "ok", service: "catalog" });
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/products") {
      sendJson(response, 200, {
        products,
        categories: [...new Set(products.map((product) => product.category))].sort(),
      });
      return;
    }
    sendJson(response, 404, { error: "Not found." });
  });
}

if (require.main === module) {
  createServer().listen(PORT, "0.0.0.0", () => console.log(`Catalog service listening on port ${PORT}`));
}

module.exports = { createServer, products };
