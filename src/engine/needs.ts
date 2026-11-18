import type { Need } from "@/catalog";

/**
 * Plain-word triggers for each need. Matching is on whole words or phrases,
 * lowercase. Kept deliberately small and readable: this table is part of the
 * published ranking method.
 *
 * Some needs also come from the product profile (src/engine/profile.ts): a phone
 * app adds "mobile" (and "native_ios" when it is written in Swift), users paying each other adds "marketplace", a staff tool adds
 * "internal". Those are not repeated here.
 */
export const NEED_TRIGGERS: Record<Need, string[]> = {
  b2b: ["b2b", "saas", "multi-tenant", "multitenant", "tenant", "tenants", "sso", "saml", "scim", "enterprise", "seats",
    "per-seat", "per seat", "organizations", "orgs", "business customers", "crm", "erp", "fintech", "for companies",
    "to companies", "small companies", "for businesses", "to businesses", "small businesses", "invite their team", "invite teammates"],
  regulated: ["fintech", "bank", "banking", "finance", "financial", "payments platform", "lending", "insurance",
    "insurtech", "health", "healthcare", "hipaa", "medical", "soc 2", "soc2", "compliance", "audit", "pci", "kyc",
    "legal", "govtech", "regulated", "patient", "patients", "clinic", "clinics", "therapy", "therapist", "therapists",
    "telehealth", "telemedicine", "phi"],
  global_tax: ["worldwide", "global", "international", "internationally", "vat", "sales tax", "merchant of record",
    "mor", "sell abroad", "digital products"],
  open_source: ["open source", "open-source", "oss", "self-host", "self-hosted", "self hosted", "self-hosting",
    "no vendor lock-in", "avoid lock-in"],
  eu: ["eu", "europe", "european", "gdpr", "germany", "france", "data residency"],
  low_cost: ["cheap", "budget", "free", "low cost", "low-cost", "bootstrapped", "side project", "mvp", "hobby",
    "solo", "indie", "prototype", "minimal cost"],
  edge: ["edge", "low latency", "low-latency", "global latency", "fast worldwide"],
  nextjs: ["next.js", "nextjs", "next js", "react", "vercel"],
  realtime: ["realtime", "real-time", "real time", "live updates", "chat", "presence", "collaborative",
    "multiplayer", "websocket", "websockets", "retro", "retros", "retrospective", "retrospectives", "whiteboard",
    "live cursors", "co-edit", "co-editing", "live session", "live sessions", "together live"],
  fewer_vendors: ["all in one", "all-in-one", "one platform", "fewer vendors", "single vendor", "simple stack",
    "firebase", "supabase"],
  per_tenant_db: ["database per tenant", "database per customer", "db per tenant", "db per user",
    "database per user", "per-tenant database", "isolated databases"],
  long_running: ["background jobs", "background job", "workers", "worker", "cron", "long-running",
    "long running", "queue", "queues", "scraper", "scraping", "batch jobs", "websocket server"],
  high_volume: ["high volume", "high-volume", "millions", "at scale", "large scale", "heavy traffic",
    "lots of traffic", "bulk email", "video", "large files"],
  mobile: [],
  native_ios: [],
  marketplace: [],
  internal: [],
  rag: ["rag", "pdf", "pdfs", "documents", "docs", "knowledge base", "handbook", "handbooks", "policies", "manuals",
    "embeddings", "vector", "vectors", "semantic search", "retrieval", "over our files", "over their files"],
  usage_billing: ["usage-based", "usage based", "metered", "pay per use", "pay-per-use", "per request", "per query",
    "per token", "credits"],
  google_workspace: ["google workspace", "g suite", "gsuite", "google sheets", "google drive"],
  counters: ["vote", "votes", "voting", "upvote", "upvotes", "likes", "tally", "tallies", "counter", "counters",
    "leaderboard", "leaderboards", "high score", "high scores", "streak", "streaks", "rate limit", "rate limiting",
    "crowd percentages", "live percentages", "high write", "high-write"],
  spiky: ["viral", "go viral", "goes viral", "traffic spike", "traffic spikes", "spike", "spikes", "spiky", "bursty",
    "hacker news", "product hunt", "front page", "launch day", "surge", "surges", "flash crowd"],
  health_data: ["hipaa", "phi", "health", "healthcare", "medical", "patient", "patients", "clinic", "clinics", "therapy",
    "therapist", "therapists", "telehealth", "telemedicine", "doctor", "doctors", "mental health", "health records"],
};

