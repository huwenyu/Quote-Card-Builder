import type { IncomingMessage, ServerResponse } from "http";

function getUrlParam(req: IncomingMessage) {
  const url = req.url ? new URL(req.url, "http://localhost") : null;
  return url?.searchParams.get("url") || "";
}

export default async function handler(req: IncomingMessage & { method?: string }, res: ServerResponse) {
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.end("Method Not Allowed");
    return;
  }

  const target = getUrlParam(req);
  if (!target) {
    res.statusCode = 400;
    res.end("Missing url");
    return;
  }

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    res.statusCode = 400;
    res.end("Invalid url");
    return;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    res.statusCode = 400;
    res.end("Invalid protocol");
    return;
  }

  const response = await fetch(parsed.toString());
  if (!response.ok) {
    res.statusCode = response.status;
    res.end(await response.text());
    return;
  }

  const contentType = response.headers.get("content-type");
  if (contentType) res.setHeader("Content-Type", contentType);
  const buffer = Buffer.from(await response.arrayBuffer());
  res.end(buffer);
}
