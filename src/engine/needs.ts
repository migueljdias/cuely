import type { Need } from "@/catalog";

/**
 * Plain-word triggers for each need. Matching is on whole words or phrases,
 * lowercase. Kept deliberately small and readable: this table is part of the
 * published ranking method.
 */
export const NEED_TRIGGERS: Record<Need, string[]> = {
  b2b: ["b2b", "saas", "organization", "organizations", "org", "orgs", "team", "teams", "workspace", "workspaces",
    "multi-tenant", "multitenant", "tenant", "tenants", "sso", "saml", "scim", "enterprise", "seats", "companies",
    "business customers", "crm", "erp", "fintech"],
  regulated: ["fintech", "bank", "banking", "finance", "financial", "payments platform", "lending", "insurance",
    "insurtech", "health", "healthcare", "hipaa", "medical", "soc 2", "soc2", "compliance", "audit", "pci", "kyc",
    "legal", "govtech", "regulated"],
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
    "multiplayer", "websocket", "websockets"],
  fewer_vendors: ["all in one", "all-in-one", "one platform", "fewer vendors", "single vendor", "simple stack",
    "firebase", "supabase"],
  per_tenant_db: ["database per tenant", "database per customer", "db per tenant", "db per user",
    "database per user", "per-tenant database", "isolated databases"],
  long_running: ["background jobs", "background job", "workers", "worker", "cron", "long-running",
    "long running", "queue", "queues", "scraper", "scraping", "batch jobs", "websocket server"],
  high_volume: ["high volume", "high-volume", "millions", "at scale", "large scale", "heavy traffic",
    "lots of traffic", "bulk email", "video", "large files"],
};

function escape(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const compiled = Object.entries(NEED_TRIGGERS).map(([need, words]) => ({
  need: need as Need,
  patterns: words.map((w) => new RegExp(`(^|[^a-z0-9])${escape(w)}($|[^a-z0-9])`, "i")),
  words,
}));

export interface DetectedNeed {
  need: Need;
  matched: string;
}

export function detectNeeds(text: string): DetectedNeed[] {
  const out: DetectedNeed[] = [];
  for (const { need, patterns, words } of compiled) {
    const i = patterns.findIndex((p) => p.test(text));
    if (i >= 0) out.push({ need, matched: words[i] });
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
};
