const http = require("node:http");
const { sendJson } = require("../shared/http");

const PORT = Number(process.env.PORT) || 3004;
const reviews = [
  { productId: "pour-over-kit", rating: 4.8, reviewCount: 156, popularity: 91 },
  { productId: "daily-yoga-mat", rating: 4.7, reviewCount: 203, popularity: 88 },
  { productId: "wireless-earbuds", rating: 4.5, reviewCount: 318, popularity: 98 },
  { productId: "weekend-backpack", rating: 4.6, reviewCount: 142, popularity: 81 },
  { productId: "plant-care-set", rating: 4.4, reviewCount: 87, popularity: 64 },
  { productId: "skin-calm-kit", rating: 4.9, reviewCount: 241, popularity: 86 },
  { productId: "reading-light", rating: 4.3, reviewCount: 76, popularity: 59 },
  { productId: "reusable-bottle", rating: 4.6, reviewCount: 189, popularity: 90 },
];

function createServer() {
  return http.createServer((request, response) => {
    const url = new URL(request.url, `http://${request.headers.host ?? "localhost"}`);

    if (request.method === "GET" && url.pathname === "/health") {
      sendJson(response, 200, { status: "ok", service: "reviews" });
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/reviews") {
      const productId = url.searchParams.get("productId");
      sendJson(response, 200, {
        reviews: productId ? reviews.filter((review) => review.productId === productId) : reviews,
      });
      return;
    }
    sendJson(response, 404, { error: "Not found." });
  });
}

if (require.main === module) {
  createServer().listen(PORT, "0.0.0.0", () => console.log(`Reviews service listening on port ${PORT}`));
}

module.exports = { createServer, reviews };
