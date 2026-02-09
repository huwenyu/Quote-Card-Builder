import type { IncomingMessage, ServerResponse } from "http";

function getEnv(name: string) {
  return process.env[name] || "";
}

async function readBody(req: IncomingMessage) {
  const chunks: Uint8Array[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Uint8Array);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

export default async function handler(req: IncomingMessage & { method?: string }, res: ServerResponse) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end("Method Not Allowed");
    return;
  }

  const apiKey = getEnv("VITE_NANO_BANANA_API_KEY") || getEnv("NANO_BANANA_API_KEY");
  const apiUrl = getEnv("VITE_NANO_BANANA_API_URL") || getEnv("NANO_BANANA_API_URL");

  if (!apiKey || !apiUrl) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: { message: "Missing API config" } }));
    return;
  }

  const bodyText = await readBody(req);
  let body: unknown;
  try {
    body = bodyText ? JSON.parse(bodyText) : {};
  } catch {
    body = {};
  }

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(body),
  });

  const responseText = await response.text();
  res.statusCode = response.status;
  res.setHeader("Content-Type", response.headers.get("content-type") || "application/json");
  res.end(responseText);
}
