const http = require("node:http");
const { fetchJson, sendJson } = require("../shared/http");

const PORT = Number(process.env.PORT) || 3005;
const RECOMMENDATIONS_URL = process.env.RECOMMENDATIONS_URL || "http://127.0.0.1:3003";
const interests = {
  coffee: /\b(coffee|espresso|brewing|beans?)\b/,
  fitness: /\b(fitness|workouts?|yoga|running|exercise)\b/,
  technology: /\b(technology|tech|gadgets?|electronics|audio|earbuds?)\b/,
  home: /\b(home|kitchen|plants?|decor|organization)\b/,
  travel: /\b(travel|luggage|backpacks?|camping|outdoors?)\b/,
  skincare: /\b(skincare|skin care|beauty|skin)\b/,
  reading: /\b(reading|books?|literature|studying)\b/,
  sustainability: /\b(sustainability|sustainable|eco|reusable|organic)\b/,
};
const MAX_BODY_BYTES = 8 * 1024;
const parseBudget = (message) => {
  const match = message.match(/(?:under|below|less than|up to|max(?:imum)?(?: of)?)\s*\$?\s*(\d+(?:\.\d{1,2})?)/i);
  return match ? Number(match[1]) : null;
};

function getIntent(message) {
  const normalizedMessage = message.toLowerCase();
  const selectedInterests = Object.entries(interests)
    .filter(([, pattern]) => pattern.test(normalizedMessage))
    .map(([interest]) => interest);
  return { selectedInterests, budget: parseBudget(message) };
}

async function getShoppingReply(message, recommendationsUrl = RECOMMENDATIONS_URL) {
  const { selectedInterests, budget } = getIntent(message);
  if (/\b(hi|hello|hey)\b/i.test(message)) {
    return {
      reply: "Hi! Tell me what you’re shopping for—like coffee, fitness, or home—and add a budget if you have one.",
      products: [],
    };
  }
  if (selectedInterests.length === 0) {
    return {
      reply: "I can help with coffee, fitness, technology, home, travel, skincare, reading, and sustainable finds. What are you interested in?",
      products: [],
    };
  }

  const url = new URL("/api/recommendations", recommendationsUrl);
  url.searchParams.set("interests", selectedInterests.join(","));
  const data = await fetchJson(url);
  const matchingProducts = data.recommendations.filter((product) =>
    product.matchedInterests?.some((interest) => selectedInterests.includes(interest)),
  );
  const relevantProducts = matchingProducts.length > 0 ? matchingProducts : data.recommendations;
  const products = budget === null
    ? relevantProducts
    : relevantProducts.filter((product) => product.price <= budget);
  const interestNames = selectedInterests.join(" and ");
  const reply = products.length > 0
    ? `Here are ${products.length} ${interestNames} pick${products.length === 1 ? "" : "s"}${budget === null ? "" : ` under $${budget}`}, ranked by relevance, ratings, and popularity.`
    : `I couldn’t find a ${interestNames} match${budget === null ? "" : ` under $${budget}`} in the current sample recommendations. Try a higher budget or another interest.`;
  return { reply, products };
}

function createServer({ recommendationsUrl = RECOMMENDATIONS_URL } = {}) {
  return http.createServer(async (request, response) => {
    const url = new URL(request.url, `http://${request.headers.host ?? "localhost"}`);
    if (request.method === "GET" && url.pathname === "/health") {
      sendJson(response, 200, { status: "ok", service: "chatbot" });
      return;
    }
    if (request.method !== "POST" || url.pathname !== "/api/chat") {
      sendJson(response, 404, { error: "Not found." });
      return;
    }

    let body = "";
    let bodyBytes = 0;
    let tooLarge = false;
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      bodyBytes += Buffer.byteLength(chunk);
      if (bodyBytes > MAX_BODY_BYTES) {
        tooLarge = true;
        return;
      }
      body += chunk;
    });
    request.on("end", async () => {
      if (tooLarge) {
        sendJson(response, 413, { error: "Message is too long." });
        return;
      }
      let payload;
      try {
        payload = JSON.parse(body);
      } catch {
        sendJson(response, 400, { error: "Send a valid JSON message." });
        return;
      }
      if (typeof payload.message !== "string" || payload.message.trim().length === 0 || payload.message.length > 500) {
        sendJson(response, 400, { error: "Message must be between 1 and 500 characters." });
        return;
      }
      try {
        sendJson(response, 200, await getShoppingReply(payload.message.trim(), recommendationsUrl));
      } catch (error) {
        console.error(`Chatbot recommendation request failed: ${error.message}`);
        sendJson(response, 502, { error: "The shopping assistant is temporarily unavailable." });
      }
    });
  });
}

if (require.main === module) {
  createServer().listen(PORT, "0.0.0.0", () => console.log(`Chatbot service listening on port ${PORT}`));
}

module.exports = { createServer, getIntent, getShoppingReply };
