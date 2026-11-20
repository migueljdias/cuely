# Contributing

Thanks for helping keep Cuely honest. The most useful contributions are corrections to the catalog.

## The rule that can't bend

Money never touches the ranking. Pull requests that add affiliate links, tracking parameters or sponsored wording, or that change a tool's weights without a source, will be closed. If you work for a vendor, you're welcome to correct facts about your product: say so in the pull request and link the page that shows the fact.

## Fixing a fact

Every price, limit and compliance statement in `src/catalog/tools.ts` has a source page (`pricingUrl`, or a source in `data/compliance.json`) and a date (`verifiedOn`).

1. Open an issue with the **Catalog correction** template, or edit the tool directly.
2. Link the vendor's own page that shows the correct fact. Third-party blogs don't count.
3. Update `verifiedOn` to the day you read the page.
4. Run `npm test`.

Many facts are re-read automatically every day (`.github/workflows/pricing.yml`, `signals.yml`, `compliance.yml`), so a fix to a measured value may be overwritten by the next run; in that case, fix the reader in `src/freshness/` instead.

## Changing the engine

The scoring rules are in `src/engine/` and documented in the README under "How picks are made". A change to how picks are made needs:

- a test in `tests/engine.test.ts` or `tests/check.test.ts` that shows the new behaviour,
- the README updated to match, and
- no change for cases the pull request doesn't mean to change: `npm test` must still pass, and say in the pull request which existing picks change.

## Development

```sh
npm install
npm run dev     # http://localhost:3000, MCP at /api/mcp, no sign-in needed locally
npm test
npm run typecheck
```

## Licenses

By contributing, you agree that your code is published under `LICENSE` (FSL-1.1-ALv2) and your catalog changes under `LICENSE-DATA` (CC BY-NC 4.0 with the additional permissions listed there).
