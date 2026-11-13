import { describe, expect, it } from "vitest";
import { categories, recipes, tools } from "@/catalog";
import { PRACTICES, practicesFor } from "@/catalog/practices";
import { detectProfile } from "@/engine/profile";
import { recommendStack } from "@/engine/recommend";
import { startProject } from "@/engine/start";
import { renderStart } from "@/mcp/render";

const snap = { categories, tools, recipes };
const ids = (s: ReturnType<typeof startProject>) => s.checklist.map((c) => c.id);

describe("start_project", () => {
  it("returns the same stack as recommend_stack with defaults, plus a checklist", () => {
    const d = "B2B SaaS for companies with per-seat billing";
    const s = startProject(snap, { description: d });
    const r = recommendStack(snap, { description: d, assumeDefaults: true });
    expect(s.status).toBe("ok");
    expect(s.recommendation.stack.map((x) => x.pick.slug)).toEqual(r.stack.map((x) => x.pick.slug));
    expect(ids(s)).toEqual(expect.arrayContaining(["secrets-out-of-git", "server-side-authz", "verify-webhooks", "hosted-card-entry", "b2b-tenant-isolation"]));
    expect(ids(s)).not.toContain("hipaa-baas");
  });

  it("never asks questions, and lists what it assumed", () => {
    const s = startProject(snap, { description: "an app for my book club" });
    expect(s.status).toBe("ok");
    expect(s.recommendation.questions).toEqual([]);
    expect(s.recommendation.profile.assumed.length).toBeGreaterThan(0);
  });

  it("adds the HIPAA work for health data and the GDPR work for EU data", () => {
    const health = ids(startProject(snap, { description: "A web app where therapists keep patient session notes. Patients pay monthly." }));
    expect(health).toEqual(expect.arrayContaining(["hipaa-baas", "hipaa-audit-log", "hipaa-risk-and-breach", "no-pii-in-logs", "verify-webhooks"]));
    const eu = ids(startProject(snap, { description: "A booking web app for gyms in Germany and France" }));
    expect(eu).toEqual(expect.arrayContaining(["gdpr-dpas", "eu-regions", "cookie-consent", "delete-and-export"]));
    expect(eu).not.toContain("hipaa-baas");
  });

  it("adds AI, document search, marketplace and phone app work only when they apply", () => {
    const ai = ids(startProject(snap, { description: "AI assistant that answers questions over a company's documents" }));
    expect(ai).toEqual(expect.arrayContaining(["ai-keys-server", "ai-usage-caps", "ai-prompt-injection", "rag-tenant-filter"]));
    const market = ids(startProject(snap, { description: "A marketplace where dog owners pay walkers and we keep 15%" }));
    expect(market).toContain("marketplace-kyc");
    const phone = ids(startProject(snap, { description: "An iPhone and Android app for habit tracking with a subscription" }));
    expect(phone).toEqual(expect.arrayContaining(["mobile-no-secrets", "store-privacy-forms", "delete-and-export", "verify-webhooks"]));
    expect(phone).not.toContain("hosted-card-entry");
    expect(phone).not.toContain("ai-keys-server");
  });

  it("follows the stack: Supabase gets row level security, Firebase gets security rules", () => {
    const supa = ids(startProject(snap, { description: "A web app for a book club", alreadyUsing: ["Supabase"] }));
    expect(supa).toContain("supabase-rls");
    const fire = ids(startProject(snap, { description: "A web app for a book club", alreadyUsing: ["Firebase"] }));
    expect(fire).toContain("firebase-rules");
    expect(fire).not.toContain("supabase-rls");
  });

  it("puts day-one work before launch work and renders checkboxes", () => {
    const s = startProject(snap, { description: "B2B SaaS for EU companies" });
    const phases = s.checklist.map((c) => c.phase);
    expect(phases.indexOf("before_launch")).toBeGreaterThan(phases.lastIndexOf("day_one"));
    const text = renderStart(s);
    expect(text).toMatch(/## Security and compliance checklist/);
    expect(text).toMatch(/### Set up before real data goes in\n- \[ \] \*\*/);
    expect(text).toMatch(/check_project/);
    expect(text.match(/^Next: /gm)).toHaveLength(1);
  });

  it("says so when the product is outside coverage, with no checklist", () => {
    const s = startProject(snap, { description: "A 3D shooter built in Unity for consoles" });
    expect(s.status).toBe("outside_coverage");
    expect(s.checklist).toEqual([]);
  });
});

describe("practices", () => {
  it("each has a unique id, a source over https and plain sentences", () => {
    expect(new Set(PRACTICES.map((p) => p.id)).size).toBe(PRACTICES.length);
    for (const p of PRACTICES) {
      expect(p.source, p.id).toMatch(/^https:\/\//);
      expect(p.detail, p.id).toMatch(/[.!?]$/);
      expect(p.why, p.id).toMatch(/[.!?]$/);
      expect(p.title, p.id).not.toMatch(/[.!?]$/);
    }
  });
  it("every practice applies to at least one product", () => {
    const base = { platform: "web" as const, money: "none" as const, audience: "customers" as const, ai: false, rag: false, game: false, needs: [], tools: [], categories: [] };
    const all = { platform: "both" as const, money: "users_pay_each_other" as const, audience: "customers" as const, ai: true, rag: true, game: true,
      needs: ["eu", "health_data", "b2b", "regulated"] as const, tools: ["supabase", "firebase"], categories: ["database", "auth"] as const };
    const hit = new Set([...practicesFor({ ...all, needs: [...all.needs], categories: [...all.categories] }), ...practicesFor({ ...base, platform: "web", needs: ["eu"], money: "users_pay_you" }), ...practicesFor({ ...base, audience: "internal" })].map((p) => p.id));
    for (const p of PRACTICES) expect(hit.has(p.id), p.id).toBe(true);
  });
});

describe("paid products", () => {
  it("reads 'patients pay monthly' as users paying the product", () => {
    expect(detectProfile("Patients pay monthly for the app").profile.money).toBe("users_pay_you");
    expect(detectProfile("Members pay a yearly fee").profile.money).toBe("users_pay_you");
  });
});
