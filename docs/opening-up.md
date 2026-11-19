# Opening up Cuely

Why: builders asked what repo data Cuely receives before pointing it at real projects
(Maurice, @KI_Vater, Nov 18 2026). Trust comes from saying exactly what Cuely receives,
making that claim testable, and publishing the code so anyone can check it.

Decisions: code under **FSL-1.1-ALv2**, catalog data under **CC BY-NC 4.0** with extra
permissions (self-hosting and using answers commercially is fine). Revenue stays the same:
the hosted endpoint, kept fresh every day, with Pro limits.

## Phase 1: Code (done on this branch)

- [x] MCP server instructions and input descriptions tell agents to send only the product in
      plain words and tool names, never code, file contents, env values, secrets or names
      (`src/mcp/server.ts`)
- [x] `check_project` tells agents to read tool *names* and env variable *names*, never values
- [x] Test: every tool called with marked text in every free-text field; fails if any of it is
      stored or if a usage row gains a field (`tests/mcp.test.ts`)

## Phase 2: Site (done on this branch)

- [x] New page `/trust` ("What Cuely receives"): example payload, what's never asked for, the
      five stored fields, what passes through, how to check it, licenses
- [x] Landing page: "Never sees your code" in the ticker, a section in Connect, a source link in
      Method
- [x] Footer: "What Cuely receives" and "Source on GitHub"
- [x] Privacy policy: what the agent sends, a link to `/trust`, "Checking these claims" section
- [x] Terms: "Source code and catalog data" section
- [x] `llms.txt`: a Data section agents read
- [x] Sitemap includes `/trust`

## Phase 3: Repo ready to open (done on this branch)

- [x] `LICENSE` (FSL-1.1-ALv2, Miguel Dias 2026) and `LICENSE-DATA` (scope, extra permissions,
      CC BY-NC 4.0 text); `"license"` in `package.json` (`private: true` stays, so it can't be
      published to npm by mistake)
- [x] README: What Cuely receives, Run your own copy, Contributing, License
- [x] `SECURITY.md`, `CONTRIBUTING.md` (no paid placement; vendors disclose), issue templates
      (catalog correction, bug, private security link)
- [x] Secret scan of all 92 commits: no keys, tokens or connection strings found
- [x] Workflows: none that run on pull requests use secrets, so PRs from forks can't reach
      `ANTHROPIC_API_KEY`; no `pull_request_target`

## Phase 4: Flip to public (you, in this order)

1. [ ] **Decide about your email in history.** Every commit is authored by your personal Gmail
       address, which becomes public. Either accept it, or before flipping set GitHub's
       "Keep my email addresses private" and use the `noreply` address for new commits.
       Rewriting old history is possible but breaks every existing clone; not recommended.
2. [ ] Run one more secret scan with a dedicated tool: `npx gitleaks detect` or GitHub's
       secret scanning, which turns on for free once public.
3. [ ] Rotate anything that was ever pasted into an issue, PR or Actions log (they become
       public too). Check Settings → Secrets: keys there stay private.
4. [ ] Merge this branch to `main`.
5. [ ] Settings → General → Danger zone → **Change visibility → Public**.
6. [ ] Right after: turn on secret scanning + push protection, private vulnerability
       reporting (Settings → Security), Dependabot alerts; protect `main` (require PR + CI);
       Actions → "Require approval for all outside collaborators" for fork PRs.
7. [ ] Add repo topics (`mcp`, `mcp-server`, `developer-tools`), a description and
       `https://cuely.dev` as the website.
8. [ ] Check the links on cuely.dev/trust and the footer open the public repo.

Steps 4 and 5 go together: `/trust` links to files on GitHub that 404 while the repo is private.

## Phase 5: Tell people

- [ ] Reply to Maurice with the payload and the `/trust` link (draft below)
- [ ] Post: "Cuely is now source-available" with the example payload as an image
- [ ] Submit/refresh listings (MCP registry `server.json` already points at the repo)
- [ ] Pin a "Catalog corrections welcome" issue

Draft reply:

> Fair question, so I made it checkable. Cuely never sees your repo: your agent reads
> package.json locally and sends a one-line description + tool names. No code, files or env
> values. It stores the tool called, not what you sent. Code is now public: cuely.dev/trust

## Later

- A `/trust` changelog: date-stamp any change to what Cuely receives or stores
- Optional: return the stored row in each response (`stored: {...}`) so agents can show it
- Watch for forks offering a hosted copy; FSL covers that, so reach out before escalating
