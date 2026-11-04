import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import type { ViteDevServer } from "vite";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(async ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "HIGHLIGHTLY_");
  // 서버에서만 불러오며 클라이언트 번들에는 포함하지 않습니다.
  const modulePath = pathToFileURL(
    resolve(process.cwd(), "server/highlightly.mjs"),
  ).href;
  const { footballResponse, resumeLiveRequests } = await import(
    `${modulePath}?t=${Date.now()}`
  );
  const backendPath = pathToFileURL(
    resolve(process.cwd(), "server/backend.mjs"),
  ).href;
  const { handleBackend } = await import(backendPath);
  for (const key of [
    "BALLER_DB_DRIVER",
    "BALLER_DB_DIR",
    "SUPABASE_URL",
    "SUPABASE_SECRET_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "BALLER_ALLOW_LIVE_API",
    "BALLER_ALLOW_BROWSER_IMPORT",
  ]) {
    const values = loadEnv(mode, process.cwd(), key);
    if (values[key]) process.env[key] = values[key];
  }
  const backendUrl = loadEnv(
    mode,
    process.cwd(),
    "BALLER_BACKEND_URL",
  ).BALLER_BACKEND_URL;
  return {
    server: backendUrl
      ? { proxy: { "/api": { target: backendUrl, changeOrigin: false } } }
      : undefined,
    plugins: [
      react(),
      {
        name: "football-api",
        configureServer(server: ViteDevServer) {
          if (backendUrl) return;
          server.middlewares.use((req, res, next) => {
            if (req.url?.startsWith("/api/backend/")) {
              void handleBackend(req, res).catch(() => {
                res.statusCode = 503;
                res.end(JSON.stringify({ error: "Database unavailable" }));
              });
            } else next();
          });
          server.middlewares.use("/api/football", async (req, res) => {
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.setHeader("Cache-Control", "no-store");
            if (
              req.method === "POST" &&
              new URL(req.url ?? "/", "http://localhost").searchParams.get(
                "action",
              ) === "resume"
            ) {
              if (process.env.BALLER_ALLOW_LIVE_API !== "true") {
                res.statusCode = 403;
                res.end(
                  JSON.stringify({
                    error: "서버에서 외부 API 수집을 비활성화했습니다.",
                  }),
                );
                return;
              }
              resumeLiveRequests(env.HIGHLIGHTLY_API_KEY);
              res.end(JSON.stringify({ resumed: true }));
              return;
            }
            if (req.method !== "GET") {
              res.statusCode = 405;
              res.end(JSON.stringify({ error: "GET 요청만 지원합니다." }));
              return;
            }
            const result = await footballResponse(
              new URL(req.url ?? "/", "http://localhost"),
              env.HIGHLIGHTLY_API_KEY,
            );
            if (result.source) res.setHeader("X-Baller-Source", result.source);
            if (result.blockedUntil)
              res.setHeader(
                "X-Baller-Quota-Until",
                String(result.blockedUntil),
              );
            res.statusCode = result.status;
            res.end(JSON.stringify(result.body));
          });
        },
      },
    ],
  };
});
