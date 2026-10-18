# deepseek-web

Unofficial, lightweight stdio MCP server for DeepSeek Search and Fetch. This project is not affiliated with, endorsed by, or sponsored by DeepSeek.

## Requirements and installation

Node.js 20 or newer. Install from npm:

```sh
npm install -g deepseek-web
```

Or run it without a global install:

```sh
npx -y deepseek-web
```

For local development:

```sh
npm install
npm run build
node dist/index.js
```

Set `DEEPSEEK_API_KEY` in the MCP server's environment. Obtain a key from [DeepSeek Platform](https://platform.deepseek.com). `DEEPSEEK_BASE_URL` is optional and defaults to `https://api.deepseek.com`.

```sh
export DEEPSEEK_API_KEY=YOUR_KEY
npx -y deepseek-web
```

The server writes diagnostics to stderr. stdout is reserved for MCP's stdio protocol.

## Tools

- `search(query, count?, ori_question?, need_content?, localization?)`: query is required, must contain 1–128 Unicode characters, and cannot be blank. Longer queries return an error; they are never truncated. `count` defaults to 10 and is clamped to 1–50. Results include URL, title, summary, rerank score, authority, date, and snippet when returned by the API.
- `fetch(url)`: retrieves one HTTP(S) page as Markdown. URLs must have a host, cannot contain username/password credentials, and are limited to 8,192 characters.

HTTP 403/404 and other DeepSeek API errors are returned as MCP tool errors with an explanatory message. HTTP 429 responses are retried up to three times with exponential backoff and jitter.

## MCP client configuration

Examples use `npx -y deepseek-web` so the client can launch the package. If configuring before publishing, build locally and replace `command`/`args` with `node` and the absolute path to `dist/index.js`.

### Claude Code

Add to project `.mcp.json`:

```json
{
  "mcpServers": {
    "deepseek-web": {
      "command": "npx",
      "args": ["-y", "deepseek-web"],
      "env": {
        "DEEPSEEK_API_KEY": "${DEEPSEEK_API_KEY}"
      }
    }
  }
}
```

CLI alternative:

```sh
claude mcp add --env DEEPSEEK_API_KEY=YOUR_KEY --transport stdio deepseek-web -- npx -y deepseek-web
```

See [Claude Code MCP configuration](https://code.claude.com/docs/en/mcp).

### OpenCode

Add to `opencode.json` or `opencode.jsonc` (OpenCode V2 local-server dialect):

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "servers": {
      "deepseek-web": {
        "type": "local",
        "command": ["npx", "-y", "deepseek-web"],
        "environment": {
          "DEEPSEEK_API_KEY": "{env:DEEPSEEK_API_KEY}"
        }
      }
    }
  }
}
```

This uses OpenCode's `mcp.servers`, `type: "local"`, `command` array, and `environment` fields; it is not the `mcpServers` JSON dialect. See [OpenCode MCP servers](https://opencode.ai/docs/mcp-servers/).

### Codex

Add to `~/.codex/config.toml` or project `.codex/config.toml`:

```toml
[mcp_servers.deepseek-web]
command = "npx"
args = ["-y", "deepseek-web"]

[mcp_servers.deepseek-web.env]
DEEPSEEK_API_KEY = "YOUR_KEY"
```

CLI alternative:

```sh
codex mcp add deepseek-web --env DEEPSEEK_API_KEY=YOUR_KEY -- npx -y deepseek-web
```

See [Codex MCP configuration](https://learn.chatgpt.com/docs/extend/mcp).

### Cursor (ordinary MCP, not a Plugin)

Add to project `.cursor/mcp.json` or global `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "deepseek-web": {
      "command": "npx",
      "args": ["-y", "deepseek-web"],
      "env": {
        "DEEPSEEK_API_KEY": "${env:DEEPSEEK_API_KEY}"
      }
    }
  }
}
```

Cursor uses the regular MCP configuration file. This package has no Cursor Plugin layout or Marketplace integration. See [Cursor MCP](https://cursor.com/docs/mcp).

## Pricing and limits

DeepSeek's English documentation lists **$0.75 per 1,000 successful Search or Fetch calls**; the Chinese documentation lists **¥5 per 1,000 successful calls**. The account's billing currency and how these figures map to a particular account are **unknown**; verify against DeepSeek's current billing information. DeepSeek documents a limit of **5 QPS** for Search and Fetch (account-level); Fetch may also have an undisclosed per-domain limit. Pricing and limits can change.

## Smoke check

With `DEEPSEEK_API_KEY` set, run:

```sh
npm run smoke
```

The script directly calls Search for a small result set, then Fetches the first returned URL. These are real API calls and may be subject to DeepSeek account limits and billing. Equivalent curl checks:

```sh
curl https://api.deepseek.com/v1/tools/search \
  -H "Authorization: Bearer $DEEPSEEK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query":"DeepSeek Search API","count":5,"need_content":false}'

curl https://api.deepseek.com/v1/tools/fetch \
  -H "Authorization: Bearer $DEEPSEEK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://api-docs.deepseek.com/guides/search/"}'
```

## License

MIT. See [LICENSE](LICENSE).
