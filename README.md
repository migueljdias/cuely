# Cuely

Honest stack picks for coding agents. Cuely is a free, remote MCP server that an agent calls to find out which tools to use, and how to set them up, for what the user is building. No account, and no vendor can pay for placement.

- MCP endpoint (Streamable HTTP): `https://cuely.dev/api/mcp`
- Landing page: `https://cuely.dev`
- Agent summary: `https://cuely.dev/llms.txt`

## Tools

| Tool | Input | Returns |
| --- | --- | --- |
| `recommend_stack` | `description`, `categories?`, `already_using?`, `avoid?`, `needs?` | One pick per category with a one-line reason, the free plan's limits, a watch-out, alternatives, and the source page and date |
| `get_recipe` | `product_type` (slug or words), `include_steps?` | Stack with alternatives, ordered steps with commands and starter files, best practices, pitfalls, compliance notes |
| `compare_tools` | `a`, `b`, `context?` | Two tools in one category side by side, where they differ, and a verdict for the context |
| `list_categories` | `category?` | Categories and tools, or one category's tools with facts |

Each tool returns readable markdown in `content` and the same data as JSON in `structuredContent`.

## Connect an agent

```sh
# Claude Code
claude mcp add --transport http cuely https://cuely.dev/api/mcp
```

Cursor (`~/.cursor/mcp.json`): `{ "mcpServers": { "cuely": { "url": "https://cuely.dev/api/mcp" } } }`
VS Code (`.vscode/mcp.json`): `{ "servers": { "cuely": { "type": "http", "url": "https://cuely.dev/api/mcp" } } }`

## How picks are made

The rule that can't bend: money never touches the ranking. There are no sponsored answers and no affiliate links (a test fails if a URL in the catalog carries query parameters).

1. `src/engine/needs.ts` turns plain words in the description into needs (b2b, regulated, global_tax, open_source, eu, low_cost, edge, nextjs, realtime, fewer_vendors, per_tenant_db, long_running, high_volume).
2. Every tool in `src/catalog/tools.ts` has a published fit weight (−3 to +3) and a reason for each need it's good or bad at, plus an editorial default order in its category.
3. `score = Σ fit[need] + 0.4 × (n − default_rank + 1) + (already_using ? 4 : 0)`. Highest score wins; the default order settles ties.

Answers are deterministic and identical for every caller. No model is called per request, so serving cost stays near zero and the free plan can stay generous.

Free-plan and price facts were read from each vendor's own pricing page on 2026-11-06. Each tool records the page (`pricingUrl`) and date (`verifiedOn`). Where a page was silent, the field is `null`.

## Layout

```
app/                    Next.js App Router: landing page, /api/mcp route, llms.txt, robots, sitemap
src/catalog/            Source of truth: categories, tools (vendor facts), recipes
src/engine/             Need detection, recommend_stack and compare_tools logic
src/mcp/                MCP server (tools), stateless HTTP handler, IP rate limiter, renderers
src/repo/               Catalog access: in-memory seed, or Postgres; seed SQL generator
db/schema.sql           Postgres schema (categories, tools, recipes, recipe_tools, usage_events)
db/seed.sql             Generated from src/catalog by `npm run db:sql`
scripts/                e2e check, SQL generation, seeding a database
tests/                  Vitest: catalog integrity, engine, Postgres (PGlite), MCP over HTTP
```

## Develop

```sh
npm install
npm run dev            # http://localhost:3000, MCP at /api/mcp
npm test               # unit, Postgres (in-memory PGlite) and MCP-over-HTTP tests
npm run build && npm start -- -p 3100
CUELY_URL=http://localhost:3100/api/mcp npm run e2e   # official MCP client against a running server
```

Without `DATABASE_URL`, Cuely serves the bundled catalog from memory. With it, the catalog is read from Postgres (cached for 60 s per instance) and each tool call is logged to `usage_events`.

## Database (Neon)

```sh
npm run db:sql                                  # regenerate db/seed.sql from src/catalog
DATABASE_URL=postgres://... npm run db:seed     # apply schema.sql and the seed in one transaction (idempotent)
```

On Vercel, `vercel-build` runs `scripts/seed.ts --production-only` before `next build`, so every production deploy syncs the catalog in `src/catalog` into the production database. Preview deploys skip it.

`usage_events` stores the tool name, matched recipe, categories and needs, and a daily-salted hash of the caller's IP so unique callers can be counted per day. It never stores IPs or the user's description.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | unset | Postgres (Neon) connection string. Unset means in-memory catalog and no usage log. |
| `CUELY_RATE_LIMIT_PER_MINUTE` | `60` | Requests per minute per IP on `/api/mcp`. Excess gets HTTP 429 with `Retry-After`. |
| `CUELY_HASH_SALT` | `cuely` | Salt for the daily caller hash. Set a random value in production. |

The rate limiter is in memory per function instance: enough to blunt abuse at launch. Swap in a shared store when traffic grows.

## Deploy (Vercel)

1. Create a Vercel project from this repo (framework: Next.js; no build settings to change).
2. Set `DATABASE_URL` (Neon, production only) and `CUELY_HASH_SALT`. The production build creates the tables and loads the catalog.
3. Add `cuely.dev` to the project's domains.

Vercel's Hobby plan is for non-commercial use. Move to Pro before paid plans or the site banner go live.

## Theming

All colour, type, radius and motion values are tokens at the top of `app/globals.css`. A rebrand changes that block, the logo files in `public/brand/` and the icons in `app/` (`icon.svg`, `favicon.ico`, `apple-icon.png`, `opengraph-image.png`, `twitter-image.png`); the components use only the tokens. The brand kit (logo option 55, Funnel Display and Funnel Sans) is documented in `brand.md` alongside the source files. The accent has one job on the page: the dot that marks a pick.

## Adding to the catalog

- A tool: add an entry to `src/catalog/tools.ts` with facts from the vendor's own site, the page you read, and today's date. Give it a unique `baseline` in its category and fit weights with reasons.
- A recipe: add a file under `src/catalog/recipes/`, register it in `src/catalog/index.ts`. Tests check that every tool it names exists in the right category.
- Then run `npm test` and `npm run db:sql`.

### Tool marks and motion

Tool logos come from [simple-icons](https://simpleicons.org) (CC0-1.0), vendored as path data in `src/logos.ts` and drawn in the current text colour at one size, so no tool looks louder than another. Each mark belongs to its owner and only identifies the tool. Tools without a simple-icons mark get a plain monogram. The hero example replays once when it scrolls into view and sections rise in once; both are skipped under `prefers-reduced-motion`, and the page reads fully without JavaScript.
