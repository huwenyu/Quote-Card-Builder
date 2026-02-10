import type { IncomingMessage, ServerResponse } from "http";
import * as crypto from "node:crypto";

function getEnv(name: string) {
  return process.env[name] || "";
}

const HOST = getEnv("VOLC_HOST") || getEnv("JIMENG_HOST") || "visual.volcengineapi.com";
const REGION = getEnv("VOLC_REGION") || getEnv("JIMENG_REGION") || "cn-north-1";
const SERVICE = (getEnv("VOLC_SERVICE") || getEnv("JIMENG_SERVICE") || "cv").toLowerCase();

function hashSha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function hmacSha256(key: crypto.BinaryLike, value: string) {
  return crypto.createHmac("sha256", key).update(value).digest();
}

function toXDate(date: Date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function encodeRfc3986(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (c) =>
    `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function buildQuery(params: Record<string, string>) {
  return Object.keys(params)
    .sort()
    .map((key) => `${encodeRfc3986(key)}=${encodeRfc3986(params[key])}`)
    .join("&");
}

function getSignatureKey(secret: string, date: string, region: string, service: string) {
  const kDate = hmacSha256(`HMAC-SHA256${secret}`, date);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  return hmacSha256(kService, "request");
}

function signRequest(body: string, query: Record<string, string>, accessKey: string, secretKey: string) {
  const now = new Date();
  const xDate = toXDate(now);
  const shortDate = xDate.slice(0, 8);
  const payloadHash = hashSha256(body);
  const canonicalQuery = buildQuery(query);
  const canonicalHeaders = `content-type:application/json\nhost:${HOST}\nx-content-sha256:${payloadHash}\nx-date:${xDate}\n`;
  const signedHeaders = "content-type;host;x-content-sha256;x-date";
  const canonicalRequest = `POST\n/\n${canonicalQuery}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const credentialScope = `${shortDate}/${REGION}/${SERVICE}/request`;
  const canonicalRequestHash = hashSha256(canonicalRequest);
  const stringToSign = `HMAC-SHA256\n${xDate}\n${credentialScope}\n${canonicalRequestHash}`;
  const stringToSignHash = hashSha256(stringToSign);
  const signature = crypto
    .createHmac("sha256", getSignatureKey(secretKey, shortDate, REGION, SERVICE))
    .update(stringToSign)
    .digest("hex");
  const authorization = `HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  return {
    authorization,
    xDate,
    payloadHash,
    signatureHash: hashSha256(signature),
    canonicalRequestHash,
    stringToSignHash,
  };
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
  const debugFlag = req.url?.includes("debug=1");

  const accessKey =
    getEnv("VITE_JIMENG_ACCESS_KEY") ||
    getEnv("JIMENG_ACCESS_KEY") ||
    getEnv("VOLC_ACCESS_KEY") ||
    getEnv("VOLC_ACCESS_KEY_ID");
  const secretKey =
    getEnv("VITE_JIMENG_SECRET_KEY") ||
    getEnv("JIMENG_SECRET_KEY") ||
    getEnv("VOLC_SECRET_ACCESS_KEY");
  if (!accessKey || !secretKey) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: { message: "Missing Jimeng config" } }));
    return;
  }

  const bodyText = await readBody(req);
  let payload: { prompt?: string } = {};
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

  const submitBody = JSON.stringify({
    req_key: "jimeng_t2i_v40",
    prompt,
    force_single: true,
    width: 1728,
    height: 2304,
    scale: 0.5,
  });
  const submitQuery = { Action: "CVSync2AsyncSubmitTask", Version: "2022-08-31" };
  const submitSig = signRequest(submitBody, submitQuery, accessKey, secretKey);
  const submitResponse = await fetch(`https://${HOST}/?${buildQuery(submitQuery)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Date": submitSig.xDate,
      "X-Content-Sha256": submitSig.payloadHash,
      Authorization: submitSig.authorization,
    },
    body: submitBody,
  });

  const submitText = await submitResponse.text();
  if (!submitResponse.ok) {
    res.statusCode = submitResponse.status;
    res.setHeader("Content-Type", "application/json");
    if (debugFlag) {
      res.end(
        JSON.stringify({
          error: submitText,
          signature_hash: submitSig.signatureHash,
          canonical_request_hash: submitSig.canonicalRequestHash,
          string_to_sign_hash: submitSig.stringToSignHash,
        })
      );
    } else {
      res.end(submitText);
    }
    return;
  }

  let submitJson: any;
  try {
    submitJson = submitText ? JSON.parse(submitText) : {};
  } catch {
    submitJson = {};
  }
  const taskId = submitJson?.data?.task_id;
  if (!taskId) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(submitText || JSON.stringify({ error: { message: "Missing task_id" } }));
    return;
  }

  const resultQuery = { Action: "CVSync2AsyncGetResult", Version: "2022-08-31" };
  const resultBody = JSON.stringify({
    req_key: "jimeng_t2i_v40",
    task_id: taskId,
    req_json: JSON.stringify({ return_url: false }),
  });

  for (let i = 0; i < 20; i += 1) {
    const resultSig = signRequest(resultBody, resultQuery, accessKey, secretKey);
    const resultResponse = await fetch(`https://${HOST}/?${buildQuery(resultQuery)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Date": resultSig.xDate,
        "X-Content-Sha256": resultSig.payloadHash,
        Authorization: resultSig.authorization,
      },
      body: resultBody,
    });

    const resultText = await resultResponse.text();
    let resultJson: any;
    try {
      resultJson = resultText ? JSON.parse(resultText) : {};
    } catch {
      resultJson = {};
    }
    const status = resultJson?.data?.status;
    if (status === "done") {
      const base64 = resultJson?.data?.binary_data_base64?.[0];
      const imageUrl = resultJson?.data?.image_urls?.[0];
      if (base64 || imageUrl) {
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ image_base64: base64, image_url: imageUrl }));
        return;
      }
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      if (debugFlag) {
        res.end(
          JSON.stringify({
            error: resultText || "Empty result",
            signature_hash: resultSig.signatureHash,
            canonical_request_hash: resultSig.canonicalRequestHash,
            string_to_sign_hash: resultSig.stringToSignHash,
          })
        );
      } else {
        res.end(resultText || JSON.stringify({ error: { message: "Empty result" } }));
      }
      return;
    }
    if (status === "expired" || status === "not_found") {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(resultText || JSON.stringify({ error: { message: "Task expired" } }));
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1200));
  }

  res.statusCode = 504;
  res.setHeader("Content-Type", "application/json");
  res.end(
    JSON.stringify({
      error: { message: "Jimeng timeout" },
      ...(debugFlag
        ? {
            signature_hash: "timeout",
          }
        : {}),
    })
  );
}
