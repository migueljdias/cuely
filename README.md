# Cuely

Honest stack picks for coding agents. Cuely is a free, remote MCP server that an agent calls to find out which tools to use, and how to set them up, for what the user is building. It needs a free account (OAuth sign-in or an API key), and no vendor can pay for placement. The website itself is open to everyone.

- MCP endpoint (Streamable HTTP): `https://cuely.dev/api/mcp`
- Landing page: `https://cuely.dev`
- Agent summary: `https://cuely.dev/llms.txt`

## Tools

| Tool | Input | Returns |
| --- | --- | --- |
| `recommend_stack` | `description`, `answers?`, `assume_defaults?`, `detail?`, `categories?`, `already_using?`, `avoid?`, `needs?` | A summary first: the top picks, the monthly cost at 1,000 users and the 2-3 catches that matter. Then one pick per category the product needs, with a reason and an alternative (`detail: "full"` adds free plans, prices and sources). Returns up to 3 questions instead when a missing fact would change the picks, and `outside_coverage` for products Cuely doesn't cover |
| `start_project` | `description`, `answers?`, `needs?`, `already_using?`, `avoid?` | One call at the start of a build: the stack (as `recommend_stack`, without questions; assumptions are listed) plus the security and compliance checklist for that product and stack, split into "before real data goes in" and "before launch", each item with its source page. Rules in `src/catalog/practices.ts` |
| `check_project` | `description`, `using`, `needs?`, `answers?` | A review of a stack that already exists: keep or change for each tool in use (with the tool to move to and why), core parts that are missing, things to watch, and the catches for this kind of product. Same rules and data as `recommend_stack`; a tool in use stays unless another scores more than 4 points higher or its vendor states it doesn't offer what the product's data requires |
| `get_recipe` | `product_type` (slug or words), `include_steps?` | Stack with alternatives, cost at 1,000 users, dated catches, ordered steps with commands and starter files, best practices, pitfalls, compliance notes |
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

1. `src/engine/profile.ts` reads the kind of product: web, phone or both, and whether a phone app is an iPhone app in Swift (Swift, SwiftUI, Xcode, "native iOS", with no Android or cross-platform word), which routes to the `native-ios-app` recipe instead of the Expo one; whether a phone app sends push notifications or reminders, which makes push a core pick instead of an optional one (browser push is flagged as partial coverage); who pays (nobody, users pay you, users pay each other); customers or your own staff; AI, documents, realtime; casual and daily web games and whether results get shared. It decides which categories are shown, which catches lead the answer, and when to ask instead of guess: a question is asked only when the fact is missing and would change the picks. It also flags products outside Cuely's coverage (engine, console, 3D and phone games, hardware, crypto) and partial ones (stores, SMS, video, fast real-time multiplayer).
2. `src/engine/needs.ts` turns plain words in the description into needs (b2b, regulated, global_tax, open_source, eu, low_cost, edge, nextjs, realtime, fewer_vendors, per_tenant_db, long_running, high_volume, rag, usage_billing, google_workspace, counters, spiky, health_data, campaigns). The profile adds mobile, native_ios, marketplace and internal. Product names are masked first, so "Google Workspace" isn't a workspace and "React Native" isn't Next.js.
3. Every tool in `src/catalog/tools.ts` has a published fit weight (−3 to +3) and a reason for each need it's good or bad at, plus an editorial default order in its category.
4. `score = Σ fit[need] + 0.4 × (n − default_rank + 1) + health + compliance + (already_using ? 4 : 0) + (in_recipe ? 1 : 0)`, where `in_recipe` means the recipe Cuely routed to names that tool. Highest score wins; the default order settles ties.

   `health` is measured, not written by hand (`src/freshness/health.ts`): `adoption − outages − security`, between −2.7 and +0.5. Every tool is judged against the typical tool measured the same day (the median), because vendors differ in how readily they post incidents and npm downloads move for the whole market at once. Outages are 0.25 per major and 0.75 per critical incident on the vendor's status page in the last 90 days, counted only beyond the typical vendor's, capped at 1.2, and only when a rival in the same category has a measured status page of its own. Security is 0.25 per high and 0.5 per critical advisory for the tool's package in the last 180 days, capped at 1. Adoption is how much faster or slower the tool's npm downloads grew over three months than the typical package's, when the gap is 10% or more, capped at ±0.5. A signal that can't be read counts as typical. One rank in the default order is worth 0.4, so a tool that starts failing loses close picks to the next one, and the answer says which measurement did it.

   `compliance` is read from each vendor's own pages (`src/freshness/compliance.ts`) and only counts when the product needs it, for tools that hold user data. Health data: a vendor that says it signs a HIPAA BAA gets +1 (+0.5 if only on some plans), one that says it doesn't gets −3. EU data: +1 for an EU region (+0.5 on some plans), −2 for none, −1 for no DPA. Regulated products: +0.5 for a SOC 2 report. A vendor whose pages don't say gets 0 and the answer says "not stated", never "no".

