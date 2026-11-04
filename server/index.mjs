import { createServer } from "node:http";
import { handleBackend } from "./backend.mjs";
import { getRepository } from "./db/repository.mjs";
import {
  footballResponse,
  getQuotaStatus,
  resumeLiveRequests,
} from "./highlightly.mjs";
const host = process.env.BALLER_HOST ?? "127.0.0.1",
  port = Number(process.env.BALLER_PORT ?? 3001);
const repo = await getRepository();
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname.startsWith("/api/backend/"))
      return await handleBackend(req, res);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    if (url.pathname !== "/api/football") {
      res.statusCode = 404;
      return res.end(JSON.stringify({ error: "Not found" }));
    }
    if (req.method === "POST" && url.searchParams.get("action") === "resume") {
      if (process.env.BALLER_ALLOW_LIVE_API !== "true") {
        res.statusCode = 403;
        return res.end(
          JSON.stringify({
            error: "외부 API 수집은 서버 설정에서 비활성화되어 있습니다.",
          }),
        );
      }
      resumeLiveRequests(process.env.HIGHLIGHTLY_API_KEY);
      return res.end(JSON.stringify({ resumed: true }));
    }
    if (req.method !== "GET") {
      res.statusCode = 405;
      return res.end(JSON.stringify({ error: "GET 요청만 지원합니다." }));
    }
    const result = await footballResponse(url);
    if(result.source)res.setHeader('X-Baller-Source',result.source);
    if(result.metadata){res.setHeader('X-Baller-Stale',String(result.metadata.stale));if(result.metadata.fetchedAt)res.setHeader('X-Baller-Fetched-At',result.metadata.fetchedAt);}
    if (result.blockedUntil)
      res.setHeader("X-Baller-Quota-Until", String(result.blockedUntil));
    res.statusCode = result.status;
    res.end(JSON.stringify(result.body));
  } catch {
    res.statusCode = 503;
    res.end(JSON.stringify({ error: "서버 처리 중 오류가 발생했습니다." }));
  }
});
server.listen(port, host, () =>
  console.log(
    `BALLER backend: http://${host}:${port} (${repo.kind}, live API ${process.env.BALLER_ALLOW_LIVE_API==='true'?'enabled':'disabled'})`,
  ),
);
async function stop() {
  server.close();
  await repo.close();
  process.exit(0);
}
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
// 상태 조회는 외부 API를 호출하지 않습니다.
getQuotaStatus(process.env.HIGHLIGHTLY_API_KEY);
