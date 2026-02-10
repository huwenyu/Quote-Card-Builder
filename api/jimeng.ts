import type { IncomingMessage, ServerResponse } from "http";

function getEnv(name: string) {
  return process.env[name] || "";
}

function getArkConfig() {
  return {
    apiKey:
      getEnv("ARK_API_KEY") ||
      getEnv("VOLC_ARK_API_KEY") ||
      getEnv("VITE_ARK_API_KEY") ||
      getEnv("VITE_NANO_BANANA_API_KEY"),
    apiUrl:
      getEnv("ARK_API_URL") ||
      getEnv("VOLC_ARK_API_URL") ||
      "https://ark.cn-beijing.volces.com/api/v3/images/generations",
    model:
      getEnv("ARK_IMAGE_MODEL") ||
      getEnv("VOLC_IMAGE_MODEL") ||
      "doubao-seedream-4-5-251128",
    size: getEnv("ARK_IMAGE_SIZE") || getEnv("VOLC_IMAGE_SIZE") || "2K",
  };
}

async function readBody(req: IncomingMessage) {
  const chunks: Uint8Array[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Uint8Array);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

function extractImageFromArk(data: any) {
  const candidates = data?.data || data?.images || data?.result || [];
  if (Array.isArray(candidates) && candidates.length > 0) {
    const item = candidates[0];
    if (item?.url) return { image_url: item.url };
    if (item?.image_url) return { image_url: item.image_url };
    if (item?.b64_json) return { image_base64: item.b64_json };
    if (item?.base64) return { image_base64: item.base64 };
  }
  if (data?.image_url) return { image_url: data.image_url };
  if (data?.image_base64) return { image_base64: data.image_base64 };
  return null;
}

export default async function handler(req: IncomingMessage & { method?: string }, res: ServerResponse) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end("Method Not Allowed");
    return;
  }

  const { apiKey, apiUrl, model, size } = getArkConfig();
  if (!apiKey || !apiUrl) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: { message: "Missing Ark config" } }));
    return;
  }

  const bodyText = await readBody(req);
  let payload: any = {};
  try {
    payload = bodyText ? JSON.parse(bodyText) : {};
  } catch {
    payload = {};
  }
  const prompt = payload.prompt?.trim();
  if (!prompt) {
    res.statusCode = 400;
    res.end("Missing prompt");
    return;
  }

  const arkBody = {
    model,
    prompt,
    sequential_image_generation: payload.sequential_image_generation ?? "disabled",
    response_format: payload.response_format ?? "url",
    size: payload.size ?? size,
    stream: payload.stream ?? false,
    watermark: payload.watermark ?? true,
  };

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(arkBody),
  });

  const responseText = await response.text();
  if (!response.ok) {
    res.statusCode = response.status;
    res.setHeader("Content-Type", "application/json");
    res.end(responseText);
    return;
  }

  let data: any;
  try {
    data = responseText ? JSON.parse(responseText) : {};
  } catch {
    data = {};
  }
  const image = extractImageFromArk(data);
  if (!image) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(responseText || JSON.stringify({ error: { message: "Empty result" } }));
    return;
  }

  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(image));
}