5. The answer leads with the cost at Cuely's published usage profile (`src/catalog/costs.ts`: 1,000 monthly active users, 10 staff for staff tools), each tool's cost with the math in its basis line, and the catches for that kind of product (`src/catalog/catches.ts`), each with its source page and date.

Answers are deterministic and identical for every caller. No model is called per request, so serving cost stays near zero and the free plan can stay generous.

Free-plan and price facts were read from each vendor's own pricing page on 2026-11-06 and 2026-11-07. Each tool records the page (`pricingUrl`) and date (`verifiedOn`). Where a page was silent, the field is `null`.

## Layout

```
app/                    Next.js App Router: landing page, /api/mcp route, llms.txt, robots, sitemap
src/catalog/            Source of truth: categories, tools (vendor facts), recipes
src/engine/             Need detection, recommend_stack and compare_tools logic
src/mcp/                MCP server (tools), stateless HTTP handler, IP rate limiter, renderers
src/repo/               Catalog access: in-memory seed, or Postgres; seed SQL generator
db/schema.sql           Postgres schema (categories, tools, recipes, recipe_tools, usage_events)
db/seed.sql             Generated from src/catalog by `npm run db:sql`
src/freshness/          Reading pricing pages, updating facts from them, and measuring tool health
data/pricing/           Last-read price and limit lines per tool (written by `npm run check:pricing`)
data/facts.json         Price and limit facts re-read from changed pricing pages (written by `npm run update:facts`)
data/compliance.json    What each vendor's pages say on BAAs, DPAs, EU regions and SOC 2 (written by `npm run collect:compliance`)
data/compliance/        Last-read compliance lines per tool
data/signals.json       Measured incidents, advisories and downloads per tool (written by `npm run collect:signals`)
scripts/                e2e check, SQL generation, seeding a database, pricing check
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

## Keeping prices fresh

`npm run check:pricing` reads every tool's `pricingUrl`, keeps the lines that state a price or a limit, and compares them with the last read in `data/pricing/<slug>.json`. It reports the lines that were added or removed, the dollar amounts the catalog quotes (`freeTier`, `paidStartsAt`) that are no longer on the page, and the pages a plain fetch couldn't read.

The **Pricing freshness** workflow (`pricing.yml`) runs it every day, and calls Claude only for pages that changed since the last run. For each page that changed, `npm run update:facts` gives Claude the page's price lines next to the catalog's current wording and asks whether the facts still hold. It runs on the project's own `ANTHROPIC_API_KEY`, which the workflow reads from Infisical: the job signs in as a machine identity with GitHub's OIDC token, so no long-lived key is stored in GitHub. Set the repository variables `INFISICAL_IDENTITY_ID` and `INFISICAL_PROJECT_SLUG` (and `INFISICAL_ENV_SLUG` if the key isn't in `prod`, `INFISICAL_DOMAIN` for the EU or a self-hosted instance). Without a key, changed pages are only reported. A model proposes the wording, but the rule in `src/freshness/facts.ts` decides what is published: every dollar amount in the new wording must be on the page as read that day, and a monthly cost can't move by more than $50 or 3× in one step. Accepted changes are written to `data/facts.json`, which the catalog lays over the hand-written entry in `src/catalog`, and pushed to `main` once the typecheck and tests pass. A page that still says the same only gets a new `verifiedOn` date. Anything held back is filed as an issue for a person.

Options: `--only <slug,slug>`, `--dry-run` (write nothing), `--report <file>`, and `--html-dir <dir>` to read `<dir>/<slug>.html` in place of fetching, for pages that only render in a browser.

## Rankings that follow the data

`npm run collect:signals` measures every tool listed in `src/catalog/sources.ts`: incidents from its status page, advisories for its package from [OSV](https://osv.dev), and npm downloads in two windows. It rewrites `data/signals.json`, and the catalog works each tool's `health` out from that file. No model is called and nobody edits the numbers.

The **Signals** workflow (`signals.yml`) runs it every day, regenerates `db/seed.sql`, runs the typecheck and tests, and pushes the result to `main`, which deploys it. Two guards keep a bad run from moving a ranking: a source that fails keeps its last measured value, and if more than 40% fail the run stops without writing. If the push to `main` is refused (branch protection), it files the report as an issue.

Tests run with `CUELY_NO_SIGNALS=1` (set in `vitest.config.ts`), so the rules are tested apart from the day's data.

## Compliance facts that follow the vendors

`npm run collect:compliance` reads the pages listed in `src/catalog/compliance-sources.ts` (each vendor's security, HIPAA, DPA and regions pages) and keeps the lines that touch four topics: HIPAA BAA, GDPR DPA, EU data region and SOC 2. When a tool's lines change, Claude answers the four questions for that tool, quoting the vendor's own sentence for each, on the same `ANTHROPIC_API_KEY` as the pricing job.

The rule in `src/freshness/compliance.ts` decides what is published to `data/compliance.json`: the quoted sentence must be on the named page as read that day and must mention the topic. A change from "offered" to "not offered" (or back) is held and filed as an issue for a person. A fact the pages no longer state is removed, because "not stated" is the safe direction. A page that fails to load is not treated as a change.

The **Compliance** workflow (`compliance.yml`) runs it every day (Claude reads a tool again only when one of its pages changed) and pushes to `main` once the typecheck and tests pass. On a pull request that changes the page list or the collector, it only checks that every listed page still loads. Tests run with `CUELY_NO_COMPLIANCE=1`.

Answers show these facts only when the description calls for them: health words (patients, therapy, clinic, HIPAA) add the `health_data` need, a HIPAA catch and a BAA line per pick; EU words add EU region and DPA lines. They are the vendors' statements with links, not legal advice.

## CI and security checks

Every pull request and every push to `main` runs two workflows in `.github/workflows`:

- **CI** (`ci.yml`): typecheck, tests, a check that `db/seed.sql` matches the catalog (run `npm run db:sql` if it fails), and a production build.
- **Security** (`security.yml`), also weekly so new advisories surface without a push:
  - **gitleaks** scans the whole git history for committed secrets.
  - **npm audit** fails on high or critical advisories in production dependencies, or critical ones anywhere, and verifies registry signatures.
  - **Semgrep** runs the JavaScript and TypeScript security rules from a pinned `semgrep/semgrep-rules` commit. Mark a reviewed false positive with a `// nosemgrep` comment and a line saying why.

