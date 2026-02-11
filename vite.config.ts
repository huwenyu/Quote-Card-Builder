import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from "vite-tsconfig-paths";
import { traeBadgePlugin } from 'vite-plugin-trae-solo-badge';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiKey = env.VITE_NANO_BANANA_API_KEY;
  const apiUrl = env.VITE_NANO_BANANA_API_URL;
  const arkApiKey =
    env.ARK_API_KEY ||
    env.VOLC_ARK_API_KEY ||
    env.VITE_ARK_API_KEY ||
    env.VITE_NANO_BANANA_API_KEY;
  const arkApiUrl =
    env.ARK_API_URL ||
    env.VOLC_ARK_API_URL ||
    'https://ark.cn-beijing.volces.com/api/v3/images/generations';
  const arkImageModel =
    env.ARK_IMAGE_MODEL ||
    env.VOLC_IMAGE_MODEL ||
    'doubao-seedream-4-5-251128';
  const arkImageSize = env.ARK_IMAGE_SIZE || env.VOLC_IMAGE_SIZE || '2K';
  const deepseekApiKey = env.DEEPSEEK_API_KEY;

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
          server.middlewares.use('/api/deepseek', async (req, res) => {
            if (req.method !== 'POST') {
              res.statusCode = 405;
              res.end('Method Not Allowed');
              return;
            }
            if (!deepseekApiKey) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: { message: 'Missing DeepSeek API key' } }));
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

            try {
              const response = await fetch('https://api.deepseek.com/chat/completions', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${deepseekApiKey}`,
                },
                body: JSON.stringify(body),
              });
              const responseText = await response.text();
              res.statusCode = response.status;
              res.setHeader('Content-Type', response.headers.get('content-type') || 'application/json');
              res.end(responseText);
            } catch (error) {
              console.error('DeepSeek Proxy Error:', error);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: { message: 'Upstream connection failed' } }));
            }
          });
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

            try {
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
            } catch (error) {
              console.error('Imagen Proxy Error:', error);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: { message: 'Upstream connection failed' } }));
            }
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
            if (!arkApiKey || !arkApiUrl) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: { message: 'Missing Ark config' } }));
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
            let payload: any = {};
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

            const arkBody = {
              model: payload.model ?? arkImageModel,
              prompt,
              sequential_image_generation: payload.sequential_image_generation ?? 'disabled',
              response_format: payload.response_format ?? 'url',
              size: payload.size ?? arkImageSize,
              stream: payload.stream ?? false,
              watermark: payload.watermark ?? true,
            };
            const response = await fetch(arkApiUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${arkApiKey}`,
              },
              body: JSON.stringify(arkBody),
            });
            const responseText = await response.text();
            if (!response.ok) {
              res.statusCode = response.status;
              res.setHeader('Content-Type', 'application/json');
              res.end(responseText);
              return;
            }

            let data: any;
            try {
              data = responseText ? JSON.parse(responseText) : {};
            } catch {
              data = {};
            }
            const list = data?.data || data?.images || data?.result || [];
            let imageUrl = data?.image_url;
            let imageBase64 = data?.image_base64;
            if (Array.isArray(list) && list.length > 0) {
              const item = list[0];
              imageUrl = imageUrl || item?.url || item?.image_url;
              imageBase64 = imageBase64 || item?.b64_json || item?.base64;
            }
            if (!imageUrl && !imageBase64) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(responseText || JSON.stringify({ error: { message: 'Empty result' } }));
              return;
            }
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ image_url: imageUrl, image_base64: imageBase64 }));
          });
        },
      },
    ],
  };
})
