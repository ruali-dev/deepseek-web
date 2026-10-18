#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { DeepSeekApi, validateQuery, type SearchResult } from "./api.js";

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

async function toToolResult(action: () => Promise<string>) {
  try {
    return textResult(await action());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`DeepSeek tool error: ${message}`);
    return { ...textResult(message), isError: true };
  }
}

function displayValue(value: unknown): string {
  if (value === undefined || value === null || value === "") return "not provided";
  return typeof value === "string" || typeof value === "number" ? String(value) : JSON.stringify(value);
}
function formatSearchResults(results: SearchResult[]): string {
  if (results.length === 0) return "No search results.";
  return results.map((result, index) => {
    const lines = [
      `Result ${index + 1}`,
      `Title: ${displayValue(result.title)}`,
      `URL: ${displayValue(result.url)}`,
      `Summary: ${displayValue(result.summary)}`,
      `Rerank score: ${displayValue(result.rerank_score)}`,
      `Authority: ${displayValue(result.authority)}`,
      `Date: ${displayValue(result.date)}`,
    ];
    if (result.snippet !== undefined && result.snippet !== null && result.snippet !== "") {
      lines.push(`Snippet: ${displayValue(result.snippet)}`);
    }
    if (result.content !== undefined && result.content !== null && result.content !== "") {
      lines.push(`Content: ${displayValue(result.content)}`);
    }
    return lines.join("\n");
  }).join("\n\n---\n\n");
}

async function main(): Promise<void> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey?.trim()) {
    throw new Error("DEEPSEEK_API_KEY is required. Set it in the MCP server environment.");
  }
  const api = new DeepSeekApi(apiKey, process.env.DEEPSEEK_BASE_URL);
  const server = new McpServer({ name: "deepseek-web", version: "0.1.0" });

  server.registerTool(
    "search",
    {
      description: "Search the web with DeepSeek. Query must be 1–128 Unicode characters; count is clamped to 1–50.",
      inputSchema: {
        query: z.string().refine((value) => {
          try {
            validateQuery(value);
            return true;
          } catch {
            return false;
          }
        }, "query must contain 1–128 non-whitespace characters"),
        count: z.number().int().optional().describe("Number of results; defaults to 10 and is clamped to 1–50."),
        ori_question: z.string().optional().describe("Original user question, 1–128 Unicode characters."),
        need_content: z.boolean().optional().describe("Include page content in search results; defaults to false."),
        localization: z.string().optional().describe("IP address used to localize results."),
      },
    },
    async ({ query, count, ori_question, need_content, localization }) => toToolResult(async () => {
      const response = await api.search({ query, count, ori_question, need_content, localization });
      return formatSearchResults(response.results);
    }),
  );

  server.registerTool(
    "fetch",
    {
      description: "Fetch one HTTP or HTTPS page and return its title and Markdown content.",
      inputSchema: {
        url: z.string().describe("HTTP or HTTPS URL to fetch (maximum 8192 characters)."),
      },
    },
    async ({ url }) => toToolResult(async () => {
      const response = await api.fetch(url);
      if (typeof response.content !== "string") {
        throw new Error("DeepSeek Fetch API returned an invalid response: content must be a string.");
      }
      return `Title: ${displayValue(response.title)}\n\n${response.content}`;
    }),
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("deepseek-web MCP server running on stdio.");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`deepseek-web failed to start: ${message}`);
  process.exitCode = 1;
});
