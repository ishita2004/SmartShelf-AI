function sendJson(response, statusCode, data) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(data));
}

async function fetchJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error || `Upstream service returned HTTP ${response.status}.`);
    error.statusCode = response.status;
    throw error;
  }
  return data;
}

module.exports = { fetchJson, sendJson };
