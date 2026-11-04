import {
  footballResponse,
  resumeLiveRequests,
} from "../server/highlightly.mjs";
export default async function handler(req, res) {
  if (
    req.method === "POST" &&
    new URL(req.url, "http://localhost").searchParams.get("action") === "resume"
  ) {
    if(process.env.BALLER_ALLOW_LIVE_API!=='true')return res.status(403).json({error:'External collection is disabled.'});
    resumeLiveRequests(process.env.HIGHLIGHTLY_API_KEY);
    return res.status(200).json({ resumed: true });
  }
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "GET 요청만 지원합니다." });
  }
  const result = await footballResponse(new URL(req.url, "http://localhost"));
  if(result.source)res.setHeader('X-Baller-Source',result.source);
  if(result.metadata){res.setHeader('X-Baller-Stale',String(result.metadata.stale));if(result.metadata.fetchedAt)res.setHeader('X-Baller-Fetched-At',result.metadata.fetchedAt);}
  if (result.blockedUntil)
    res.setHeader("X-Baller-Quota-Until", String(result.blockedUntil));
  res.setHeader("Cache-Control", "no-store");
  return res.status(result.status).json(result.body);
}
