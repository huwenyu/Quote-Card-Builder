import { defineConfig, loadEnv } from 'vite'
import * as crypto from 'node:crypto'
import react from '@vitejs/plugin-react'
import tsconfigPaths from "vite-tsconfig-paths";
import { traeBadgePlugin } from 'vite-plugin-trae-solo-badge';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiKey = env.VITE_NANO_BANANA_API_KEY;
  const apiUrl = env.VITE_NANO_BANANA_API_URL;
  const jimengAccessKey = env.VITE_JIMENG_ACCESS_KEY;
  const jimengSecretKey = env.VITE_JIMENG_SECRET_KEY;
  const jimengHost = 'visual.volcengineapi.com';
  const jimengRegion = 'cn-north-1';
  const jimengService = 'cv';

  const hashSha256 = (value: string) => crypto.createHash('sha256').update(value).digest('hex');
  const hmacSha256 = (key: crypto.BinaryLike, value: string) =>
    crypto.createHmac('sha256', key).update(value).digest();
  const toXDate = (date: Date) => date.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const encodeRfc3986 = (value: string) =>
    encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  const buildQuery = (params: Record<string, string>) =>
    Object.keys(params)
      .sort()
      .map((key) => `${encodeRfc3986(key)}=${encodeRfc3986(params[key])}`)
      .join('&');
  const getSignatureKey = (secret: string, date: string, region: string, service: string) => {
    const kDate = hmacSha256(`HMAC-SHA256${secret}`, date);
    const kRegion = hmacSha256(kDate, region);
    const kService = hmacSha256(kRegion, service);
    return hmacSha256(kService, 'request');
  };
  const signJimengRequest = (body: string, query: Record<string, string>) => {
    if (!jimengAccessKey || !jimengSecretKey) {
      throw new Error('Missing Jimeng credentials');
    }
    const now = new Date();
    const xDate = toXDate(now);
    const shortDate = xDate.slice(0, 8);
    const payloadHash = hashSha256(body);
    const canonicalQuery = buildQuery(query);
    const canonicalHeaders = `content-type:application/json\nhost:${jimengHost}\nx-content-sha256:${payloadHash}\nx-date:${xDate}\n`;
    const signedHeaders = 'content-type;host;x-content-sha256;x-date';
    const canonicalRequest = `POST\n/\n${canonicalQuery}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
    const credentialScope = `${shortDate}/${jimengRegion}/${jimengService}/request`;
    const stringToSign = `HMAC-SHA256\n${xDate}\n${credentialScope}\n${hashSha256(canonicalRequest)}`;
    const signature = crypto
      .createHmac('sha256', getSignatureKey(jimengSecretKey, shortDate, jimengRegion, jimengService))
      .update(stringToSign)
      .digest('hex');
    const authorization = `HMAC-SHA256 Credential=${jimengAccessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    return {
      authorization,
      xDate,
      payloadHash,
    };
  };

  return {
    build: {
      sourcemap: 'hidden',
    },
    plugins: [
      react({
        babel: {
          plugins: [
            'react-dev-locator',
          ],
        },
      }),
      traeBadgePlugin({
        variant: 'dark',
        position: 'bottom-right',
        prodOnly: true,
        clickable: true,
        clickUrl: 'https://www.trae.ai/solo?showJoin=1',
        autoTheme: true,
        autoThemeTarget: '#root'
      }),
      tsconfigPaths(),
      {
        name: 'imagen-proxy',
        configureServer(server) {
          server.middlewares.use('/api/imagen', async (req, res) => {
            if (req.method !== 'POST') {
              res.statusCode = 405;
              res.end('Method Not Allowed');
              return;
            }
            if (!apiKey || !apiUrl) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: { message: 'Missing API config' } }));
              return;
            }

            const chunks: Uint8Array[] = [];
            await new Promise<void>((resolve) => {
              req.on('data', (chunk) => {
                chunks.push(chunk);
              });
              req.on('end', () => resolve());
            });
            const bodyText = Buffer.concat(chunks).toString('utf-8');
            let body: unknown;
            try {
              body = bodyText ? JSON.parse(bodyText) : {};
            } catch {
              body = {};
            }

            const response = await fetch(apiUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey,
              },
              body: JSON.stringify(body),
            });
            const responseText = await response.text();
            res.statusCode = response.status;
            res.setHeader('Content-Type', response.headers.get('content-type') || 'application/json');
            res.end(responseText);
          });
          server.middlewares.use('/api/image', async (req, res) => {
            const url = typeof req.url === 'string' ? new URL(req.url, 'http://localhost') : null;
            const target = url?.searchParams.get('url');
            if (!target) {
              res.statusCode = 400;
              res.end('Missing url');
              return;
            }
            try {
              const response = await fetch(target);
              if (!response.ok) {
                res.statusCode = response.status;
                res.end(await response.text());
                return;
              }
              const contentType = response.headers.get('content-type');
              if (contentType) res.setHeader('Content-Type', contentType);
              const buffer = Buffer.from(await response.arrayBuffer());
              res.end(buffer);
            } catch (error) {
              res.statusCode = 500;
              res.end('Image fetch failed');
            }
          });
          server.middlewares.use('/api/jimeng', async (req, res) => {
            if (req.method !== 'POST') {
              res.statusCode = 405;
              res.end('Method Not Allowed');
              return;
            }
            if (!jimengAccessKey || !jimengSecretKey) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: { message: 'Missing Jimeng config' } }));
              return;
            }
            const chunks: Uint8Array[] = [];
            await new Promise<void>((resolve) => {
              req.on('data', (chunk) => {
                chunks.push(chunk);
              });
              req.on('end', () => resolve());
            });
            const bodyText = Buffer.concat(chunks).toString('utf-8');
            let payload: { prompt?: string } = {};
            try {
              payload = bodyText ? JSON.parse(bodyText) : {};
            } catch {
              payload = {};
            }
            const prompt = payload.prompt?.trim();
            if (!prompt) {
              res.statusCode = 400;
              res.end('Missing prompt');
              return;
            }

            const submitBody = JSON.stringify({
              req_key: 'jimeng_t2i_v40',
              prompt,
              force_single: true,
              width: 1728,
              height: 2304,
              scale: 0.5,
            });
            const submitQuery = { Action: 'CVSync2AsyncSubmitTask', Version: '2022-08-31' };
            const submitSignature = signJimengRequest(submitBody, submitQuery);
            const submitResponse = await fetch(`https://${jimengHost}/?${buildQuery(submitQuery)}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Date': submitSignature.xDate,
                'X-Content-Sha256': submitSignature.payloadHash,
                Authorization: submitSignature.authorization,
              },
              body: submitBody,
            });
            const submitText = await submitResponse.text();
            if (!submitResponse.ok) {
              res.statusCode = submitResponse.status;
              res.setHeader('Content-Type', 'application/json');
              res.end(submitText);
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
              res.setHeader('Content-Type', 'application/json');
              res.end(submitText || JSON.stringify({ error: { message: 'Missing task_id' } }));
              return;
            }

            const resultQuery = { Action: 'CVSync2AsyncGetResult', Version: '2022-08-31' };
            const resultBody = JSON.stringify({
              req_key: 'jimeng_t2i_v40',
              task_id: taskId,
              req_json: JSON.stringify({ return_url: false }),
            });
            const maxAttempts = 20;
            for (let i = 0; i < maxAttempts; i++) {
              const resultSignature = signJimengRequest(resultBody, resultQuery);
              const resultResponse = await fetch(`https://${jimengHost}/?${buildQuery(resultQuery)}`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'X-Date': resultSignature.xDate,
                  'X-Content-Sha256': resultSignature.payloadHash,
                  Authorization: resultSignature.authorization,
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
              if (status === 'done') {
                const base64 = resultJson?.data?.binary_data_base64?.[0];
                const imageUrl = resultJson?.data?.image_urls?.[0];
                if (base64 || imageUrl) {
                  res.statusCode = 200;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ image_base64: base64, image_url: imageUrl }));
                  return;
                }
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(resultText || JSON.stringify({ error: { message: 'Empty result' } }));
                return;
              }
              if (status === 'expired' || status === 'not_found') {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(resultText || JSON.stringify({ error: { message: 'Task expired' } }));
                return;
              }
              await new Promise((resolve) => setTimeout(resolve, 1200));
            }
            res.statusCode = 504;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: { message: 'Jimeng timeout' } }));
          });
        },
      },
    ],
  };
})
