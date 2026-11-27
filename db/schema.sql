-- Cuely catalog schema (Postgres 15+; tested on PGlite, targets Neon).
-- The seed in db/seed.sql is generated from src/catalog by `npm run db:sql`.

create table if not exists categories (
  slug          text primary key,
  name          text not null,
  description   text not null,
  how_to_choose text not null,
  sort_order    integer not null
);

create table if not exists tools (
  slug                     text primary key,
  name                     text not null,
  category                 text not null references categories(slug),
  website                  text not null,
  pricing_url              text not null,
  summary                  text not null,
  pitch                    text not null,
  best_for                 jsonb not null default '[]',
  watch_out                jsonb not null default '[]',
  free_tier                text,
  paid_starts_at           text,
  free_tier_commercial_use boolean,
  open_source              boolean not null default false,
  self_hostable            boolean not null default false,
  baseline                 integer not null,          -- editorial default order in its category (1 = default pick)
  fit                      jsonb not null default '{}', -- { need: { weight: -3..3, reason } }
  verified_on              date not null,
  updated_at               timestamptz not null default now()
);
-- Monthly cost at Cuely's published usage profile (src/catalog/costs.ts).
alter table tools add column if not exists cost jsonb;
-- Measured health (src/freshness/health.ts): { score, reasons, measuredOn }, rewritten by the scheduled signals job.
alter table tools add column if not exists health jsonb;
-- Compliance facts (src/freshness/compliance.ts): { facts, readOn }, rewritten by the scheduled compliance job.
alter table tools add column if not exists compliance jsonb;
create index if not exists tools_category_idx on tools (category);

create table if not exists recipes (
  slug        text primary key,
  title       text not null,
  summary     text not null,
  body        jsonb not null,   -- the full Recipe object
  verified_on date not null,
  updated_at  timestamptz not null default now()
);

create table if not exists recipe_tools (
  recipe_slug text not null references recipes(slug) on delete cascade,
  category    text not null references categories(slug),
  tool_slug   text not null references tools(slug),
  optional    boolean not null default false,
  primary key (recipe_slug, category)
);

-- What agents ask for (Phase 1 metric). No IPs or descriptions are stored:
-- caller_hash is a daily-salted hash, so callers can be counted per day but not tracked.
create table if not exists usage_events (
  id          bigserial primary key,
  created_at  timestamptz not null default now(),
  tool        text not null,
  recipe      text,
  categories  text[] not null default '{}',
  needs       text[] not null default '{}',
  caller_hash text
);
create index if not exists usage_events_created_idx on usage_events (created_at);

-- Accounts (Phase 3). Users live in Neon Auth (schema neon_auth). This table keeps
-- only what Cuely needs: the plan and the Stripe customer ID. Stripe holds all card data.
-- Plans change rate limits only. Nothing here is ever read by the recommendation engine.
create table if not exists accounts (
  user_id                text primary key,
  email                  text,
  plan                   text not null default 'free' check (plan in ('free', 'pro')),
  plan_status            text,
  stripe_customer_id     text unique,
  stripe_subscription_id text,
  current_period_end     timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
-- Product-update emails: off unless the account holder turns them on. The time records when they chose.
alter table accounts add column if not exists product_updates boolean not null default false;
alter table accounts add column if not exists product_updates_at timestamptz;
-- The app's colour theme, chosen on Settings: dark (the default), light, or system.
alter table accounts add column if not exists theme text not null default 'dark' check (theme in ('dark', 'light', 'system'));
-- Alert emails, each off until the account holder turns it on: the Monday digest, launch
-- blockers (a compliance answer for the worse) and price changes, both checked daily.
alter table accounts add column if not exists alert_digest boolean not null default false;
alter table accounts add column if not exists alert_blockers boolean not null default false;
alter table accounts add column if not exists alert_prices boolean not null default false;

-- Optional MCP API keys. Only a SHA-256 hash is stored, the key is shown once.
create table if not exists api_keys (
  id           bigserial primary key,
  user_id      text not null references accounts(user_id) on delete cascade,
  name         text not null default 'default',
  prefix       text not null,
  key_hash     text not null unique,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at   timestamptz
);
create index if not exists api_keys_user_idx on api_keys (user_id);

-- Stripe webhook events already handled, so a retried delivery is applied once.
create table if not exists stripe_events (
  id          text primary key,
  type        text not null,
  received_at timestamptz not null default now()
);

-- MCP usage per account per UTC day, for the plan limits. One row per account per day.
-- calls counts tool calls (tools/call); minute_calls counts every request in the current minute.
create table if not exists api_usage (
  user_id      text not null references accounts(user_id) on delete cascade,
  day          date not null,
  calls        integer not null default 0,
  minute_start timestamptz not null default date_trunc('minute', now()),
  minute_calls integer not null default 0,
  primary key (user_id, day)
);

-- Tool calls per day split by Cuely tool and by where they came from, for the Usage page.
-- Counts only: the tool name (from Cuely's fixed list) and the source ("key:<id>" for an API
-- key, "connector" for a signed-in MCP client, "ask" for Ask Cuely). Never what was asked.
create table if not exists api_usage_detail (
  user_id text not null references accounts(user_id) on delete cascade,
  day     date not null,
  tool    text not null,
  source  text not null,
  calls   integer not null default 0,
  primary key (user_id, day, tool, source)
);

-- Which alerts have been emailed, so each change is sent once per kind of email. The key
-- names the change (tool, kind and wording), never anything the holder typed.
create table if not exists alert_sends (
  user_id    text not null references accounts(user_id) on delete cascade,
  kind       text not null check (kind in ('digest', 'blockers', 'prices')),
  change_key text not null,
  sent_at    timestamptz not null default now(),
  primary key (user_id, kind, change_key)
);

-- Stacks an account holder saved on their account page, to watch for price, health and
-- compliance changes. Only what they typed or picked in the web app: a name, an optional
-- plain description and catalog tool slugs. MCP calls never write here.
-- baseline holds each tool's facts as they were when the holder last marked the stack seen.
create table if not exists saved_stacks (
  id          bigserial primary key,
  user_id     text not null references accounts(user_id) on delete cascade,
  name        text not null,
  description text not null default '',
  tools       text[] not null default '{}',
  baseline    jsonb not null default '{}',
  seen_at     timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists saved_stacks_user_idx on saved_stacks (user_id);
-- Launch checklist ticks: practice id -> the date its holder ticked it. Readiness is worked
-- out from these on the project page. Only ids and dates; nothing the holder wrote.
alter table saved_stacks add column if not exists checks jsonb not null default '{}';