Actions and tools are pinned to exact versions (actions by commit SHA, gitleaks by checksum). Dependabot (`.github/dependabot.yml`) opens weekly update PRs for npm packages and actions.

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
| `CLERK_ISSUER_URL` | from the publishable key | Clerk Frontend API used as the OAuth issuer in the MCP metadata (production: `https://clerk.cuely.dev`). |
| `CUELY_HASH_SALT` | `cuely` | Salt for the daily caller hash. Set a random value in production. |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | unset | Clerk publishable key (`pk_test_...` or `pk_live_...`). Read at build time, so redeploy after setting it. Unset means accounts are off. |
| `CLERK_SECRET_KEY` | unset | Clerk secret key (`sk_test_...` or `sk_live_...`). |
| `PAYMENTS_MODE` | `off` | `off`, `test` or `live`. Anything unexpected falls back to `off`. |
| `STRIPE_SECRET_KEY` | unset | Must start `sk_test_` in test mode and `sk_live_` in live mode, or payments stay off. |
| `STRIPE_PRICE_PRO` | unset | The Stripe price ID (`price_...`) for Pro. |
| `STRIPE_WEBHOOK_SECRET` | unset | The signing secret (`whsec_...`) of the webhook endpoint. |
| `STRIPE_MANAGED_PAYMENTS` | `on` | Stripe Managed Payments at checkout (Stripe is merchant of record and handles tax). Set `off` to sell as yourself. The product needs an eligible tax code. |
| `CUELY_SITE_URL` | `https://cuely.dev` | Base for Stripe return links. |

