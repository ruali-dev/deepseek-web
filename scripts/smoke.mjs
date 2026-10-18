import { DeepSeekApi } from "../dist/api.js";

const apiKey = process.env.DEEPSEEK_API_KEY;
if (!apiKey?.trim()) {
  console.error("Set DEEPSEEK_API_KEY before running npm run smoke.");
  process.exitCode = 1;
} else {
  const api = new DeepSeekApi(apiKey, process.env.DEEPSEEK_BASE_URL);
  const search = await api.search({ query: "DeepSeek Search API", count: 2 });
  if (search.results.length === 0) {
    throw new Error("Search returned no results; cannot exercise Fetch.");
  }

  const firstResult = search.results[0];
  if (typeof firstResult.url !== "string") {
    throw new Error("The first Search result did not include a URL.");
  }
  const fetched = await api.fetch(firstResult.url);
  if (typeof fetched.content !== "string") {
    throw new Error("Fetch did not return Markdown content.");
  }

  console.log(`Search returned ${search.results.length} result(s); Fetch returned ${fetched.content.length} Markdown characters.`);
}
