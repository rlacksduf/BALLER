import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { getRepository } from "../server/db/repository.mjs";
const repo = await getRepository();
try {
  const action = process.argv[2] ?? "status";
  if (action === "import-cache") {
    const file = process.argv[3] ?? resolve(".cache/highlightly.json");
    const saved = JSON.parse(await readFile(file, "utf8"));
    let count = 0;
    for (const [key, value] of Object.entries(saved.cache ?? {})) {
      const match = key.match(/^([a-f0-9]{24}):(\/.*)$/);
      if (!match || value?.result?.status !== 200) continue;
      await repo.ingest(match[2], value.result.body, {
        scope: match[1],
        provider: "highlightly",
        expiresAt: new Date(value.expires).toISOString(),
      });
      count++;
    }
    console.log(
      JSON.stringify({ importedResponses: count, counts: await repo.counts() }),
    );
  } else if (action === "import-json") {
    if (!process.argv[3])
      throw new Error("Provide a JSON file with provider, path, body");
    const input = JSON.parse(await readFile(process.argv[3], "utf8"));
    await repo.ingest(input.path, input.body, {
      provider: input.provider,
      scope: "file-import",
    });
    console.log(JSON.stringify({ counts: await repo.counts() }));
  } else if (action === "prune-cache") {
    const removed = await repo.pruneCache(
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    );
    console.log(
      JSON.stringify({
        removedExpiredResponses: removed,
        normalizedDataPreserved: true,
      }),
    );
  } else if (action === "status")
    console.log(
      JSON.stringify({ database: repo.kind, counts: await repo.counts() }),
    );
  else throw new Error("Unknown action");
} finally {
  await repo.close();
}
