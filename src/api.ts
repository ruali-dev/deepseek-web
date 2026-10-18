import { setTimeout as sleep } from "node:timers/promises";

export interface SearchOptions {
  query: string;
  count?: number;
  ori_question?: string;
  need_content?: boolean;
  localization?: string;
}

export interface SearchResult {
  url?: unknown;
  title?: unknown;
  summary?: unknown;
  rerank_score?: unknown;
  authority?: unknown;
  date?: unknown;
  snippet?: unknown;
  content?: unknown;
}

export interface SearchResponse {
  results: SearchResult[];
}

export interface FetchResponse {
  title?: unknown;
  content?: unknown;
}

const MAX_QUERY_LENGTH = 128;
const MAX_URL_LENGTH = 8192;
const MAX_429_RETRIES = 3;
const REQUEST_TIMEOUT_MS = 30_000;

export function validateQuery(query: string, name = "query"): void {
  const length = Array.from(query).length;
  if (length < 1 || length > MAX_QUERY_LENGTH || query.trim().length === 0) {
    throw new Error(`${name} must contain 1–${MAX_QUERY_LENGTH} non-whitespace characters.`);
  }
}

export function validateFetchUrl(value: string): void {
  if (value.length > MAX_URL_LENGTH) {
    throw new Error(`url must be at most ${MAX_URL_LENGTH} characters.`);
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("url must be a valid HTTP or HTTPS URL with a host.");
  }
  if ((url.protocol !== "http:" && url.protocol !== "https:") || !url.hostname || url.username || url.password) {
    throw new Error("url must be an HTTP or HTTPS URL with a host and no username or password.");
  }
}

function clampCount(count: number | undefined): number {
  const value = count ?? 10;
  if (!Number.isInteger(value)) {
    throw new Error("count must be an integer.");
  }
  return Math.min(50, Math.max(1, value));
}

function apiErrorMessage(status: number, body: string): string {
  let detail = "";
  try {
    const parsed: unknown = JSON.parse(body);
    if (typeof parsed === "object" && parsed !== null) {
      const record = parsed as Record<string, unknown>;
      const error = record.error;
      if (typeof record.message === "string") {
        detail = record.message;
      } else if (typeof error === "string") {
        detail = error;
      } else if (typeof error === "object" && error !== null && typeof (error as Record<string, unknown>).message === "string") {
        detail = (error as Record<string, string>).message;
      }
    }
  } catch {
    // Error bodies are optional; the status-specific message below is sufficient.
  }

  const explanation = status === 401
    ? "Invalid or missing DeepSeek API key."
    : status === 402
      ? "DeepSeek API balance is insufficient."
      : status === 403
        ? "DeepSeek denied access to this URL (fetch safety policy)."
        : status === 404
          ? "DeepSeek found no fetchable page content for this URL."
          : "Unexpected response from DeepSeek API.";
  return detail
    ? `DeepSeek API returned HTTP ${status}: ${explanation} API message: ${detail}`
    : `DeepSeek API returned HTTP ${status}: ${explanation}`;
}

export class DeepSeekApi {
  private readonly baseUrl: string;

  constructor(
    private readonly apiKey: string,
    baseUrl = "https://api.deepseek.com",
  ) {
    if (!apiKey.trim()) {
      throw new Error("DEEPSEEK_API_KEY is required.");
    }
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  async search(options: SearchOptions): Promise<SearchResponse> {
    validateQuery(options.query);
    if (options.ori_question !== undefined) {
      validateQuery(options.ori_question, "ori_question");
    }

    const payload: Record<string, unknown> = {
      query: options.query,
      count: clampCount(options.count),
      need_content: options.need_content ?? false,
    };
    if (options.ori_question !== undefined) payload.ori_question = options.ori_question;
    if (options.localization !== undefined) payload.localization = options.localization;

    const response = await this.post<SearchResponse>("/v1/tools/search", payload);
    if (!Array.isArray(response.results)) {
      throw new Error("DeepSeek Search API returned an invalid response: results must be an array.");
    }
    return response;
  }

  async fetch(url: string): Promise<FetchResponse> {
    validateFetchUrl(url);
    return this.post<FetchResponse>("/v1/tools/fetch", { url });
  }

  private async post<T>(path: string, payload: Record<string, unknown>): Promise<T> {
    for (let retry = 0; ; retry += 1) {
      let response: Response;
      try {
        response = await globalThis.fetch(`${this.baseUrl}${path}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`DeepSeek API request failed: ${message}`);
      }

      if (response.status === 429 && retry < MAX_429_RETRIES) {
        await response.body?.cancel();
        const delay = 250 * 2 ** retry + Math.random() * 250;
        console.error(`DeepSeek API rate limited the request; retry ${retry + 1}/${MAX_429_RETRIES} in ${Math.round(delay)}ms.`);
        await sleep(delay);
        continue;
      }

      if (!response.ok) {
        const body = await response.text();
        throw new Error(apiErrorMessage(response.status, body));
      }

      try {
        return await response.json() as T;
      } catch {
        throw new Error("DeepSeek API returned invalid JSON.");
      }
    }
  }
}