/**
 * Phrases removed before matching, so a product name doesn't read as a need:
 * "Google Workspace" is not a B2B workspace, "React Native" is not Next.js.
 */
const MASKS = [/google workspace/gi, /g suite/gi, /react native/gi, /microsoft 365/gi, /game[- ]?(plan|changer|changing)s?/gi];

/** Needs that some phrases imply but the masked text no longer shows. */
const MASKED_NEEDS: { re: RegExp; need: Need; matched: string }[] = [
  { re: /google workspace|g suite|gsuite/i, need: "google_workspace", matched: "google workspace" },
];

function escape(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function wordPattern(w: string) {
  return new RegExp(`(^|[^a-z0-9])${escape(w)}($|[^a-z0-9])`, "i");
}

const compiled = Object.entries(NEED_TRIGGERS).map(([need, words]) => ({
  need: need as Need,
  patterns: words.map(wordPattern),
  words,
}));

export interface DetectedNeed {
  need: Need;
  matched: string;
}

export function maskText(text: string): string {
  return MASKS.reduce((t, re) => t.replace(re, " "), text);
}

export function detectNeeds(text: string): DetectedNeed[] {
  const masked = maskText(text);
  const out: DetectedNeed[] = [];
  for (const { need, patterns, words } of compiled) {
    const i = patterns.findIndex((p) => p.test(masked));
    if (i >= 0) out.push({ need, matched: words[i] });
  }
  for (const m of MASKED_NEEDS) {
    if (m.re.test(text) && !out.some((d) => d.need === m.need)) out.push({ need: m.need, matched: m.matched });
  }
  return out;
}

export const NEED_LABELS: Record<Need, string> = {
  b2b: "sells to businesses (organizations, roles, SSO)",
  regulated: "regulated or compliance-sensitive",
  global_tax: "sells internationally and wants tax handled",
  open_source: "prefers open source or self-hosting",
  eu: "EU data residency or GDPR",
  low_cost: "keep costs as low as possible",
  edge: "global low latency",
  nextjs: "Next.js or React",
  realtime: "realtime features",
  fewer_vendors: "fewer vendors",
  per_tenant_db: "a database per customer",
  long_running: "background jobs or long-running servers",
  high_volume: "high volume",
  mobile: "native iOS or Android app",
  native_ios: "an iPhone app in Swift with Xcode",
  marketplace: "users pay each other and you take a cut",
  rag: "answers over the user's own documents",
  usage_billing: "charges by usage",
  internal: "a tool for your own staff",
  google_workspace: "already on Google Workspace",
  counters: "votes, scores, leaderboards or streaks (many writes to the same numbers)",
  spiky: "traffic comes in viral spikes",
  health_data: "stores patient or health information",
};

export const ALL_NEEDS = Object.keys(NEED_TRIGGERS) as Need[];

/** Short noun phrases for sentences like "Choose it for X". */
export const NEED_SHORT: Record<Need, string> = {
  b2b: "selling to businesses",
  regulated: "compliance-heavy products",
  global_tax: "having sales tax and VAT handled worldwide",
  open_source: "open source or self-hosting",
  eu: "EU data and GDPR",
  low_cost: "the lowest cost",
  edge: "global low latency",
  nextjs: "Next.js and React",
  realtime: "realtime features",
  fewer_vendors: "fewer vendors",
  per_tenant_db: "a database per customer",
  long_running: "background jobs and long-running servers",
  high_volume: "high volume",
  mobile: "native mobile apps",
  native_ios: "Swift iPhone apps",
  marketplace: "marketplaces that pay out to providers",
  rag: "answering from documents",
  usage_billing: "usage-based billing",
  internal: "internal staff tools",
  google_workspace: "teams on Google Workspace",
  counters: "votes, leaderboards and streaks",
  spiky: "viral traffic spikes",
  health_data: "patient and health data",
};