Plan limits are counted in Postgres (`api_usage`, one row per account per UTC day), so they hold across function instances. Requests without a valid credential are capped per IP in memory after the credential lookup; the Vercel firewall rate limit caps requests per IP before that.

## Accounts and API keys

The website is open to everyone; the MCP endpoint needs an account (see MCP access below). Signing up (email and password, or Google) is handled by Clerk, which holds the user records. Cuely keeps a small `accounts` row per Clerk user ID (`user_...`) with the plan and Stripe customer ID. `proxy.ts` runs Clerk on pages only; `/api/mcp` and the Stripe webhook never pass through it.

The site runs on two hosts from one deployment. `cuely.dev` serves the landing page, pricing, legal pages, `llms.txt` and the MCP endpoint. `app.cuely.dev` serves `/sign-in`, `/sign-up` and `/account` (its root redirects to `/account`). `proxy.ts` sends each page to its host using `src/hosts.ts`, maps the old `/auth/sign-in` and `/auth/sign-up` paths, and serves a disallow-all `robots.txt` on the app host; `next.config.ts` adds `X-Robots-Tag: noindex` there. The Clerk session is shared because both hosts are under the production domain. Other hosts (previews, localhost) are left alone.

From `/account` a signed-in user can make API keys (Free one, Pro up to 10). A key is shown once; only its SHA-256 hash is stored. An agent sends it as `Authorization: Bearer cuely_...` (or `x-api-key`).

## MCP access and limits

Every POST to `/api/mcp` needs one of:

