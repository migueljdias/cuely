# Dashboard rebuild: handoff

Brief for building the approved signed-in design. Branch: `claude/relaxed-curie-eqbypj` (open PR to staging: migueljdias/cuely#10).

## The design

Design canvas: https://claude.ai/artifact/1oMAGABsDWMAJVfCoSUJWZ, page **Screens**. Read it with the Artifact tool (`action: "read"`, then `path` for each `.dc.html` file). Files:

- `Sidebar.dc.html`: shared, collapsible rail (248px open, 72px collapsed). Groups: Workspace (Home, Projects, Alerts, Ask Cuely), Account (API keys, Usage, Plan & billing, Settings), Build (external links), profile.
- `Home`, `Project`, `Projects`, `Alerts`, `Ask`, `Keys`, `Usage`, `Billing`, `Settings`.

Visual rules:

- **Palette (dark):** page bg `#0b1020`; cards `#141b33` with border `#2a3456`; text `#eef1f8` / `#c9d0e0` / `#9aa3bc`; accent `#2f5bff` (link `#9db2ff`); warn `#f6b97d` on `#3a2612`; good `#79dfa9` on `#12321f`.
- **Type:** Geist and Geist Mono. Body 16px; h1 36px.
- **Layout:** fills wide screens. Main content max-width 1680px, side padding `clamp(16px, 2.5vw, 44px)`, a 60px breadcrumb bar.
- **Shapes:** buttons have a 10px radius, never pills. Only small status badges are pill-shaped (`.badge`; `.pill` is a site button class, so don't reuse it). Cards have a 16px radius.
- **Theme:** the Settings screen offers dark, light and system, so build the palette as CSS tokens that can flip.
- **Inspiration only:** the old Cuely design-system files are outdated; follow the canvas.

## What exists today (keep and restyle)

- **Shell and data:** `app/account/_shell.tsx` (Link + usePathname, collapsible rail in localStorage, redirects old `#anchors`). `_session.ts` uses a cached `accountSession()`, and `layout.tsx` is `force-dynamic`.
- **Pages:** `/account` (overview), `ask/`, `stacks/` and `stacks/[id]` (saved stacks = "Projects" in the design), `keys/`, `usage/`, `billing/`, `settings/`, `profile/`.
- **Supporting code:**
  - `src/accounts/stacks.ts`: saved stacks with baseline diffing (`stackChanges`, `toolFacts`).
  - `src/plans.ts`: maxStacks is 3 on free and 50 on pro.
  - `src/billing/sync.ts`.
  - The `saved_stacks` table in `db/schema.sql`. It also exists on the Neon staging branch.
- Styles in `app/globals.css`. Tests: `npm test` (204 passing), `npm run typecheck`, `npm run build`.

## Build order

1. **Shell + Home:** the new sidebar (rename "My stacks" to "Projects", add Alerts) and the Home screen built on real data.
2. **Project page:** readiness score + checklist ("before real data" / "before launch", blockers marked), cost as you grow, and keep/change per tool. Rename saved stacks to projects in the UI (routes can move to `/account/projects` with redirects from `/account/stacks`).
3. **Projects list:** the table plus "describe it" and "pick tools" (the existing flows).
4. **Alerts page:** built from `stackChanges` across projects, with filters.
5. **Restyle Ask, Keys, Usage, Billing and Settings** to the canvas.

## Needs new backend work (don't fake with sample data)

- **Checklist ticks per project:** a new table or a jsonb column. Readiness is computed from them. Update the privacy page (`app/privacy/page.tsx`, `LEGAL_UPDATED` in `src/site.ts`).
- **Theme preference saved to the account:** or localStorage first.
- **Usage by Cuely tool and by AI client:** today only per-day totals exist. Store counts only, never content.
- **Alert emails and weekly digest:** later; show delivery settings as "coming soon" until then.
- **Left out of this build:**
  - **GitHub import:** a separate integration. Hide its card or mark it "soon".
  - **Costs above 1,000 users:** need a cost model. Show only what the catalog supports.
  - **Invoices list:** use the Stripe portal link unless it's quick to list them via the API.

## Privacy rules

MCP calls never store descriptions. Projects store only what the user typed or saved. Never send secrets or code anywhere.
