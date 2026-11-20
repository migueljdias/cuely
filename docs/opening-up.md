# Opening up Cuely

> **Status (Nov 20, 2026): resumed.** Branch `claude/open-source` brings back the license files,
> contributor files and public-source links. Don't merge it into `main` on the private repo:
> the site would say the code is public before it is. It goes over in Phase 4 (new repo,
> rewritten history) and is merged there in step 6, right before the repo goes public.

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

## Phase 4: Go public without exposing your email

Your personal email is on 32 commits (recounted Nov 20). Rewriting history in this repo and flipping it public
would not hide it: GitHub keeps every merged pull request's original commits under
`refs/pull/*`, which only GitHub Support can remove. So the public repo is a **new repo** with
the history rewritten to your GitHub no-reply address; this one is renamed and stays private.
(Dry run done on Nov 19: all 93 commits kept, 0 copies of the personal email left, none in
files or commit messages either.)

1. [ ] github.com → Settings → Emails: tick **Keep my email addresses private** and **Block
       command line pushes that expose my email**. This stops new leaks, including merges made
       on github.com, which is how most of them got in.
2. [ ] Rename this repo: Settings → General → `cuely` → `cuely-private`. Leave it private.
3. [ ] Create a new **empty, private** repo named `cuely` (no README, license or .gitignore).
       The old name then points at the new repo, so `server.json` and every link stay right.
4. [ ] Tell Claude it exists. Claude rewrites the history with
       `git filter-repo --mailmap` (personal email → `14091229+migueljdias@users.noreply.github.com`),
       checks that nothing is left, and pushes `main` and this branch to the new repo.
5. [ ] On the new repo: add the Actions secrets again (Settings → Secrets → Actions; at least
       `ANTHROPIC_API_KEY`), install the Claude GitHub App on it, and in Vercel point the
       project's Git connection at the new repo.
6. [ ] Merge this branch on the new repo (the email setting from step 1 keeps the merge clean)
       and check the daily workflows run.
7. [ ] Run `npx gitleaks detect` once more, then Settings → **Change visibility → Public**.
8. [ ] Right after: turn on secret scanning + push protection, private vulnerability reporting
       and Dependabot alerts; protect `main` (require PR + CI); require approval for Actions
       runs from outside contributors' forks.
9. [ ] Add topics (`mcp`, `mcp-server`, `developer-tools`), a description and the website, and
       check the links on cuely.dev/trust open the public repo.

Issues and pull request discussions from the private repo don't move over; they stay in
`cuely-private`.

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
