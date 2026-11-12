const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { fetchJson, sendJson } = require("../shared/http");

const PORT = Number(process.env.PORT) || 3000;
const INDEX_FILE = path.join(__dirname, "public", "index.html");
const SEARCH_URL = process.env.SEARCH_URL || "http://127.0.0.1:3002";
const RECOMMENDATIONS_URL = process.env.RECOMMENDATIONS_URL || "http://127.0.0.1:3003";

function createServer({ searchUrl = SEARCH_URL, recommendationsUrl = RECOMMENDATIONS_URL } = {}) {
  return http.createServer(async (request, response) => {
    const url = new URL(request.url, `http://${request.headers.host ?? "localhost"}`);

    if (request.method === "GET" && url.pathname === "/health") {
      sendJson(response, 200, { status: "ok", service: "storefront" });
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/products") {
      const upstream = new URL("/api/search", searchUrl);
      upstream.search = url.search;
      try {
        sendJson(response, 200, await fetchJson(upstream));
      } catch (error) {
        const statusCode = error.statusCode === 400 ? 400 : 502;
        if (statusCode !== 400) console.error(`Search service request failed: ${error.message}`);
        sendJson(response, statusCode, {
          error: statusCode === 400 ? error.message : "Product search is temporarily unavailable.",
        });
      }
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/recommendations") {
      const upstream = new URL("/api/recommendations", recommendationsUrl);
      upstream.search = url.search;
      try {
        sendJson(response, 200, await fetchJson(upstream));
      } catch (error) {
        const statusCode = error.statusCode === 400 ? 400 : 502;
        if (statusCode !== 400) console.error(`Recommendation service request failed: ${error.message}`);
        sendJson(response, statusCode, {
          error: statusCode === 400 ? error.message : "Recommendations are temporarily unavailable.",
        });
      }
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
  createServer().listen(PORT, "0.0.0.0", () => console.log(`Storefront listening on port ${PORT}`));
}

module.exports = { createServer };
