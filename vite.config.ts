import path from 'path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { handleGemini, type GeminiProxyBody } from './api/_gemini';

// 로컬 dev에서 /api/gemini를 서버사이드로 처리 (Vercel 함수와 동일 핸들러).
// 키는 Node dev 서버 컨텍스트에서만 쓰이며 클라이언트 번들에 포함되지 않는다.
function geminiDevProxy(apiKey: string): Plugin {
  return {
    name: 'gemini-dev-proxy',
    configureServer(server) {
      server.middlewares.use('/api/gemini', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: { message: 'POST 요청만 허용됩니다.' } }));
          return;
        }
        let raw = '';
        req.on('data', (chunk) => { raw += chunk; });
        req.on('end', async () => {
          res.setHeader('Content-Type', 'application/json');
          try {
            const body = JSON.parse(raw || '{}') as GeminiProxyBody;
            const { status, json } = await handleGemini(body, apiKey);
            res.statusCode = status;
            res.end(JSON.stringify(json));
          } catch (e) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: { message: e instanceof Error ? e.message : String(e) } }));
          }
        });
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    // 주의: GEMINI_API_KEY를 클라이언트로 주입하지 않는다 (기존 define 제거).
    // 모든 Gemini 호출은 /api/gemini 서버 프록시를 경유한다.
    plugins: [react(), geminiDevProxy(env.GEMINI_API_KEY)],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'pdf': ['pdfjs-dist'],
            'vendor': ['@google/genai', 'zod', 'marked', 'diff'],
            'radix': [
              '@radix-ui/react-tabs',
              '@radix-ui/react-collapsible',
              '@radix-ui/react-dropdown-menu',
              '@radix-ui/react-select',
              '@radix-ui/react-progress',
            ],
          },
        },
      },
    },
  };
});
