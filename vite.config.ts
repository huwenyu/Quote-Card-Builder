import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from "vite-tsconfig-paths";
import { traeBadgePlugin } from 'vite-plugin-trae-solo-badge';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiKey = env.VITE_NANO_BANANA_API_KEY;
  const apiUrl = env.VITE_NANO_BANANA_API_URL;

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
        },
      },
    ],
  };
})
