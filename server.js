const { spawn } = require("node:child_process");
const path = require("node:path");

const root = __dirname;
const ports = {
  storefront: 3000,
  catalog: 3001,
  search: 3002,
  recommendations: 3003,
  reviews: 3004,
};
const baseUrl = (port) => `http://127.0.0.1:${port}`;
const services = [
  {
    name: "catalog",
    port: ports.catalog,
    file: "services/catalog/server.js",
  },
  {
    name: "reviews",
    port: ports.reviews,
    file: "services/reviews/server.js",
  },
  {
    name: "search",
    port: ports.search,
    file: "services/search/server.js",
    env: {
      CATALOG_URL: baseUrl(ports.catalog),
      REVIEWS_URL: baseUrl(ports.reviews),
    },
  },
  {
    name: "recommendations",
    port: ports.recommendations,
    file: "services/recommendations/server.js",
    env: {
      CATALOG_URL: baseUrl(ports.catalog),
      REVIEWS_URL: baseUrl(ports.reviews),
    },
  },
  {
    name: "storefront",
    port: ports.storefront,
    file: "services/storefront/server.js",
    env: {
      SEARCH_URL: baseUrl(ports.search),
      RECOMMENDATIONS_URL: baseUrl(ports.recommendations),
    },
  },
];

const children = [];
let shuttingDown = false;

function stopServices(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (child.exitCode === null && !child.killed) child.kill();
  }
  process.exitCode = exitCode;
}

for (const service of services) {
  const child = spawn(process.execPath, [path.join(root, service.file)], {
    cwd: root,
    env: {
      ...process.env,
      ...service.env,
      PORT: String(service.port),
    },
    stdio: "inherit",
  });
  children.push(child);
  child.on("error", (error) => {
    console.error(`Could not start ${service.name}: ${error.message}`);
    stopServices(1);
  });
  child.on("exit", (code, signal) => {
    if (!shuttingDown && (code !== 0 || signal)) {
      console.error(`${service.name} stopped unexpectedly.`);
      stopServices(code || 1);
    }
  });
}

process.on("SIGINT", () => stopServices());
process.on("SIGTERM", () => stopServices());
console.log("SmartShelf services starting. Storefront: http://localhost:3000");