- **OAuth (Claude's custom connector, other OAuth MCP clients).** A request without a credential gets HTTP 401 with `WWW-Authenticate: Bearer resource_metadata="https://cuely.dev/.well-known/oauth-protected-resource/api/mcp"`. That RFC 9728 document names Clerk (`https://clerk.cuely.dev`) as the authorization server. The client registers with a Client ID Metadata Document (CIMD; dynamic client registration is off), signs the person in with Clerk and sends the access token as a Bearer. `src/mcp/oauth.ts` verifies it with `@clerk/backend` `authenticateRequest(..., { acceptsToken: "oauth_token", audience: "https://cuely.dev/api/mcp" })`. The Clerk production instance has this URL registered as an MCP server (audience claim and CIMD on). The first connector sign-in creates the Free account row.
- **API key.** `Authorization: Bearer cuely_...` from `/account`. For Cursor, VS Code, Claude Code and scripts.

Limits are per account, across all its keys and connectors (`src/plans.ts`):

| Plan | Tool calls a day (UTC) | Requests a minute | Keys |
| --- | --- | --- | --- |
| Free | 50 | 30 | 1 |
| Pro | 5,000 | 120 | 10 |

Only `tools/call` counts toward the day; connecting and `tools/list` count toward the minute only. Each request is one upsert into `api_usage`. Over a limit gets HTTP 429 with `Retry-After`, the reset time, and an upgrade link on Free; the instance then answers that account from memory until the reset. Responses carry `x-ratelimit-limit`, `x-ratelimit-remaining` and `x-ratelimit-reset` for the daily quota. Key and token lookups are cached for 60 s per instance, so a revoked key or a plan change can take up to a minute. The plan never reaches the recommendation engine, so money cannot touch a ranking.

A browser opening `https://cuely.dev/api/mcp` (Accept `text/html`, no MCP or Authorization headers) is rewritten to `/connect`, a noindexed page with connect steps. Without `DATABASE_URL` outside production (local dev), the endpoint stays open with Free limits counted in memory; production without a database refuses calls. `CUELY_KEY=cuely_... npm run e2e` runs the end-to-end check with a key.

## Payments (Stripe)

Stripe holds all card data. The database stores only the Stripe customer ID, subscription ID, status and period end.

- `/account` starts Stripe Checkout for the Pro price and opens the Stripe customer portal for subscribers.
- `/api/stripe/webhook` verifies the signature, refuses events from the other mode, records each event ID once, and sets the plan from `customer.subscription.*` events (active, trialing or past due means Pro).

Payments are **off** unless `PAYMENTS_MODE` and a matching key are set. Where things stand:

- **Sandbox (done):** the "Cuely Pro" product, a $10 USD monthly price with a SaaS tax code, the webhook at `https://cuely.dev/api/stripe/webhook` (`checkout.session.completed`, `customer.subscription.created`, `.updated`, `.deleted`) and the customer portal exist. `STRIPE_SECRET_KEY` (`sk_test_...`), `STRIPE_PRICE_PRO`, `STRIPE_WEBHOOK_SECRET` and `PAYMENTS_MODE=test` are set in Vercel. Checkout refuses any price that isn't exactly the amount in `src/plans.ts`.
- **Live (prepared, unused):** the same product, price, webhook and portal exist in the live account. The live price ID and webhook secret are stored in Vercel as `STRIPE_PRICE_PRO_LIVE` and `STRIPE_WEBHOOK_SECRET_LIVE` (Production), which the app does not read.

Going live is the owner's call, not an automatic step:

1. Move the Vercel project to Pro (Hobby is non-commercial only).
2. Put the live secret key (`sk_live_...`) in `STRIPE_SECRET_KEY`.
3. Copy `STRIPE_PRICE_PRO_LIVE` into `STRIPE_PRICE_PRO` and `STRIPE_WEBHOOK_SECRET_LIVE` into `STRIPE_WEBHOOK_SECRET`.
4. Set `PAYMENTS_MODE=live` and redeploy.

## Deploy (Vercel)

1. Create a Vercel project from this repo (framework: Next.js; no build settings to change).
2. Set `DATABASE_URL` (Neon, production only) and `CUELY_HASH_SALT`. The production build creates the tables and loads the catalog.
3. Add `cuely.dev` to the project's domains.

Vercel's Hobby plan is for non-commercial use. Move to Pro before paid plans or the site banner go live.

## Theming

All colour, type, radius and motion values are tokens at the top of `app/globals.css`. A rebrand changes that block, the logo files in `public/brand/` and the icons in `app/` (`icon.svg`, `favicon.ico`, `apple-icon.png`, `opengraph-image.png`, `twitter-image.png`); the components use only the tokens. The brand kit (logo option 55, Funnel Display and Funnel Sans) is documented in `brand.md` alongside the source files. The accent has one job on the page: the dot that marks a pick.

## Adding to the catalog

- A tool: add an entry to `src/catalog/tools.ts` with facts from the vendor's own site, the page you read, and today's date. Give it a unique `baseline` in its category and fit weights with reasons.
- A recipe: add a file under `src/catalog/recipes/`, register it in `src/catalog/index.ts`. Tests check that every tool it names exists in the right category, that it has at least 3 dated catches with https sources and a cost note, and that recommend_stack routes its eval case to it.
- Then run `npm test` and `npm run db:sql`.

### Tool marks and motion

Tool logos come from [simple-icons](https://simpleicons.org) (CC0-1.0), vendored as path data in `src/logos.ts` and drawn in the current text colour at one size, so no tool looks louder than another. Each mark belongs to its owner and only identifies the tool. Tools without a simple-icons mark get a plain monogram. The hero example replays once when it scrolls into view and sections rise in once; both are skipped under `prefers-reduced-motion`, and the page reads fully without JavaScript.
