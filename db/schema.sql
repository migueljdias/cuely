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
